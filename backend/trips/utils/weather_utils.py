"""Hourly forecasts from Open-Meteo (free, no key) and conversion to the app's weather shape."""

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache

from trips.constants import (
    CALM_CONDITIONS,
    DEFAULT_VISIBILITY_MI,
    FREEZING_F,
    FT_PER_MILE,
    GUST_WEIGHT,
    HIGH_WIND_MPH,
    HOURLY_VARS,
    ICE_CODES,
    MAX_FORECAST_HOURS,
    MIN_PRECIP_IN_HR,
    RAIN_CODE_RANGE,
    SNOW_CODES,
    THUNDER_CODES,
    WEATHER_BATCH_SIZE,
    WEATHER_CACHE_SECONDS,
    WEATHER_CACHE_VERSION,
    WEATHER_GRID_DEG,
    WEATHER_MAX_PARALLEL,
    WEATHER_SERVICE,
    WMO_CONDITIONS,
)
from trips.exceptions import ExternalServiceError
from trips.utils.http_utils import HttpUtils

logger = logging.getLogger(__name__)


class Forecast:
    """Hourly forecasts for a set of grid cells, starting at `start` (UTC, on the hour)."""

    def __init__(self, start, hours, series, weather_utils):
        self.start = start
        self.hours = hours
        self._series = series  # grid key -> {var: [values per hour]}
        self.weather_utils = weather_utils

    def covers(self, when):
        return 0 <= round((when - self.start).total_seconds() / 3600) <= self.hours

    def at(self, lon, lat, when):
        """Weather at a point for the forecast hour nearest `when` (clamped to the window)."""
        idx = round((when - self.start).total_seconds() / 3600)
        return self.at_hour(lon, lat, min(max(idx, 0), self.hours))

    def at_hour(self, lon, lat, idx):
        """Weather at a point `idx` hours after `start`."""
        series = self._series.get(self.weather_utils.grid_key(lon, lat))
        if series is None:
            raise ExternalServiceError(f'No forecast was fetched for ({lon:.3f}, {lat:.3f}).')
        return self.weather_utils.to_weather({var: values[idx] for var, values in series.items()})


class WeatherUtils:
    def __init__(self):
        self.http_utils = HttpUtils()

    def grid_key(self, lon, lat):
        """Snap a point to the weather grid so nearby samples share one forecast."""
        return (
            round(round(lon / WEATHER_GRID_DEG) * WEATHER_GRID_DEG, 4),
            round(round(lat / WEATHER_GRID_DEG) * WEATHER_GRID_DEG, 4),
        )

    def fetch_forecast(self, points, start, hours):
        """Forecast for every (lon, lat) in `points` covering `start` .. `start + hours`."""
        hours = min(hours, MAX_FORECAST_HOURS)
        stamp = start.strftime('%Y%m%d%H')
        cache_key = {
            key: f'{WEATHER_CACHE_VERSION}:{stamp}:{hours}:{key[0]}:{key[1]}'
            for key in sorted({self.grid_key(lon, lat) for lon, lat in points})
        }

        cached = cache.get_many(cache_key.values())
        series = {key: cached[ck] for key, ck in cache_key.items() if ck in cached}
        missing = [key for key in cache_key if key not in series]
        logger.info('Redis weather cache: %d of %d grid cells cached, fetching %d', len(series), len(cache_key), len(missing))

        batches = [missing[i : i + WEATHER_BATCH_SIZE] for i in range(0, len(missing), WEATHER_BATCH_SIZE)]
        fetched = {}
        with ThreadPoolExecutor(max_workers=WEATHER_MAX_PARALLEL) as pool:
            for result in pool.map(lambda b: self._fetch_batch(b, start, hours), batches):
                fetched.update(result)
        if fetched:
            cache.set_many({cache_key[key]: s for key, s in fetched.items()}, WEATHER_CACHE_SECONDS)

        return Forecast(start, hours, {**series, **fetched}, self)

    def _fetch_batch(self, keys, start, hours):
        end = start + timedelta(hours=hours)
        data = self.http_utils.get_json(
            f'{settings.OPEN_METEO_BASE_URL}/v1/forecast',
            {
                'latitude': ','.join(str(lat) for _, lat in keys),
                'longitude': ','.join(str(lon) for lon, _ in keys),
                'hourly': ','.join(HOURLY_VARS),
                'temperature_unit': 'fahrenheit',
                'wind_speed_unit': 'mph',
                'precipitation_unit': 'inch',
                'timezone': 'GMT',
                'start_hour': start.strftime('%Y-%m-%dT%H:%M'),
                'end_hour': end.strftime('%Y-%m-%dT%H:%M'),
            },
            service=WEATHER_SERVICE,
        )
        locations = data if isinstance(data, list) else [data]
        if len(locations) != len(keys):
            raise ExternalServiceError(f'{WEATHER_SERVICE} returned an unexpected number of locations.')
        out = {}
        for key, loc in zip(keys, locations):
            hourly = loc.get('hourly') or {}
            series = {var: hourly.get(var) or [] for var in HOURLY_VARS}
            if any(len(v) < hours + 1 for v in series.values()):
                raise ExternalServiceError(f'{WEATHER_SERVICE} returned an incomplete forecast.')
            out[key] = series
        return out

    def to_weather(self, hour):
        """Map one hour of Open-Meteo values to the API's weather object."""
        code = int(hour.get('weather_code') or 0)
        temp_f = round(hour.get('temperature_2m') or 0)
        precip = round(hour.get('precipitation') or 0, 2)
        snowfall = round(hour.get('snowfall') or 0, 2)
        rain = round((hour.get('rain') or 0) + (hour.get('showers') or 0), 2)
        wind = round(hour.get('wind_speed_10m') or 0)
        gust = round(hour.get('wind_gusts_10m') or wind)
        vis_ft = hour.get('visibility')
        visibility = DEFAULT_VISIBILITY_MI if vis_ft is None else round(min(DEFAULT_VISIBILITY_MI, vis_ft / FT_PER_MILE), 1)

        if code in SNOW_CODES or snowfall > 0:
            precip_type = 'snow'
        elif code in ICE_CODES or (precip >= MIN_PRECIP_IN_HR and temp_f <= FREEZING_F):
            precip_type = 'ice'
        elif precip >= MIN_PRECIP_IN_HR or RAIN_CODE_RANGE[0] <= code <= RAIN_CODE_RANGE[1] or code in THUNDER_CODES:
            precip_type = 'rain'
        else:
            precip_type = 'none'

        condition = WMO_CONDITIONS.get(code, 'Unknown')
        if condition in CALM_CONDITIONS and max(wind, gust * GUST_WEIGHT) >= HIGH_WIND_MPH:
            condition = 'High Wind'

        return {
            'tempF': temp_f,
            'windMph': wind,
            'gustMph': gust,
            'precipInHr': precip,
            'rainInHr': rain,
            'snowInHr': snowfall,
            'precipType': precip_type,
            'visibilityMi': visibility,
            'condition': condition,
            'weatherCode': code,
        }
