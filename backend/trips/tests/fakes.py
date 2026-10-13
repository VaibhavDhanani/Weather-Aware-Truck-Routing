"""Offline stand-ins for the geocoding, routing and weather APIs."""

from trips.utils.geo_utils import GeoUtils
from trips.utils.geocoding_utils import Place
from trips.utils.routing_utils import RouteOption
from trips.utils.weather_utils import WeatherUtils

CALM = {
    'temperature_2m': 60, 'precipitation': 0, 'rain': 0, 'showers': 0, 'snowfall': 0, 'wind_speed_10m': 5,
    'wind_gusts_10m': 8, 'visibility': 52800, 'weather_code': 0,
}
BLIZZARD = {  # snow 2 in/hr -> Severe; wind 40 mph with > 40,000 lb -> Severe
    'temperature_2m': 25, 'precipitation': 0.3, 'rain': 0, 'showers': 0, 'snowfall': 2, 'wind_speed_10m': 40,
    'wind_gusts_10m': 55, 'visibility': 2640, 'weather_code': 75,
}

geo_utils = GeoUtils()
weather_utils = WeatherUtils()

PLACES = {
    'denver': Place('Denver', -104.99, 39.74, 'Denver, Colorado'),
    'chicago': Place('Chicago', -87.63, 41.88, 'Chicago, Illinois'),
}


def fake_geocode_city(city):
    return PLACES[city.lower()]


def straight_route(o, d, *, bend=0.0, mph=60.0, name='', steps=40):
    """A gently bent polyline from o to d driven at a constant speed."""
    coords = []
    for i in range(steps + 1):
        f = i / steps
        bulge = bend * 4 * f * (1 - f)
        coords.append((o.lon + (d.lon - o.lon) * f, o.lat + (d.lat - o.lat) * f + bulge))
    seg = [geo_utils.haversine_miles(a, b) for a, b in zip(coords, coords[1:])]
    return RouteOption(
        name=name, coords=coords, cum_miles=geo_utils.cumulative(seg), cum_hours=geo_utils.cumulative([m / mph for m in seg])
    )


def fake_route_options(o, d):
    return [
        straight_route(o, d, name='via I 80'),
        straight_route(o, d, bend=2.0, mph=58, name='via US 30'),  # passes the storm
        straight_route(o, d, bend=-2.0, mph=55, name='via I 70'),
    ]


class FakeForecast:
    """Blizzard north of latitude 41.5 (route B's bulge), calm elsewhere."""

    def __init__(self, start, hours):
        self.start, self.hours = start, hours

    def covers(self, when):
        return 0 <= (when - self.start).total_seconds() / 3600 <= self.hours

    def at(self, lon, lat, when):
        return self.at_hour(lon, lat, 0)

    def at_hour(self, lon, lat, idx):
        return weather_utils.to_weather(BLIZZARD if lat > 41.5 else CALM)


def fake_fetch_forecast(points, start, hours):
    return FakeForecast(start, hours)
