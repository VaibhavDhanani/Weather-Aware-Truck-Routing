"""Builds the trip-plan response the frontend renders (shape documented in
frontend/src/api/client.js; example in frontend/src/api/sample-plan-response.json)."""

import hashlib
import json
import math
from datetime import datetime, timedelta, timezone

from django.core.cache import cache

from trips.constants import (
    DISPLAY_STEP_MILES,
    HEATMAP_CELLS,
    HEATMAP_HOURS,
    HEATMAP_PAD_DEG,
    PLAN_CACHE_SECONDS,
    RECOMMENDATION_LEVELS,
    RISK_LEVEL_LABELS,
    RISK_LEVELS,
    ROUTE_IDS,
    SAME_PLACE_MILES,
)
from trips.exceptions import TripPlanningError
from trips.utils.geo_utils import GeoUtils
from trips.utils.geocoding_utils import GeocodingUtils
from trips.utils.risk_utils import RiskUtils
from trips.utils.routing_utils import RoutingUtils
from trips.utils.weather_utils import WeatherUtils


class PlanTripUtils:
    def __init__(self):
        self.geo_utils = GeoUtils()
        self.geocoding_utils = GeocodingUtils()
        self.routing_utils = RoutingUtils()
        self.weather_utils = WeatherUtils()
        self.risk_utils = RiskUtils()

    def plan_trip(self, *, origin, destination, departure, load_weight_lbs, interval_miles, now=None):
        """The full trip plan; identical requests within PLAN_CACHE_SECONDS reuse the cached response."""
        key = self._plan_cache_key(origin, destination, departure, load_weight_lbs, interval_miles)
        plan = cache.get(key)
        if plan is None:
            plan = self._build_plan(origin, destination, departure, load_weight_lbs, interval_miles, now)
            cache.set(key, plan, PLAN_CACHE_SECONDS)
        return plan

    def _plan_cache_key(self, origin, destination, departure, load_weight_lbs, interval_miles):
        request = [origin.strip().lower(), destination.strip().lower(), self._iso(departure), load_weight_lbs, interval_miles]
        return 'plan:' + hashlib.sha1(json.dumps(request).encode()).hexdigest()

    def _build_plan(self, origin, destination, departure, load_weight_lbs, interval_miles, now=None):
        now = now or datetime.now(timezone.utc)
        start = now.replace(minute=0, second=0, microsecond=0)

        o = self.geocoding_utils.geocode_city(origin)
        d = self.geocoding_utils.geocode_city(destination)
        if self.geo_utils.haversine_miles((o.lon, o.lat), (d.lon, d.lat)) < SAME_PLACE_MILES:
            raise TripPlanningError('Origin and destination are the same place.')
        options = self.routing_utils.get_route_options(o, d)

        # 1. Checkpoints along each route with the truck's ETA there.
        routes = [
            (route_id, opt, self._checkpoints(opt, departure, interval_miles))
            for route_id, opt in zip(ROUTE_IDS, options)
        ]

        # 2. One forecast fetch covering every checkpoint ETA and the 48h heatmap.
        grid, cell_deg = self._heatmap_grid([opt.coords for _, opt, _ in routes])
        latest_eta = max(c['_eta'] for _, _, cps in routes for c in cps)
        needed = math.ceil((latest_eta - start).total_seconds() / 3600)
        horizon = max(HEATMAP_HOURS, math.ceil(needed / 24) * 24)  # whole days improve cache reuse
        sample_points = grid + [(c['lon'], c['lat']) for _, _, cps in routes for c in cps]
        forecast = self.weather_utils.fetch_forecast(sample_points, start, horizon)

        # 3. Weather + risk per checkpoint, then per route.
        out_routes = [
            self._route_payload(route_id, opt, checkpoints, forecast, departure, load_weight_lbs)
            for route_id, opt, checkpoints in routes
        ]

        # 4. Recommend per the rules: fewest No Travel / Severe / High miles, then
        #    lowest average risk, then shortest travel time.
        ranked = sorted(out_routes, key=self.risk_utils.recommendation_key)
        fastest = min(out_routes, key=lambda r: r['durationMinutes'])
        safest = min(out_routes, key=lambda r: self.risk_utils.recommendation_key(r)[:-1])  # ignoring time
        for r in out_routes:
            r['summary'] = self._summary(r, fastest=r is fastest, safest=r is safest)

        for r in out_routes:
            for c in r['checkpoints']:
                del c['_hours'], c['_eta']

        return {
            'origin': {'name': o.name, 'label': o.label, 'lon': o.lon, 'lat': o.lat},
            'destination': {'name': d.name, 'label': d.label, 'lon': d.lon, 'lat': d.lat},
            'departure': self._iso(departure),
            'loadWeightLbs': load_weight_lbs,
            'intervalMiles': interval_miles,
            'fastestRouteId': fastest['id'],
            'safestRouteId': safest['id'],
            'recommendedRouteId': ranked[0]['id'],
            'recommendationReason': self._recommendation_reason(ranked),
            'routes': out_routes,
            'heatmap': {
                'forecastStart': self._iso(start),
                'hours': HEATMAP_HOURS,
                'cellSizeDeg': round(cell_deg, 4),
                'points': self._heatmap_points(grid, forecast),
            },
        }

    def _checkpoints(self, opt, departure, interval_miles):
        total = opt.distance_miles
        miles = [float(m) for m in range(0, int(total), interval_miles)]
        if not miles or total - miles[-1] > 0.5:
            miles.append(total)

        checkpoints = []
        for index, mile in enumerate(miles):
            lon, lat = self.geo_utils.interpolate(opt.cum_miles, opt.coords, mile)
            hours = self.geo_utils.interpolate(opt.cum_miles, opt.cum_hours, mile)
            checkpoints.append({
                'index': index,
                'mile': round(mile),
                'lon': round(lon, 5),
                'lat': round(lat, 5),
                '_hours': hours,
                '_eta': departure + timedelta(hours=hours),
            })
        return checkpoints

    def _route_payload(self, route_id, opt, checkpoints, forecast, departure, load_weight_lbs):
        for c in checkpoints:
            c['weather'] = forecast.at(c['lon'], c['lat'], c['_eta'])
            c['risk'] = self.risk_utils.assess_risk(c['weather'], load_weight_lbs)
            c['inForecastWindow'] = forecast.covers(c['_eta'])
            c['eta'] = self._iso(c['_eta'])
        return {
            'id': route_id,
            'name': opt.name or f'Route {route_id}',
            'geometry': [
                [round(lon, 5), round(lat, 5)] for lon, lat in self.geo_utils.sample_every(opt.coords, DISPLAY_STEP_MILES)
            ],
            'distanceMiles': round(opt.distance_miles),
            'durationMinutes': round(opt.duration_hours * 60),
            'departure': self._iso(departure),
            'arrival': checkpoints[-1]['eta'],
            **self.risk_utils.route_risk(checkpoints),  # riskLevel, riskScore, milesByLevel
            'checkpoints': checkpoints,
        }

    def _heatmap_grid(self, lines):
        (west, south), (east, north) = self.geo_utils.bounds(lines)
        west, south = west - HEATMAP_PAD_DEG, south - HEATMAP_PAD_DEG
        east, north = east + HEATMAP_PAD_DEG, north + HEATMAP_PAD_DEG
        # Web Mercator stretches latitude; use shorter latitude steps so cells look square on the map.
        lat_scale = math.cos(math.radians((north + south) / 2))
        step = max(east - west, (north - south) / lat_scale) / (HEATMAP_CELLS - 1)
        lat_step = step * lat_scale
        cols = int((east - west) / step) + 1
        rows = int((north - south) / lat_step) + 1
        points = [(west + c * step, south + r * lat_step) for r in range(rows) for c in range(cols)]
        return points, step

    def _heatmap_points(self, grid, forecast):
        return [
            {
                'lon': round(lon, 4),
                'lat': round(lat, 4),
                'values': [
                    round(self.risk_utils.weighted_score(forecast.at_hour(lon, lat, h)), 2)
                    for h in range(HEATMAP_HOURS + 1)
                ],
            }
            for lon, lat in grid
        ]

    def _summary(self, route, *, fastest, safest):
        parts = []
        if fastest:
            parts.append('Fastest option.')
        if safest:
            parts.append('Lowest weather risk.')
        if route['riskLevel'] == 'low':
            parts.append('No significant weather expected.')
            return ' '.join(parts)

        worst = max(route['checkpoints'], key=lambda c: RISK_LEVELS.index(c['risk']['level']))
        parts.append(
            f"Worst: {RISK_LEVEL_LABELS[worst['risk']['level']]} near mile {worst['mile']} "
            f"(~{self._fmt_hours(worst['_hours'])} into the trip) — {'; '.join(worst['risk']['factors'])}."
        )
        miles = route['milesByLevel']
        flagged = [f"{miles[level]} mi {RISK_LEVEL_LABELS[level]}" for level in RECOMMENDATION_LEVELS if miles[level]]
        if flagged:
            parts.append(f"{', '.join(flagged)}.")
        return ' '.join(parts)

    def _recommendation_reason(self, ranked):
        """Name the first rule (in priority order) that puts the winner ahead of the runner-up."""
        rec = ranked[0]
        warning = (
            'Every route crosses No Travel conditions — consider another departure time. '
            if rec['milesByLevel']['no_travel']
            else ''
        )
        if len(ranked) == 1:
            return warning + 'Only one route was found.'

        runner = ranked[1]
        rec_key = self.risk_utils.recommendation_key(rec)
        run_key = self.risk_utils.recommendation_key(runner)
        criterion = next((i for i, (a, b) in enumerate(zip(rec_key, run_key)) if a != b), None)
        vs = f"Route {runner['id']}"

        if criterion is None:
            reason = f'Ties with {vs} on every rule; listed first.'
        elif criterion < len(RECOMMENDATION_LEVELS):
            label = RISK_LEVEL_LABELS[RECOMMENDATION_LEVELS[criterion]]
            reason = f'Fewest {label} miles ({rec_key[criterion]} vs {run_key[criterion]} on {vs}).'
        elif criterion == len(RECOMMENDATION_LEVELS):
            reason = f'Same No Travel/Severe/High mileage as {vs}, lower average risk ({rec_key[criterion]} vs {run_key[criterion]}).'
        else:
            saved = self._fmt_hours((runner['durationMinutes'] - rec['durationMinutes']) / 60)
            reason = f'Same risk as {vs}, but {saved} shorter.'
        return warning + reason

    def _iso(self, dt):
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')

    def _fmt_hours(self, hours):
        return f'{round(hours * 60)} min' if hours < 1 else f'{round(hours)}h'
