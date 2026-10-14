from dataclasses import dataclass

from django.conf import settings

from trips.constants import (
    DETOUR_ALONG_FRACTIONS,
    DETOUR_MAX_OFFSET_MILES,
    DETOUR_MAX_OVERLAP,
    DETOUR_MAX_SLOWDOWN,
    DETOUR_MIN_OFFSET_MILES,
    DETOUR_OFFSET_SHARE,
    MAX_ROUTES,
    METERS_PER_MILE,
    OVERLAP_NEAR_MILES,
    OVERLAP_PROBE_STEP_MILES,
    OVERLAP_REFERENCE_STEP_MILES,
    ROUTING_SERVICE,
    TRUCK_MAX_MPH,
    VIA_SPIKE_MATCH_MILES,
)
from trips.exceptions import ExternalServiceError, RouteNotFound
from trips.utils.geo_utils import GeoUtils
from trips.utils.http_utils import HttpUtils


@dataclass
class RouteOption:
    name: str
    coords: list
    cum_miles: list
    cum_hours: list

    @property
    def distance_miles(self):
        return self.cum_miles[-1]

    @property
    def duration_hours(self):
        return self.cum_hours[-1]


class RoutingUtils:
    def __init__(self):
        self.geo_utils = GeoUtils()
        self.http_utils = HttpUtils()

    def get_route_options(self, origin, destination):
        o, d = (origin.lon, origin.lat), (destination.lon, destination.lat)
        options = [self._parse(r) for r in self._fetch([o, d], alternatives=True)]
        if not options:
            raise RouteNotFound(f'No drivable route found between "{origin.name}" and "{destination.name}".')

        # OSRM often returns fewer than three; add detours through points beside the route.
        fastest = min(r.duration_hours for r in options)
        for via in self._detour_points(o, d):
            if len(options) >= MAX_ROUTES:
                break
            routes = self._fetch([o, via, d], alternatives=False)
            if not routes:
                continue
            candidate = self._parse(routes[0])
            if candidate.duration_hours > fastest * DETOUR_MAX_SLOWDOWN:
                continue
            if any(self._overlap(candidate, r) > DETOUR_MAX_OVERLAP for r in options):
                continue
            options.append(candidate)

        options.sort(key=lambda r: r.duration_hours)
        return options[:MAX_ROUTES]

    def _fetch(self, points, *, alternatives):
        coords = ';'.join(f'{lon:.6f},{lat:.6f}' for lon, lat in points)
        data = self.http_utils.get_json(
            f'{settings.OSRM_BASE_URL}/route/v1/driving/{coords}',
            {
                'alternatives': str(MAX_ROUTES) if alternatives else 'false',
                'overview': 'full',
                'geometries': 'geojson',
                'steps': 'true',
                'annotations': 'distance,duration',
            },
            service=ROUTING_SERVICE,
            ok_statuses=(200, 400),
        )
        code = data.get('code')
        if code == 'Ok':
            return data['routes']
        if code in ('NoRoute', 'NoSegment'):
            return []
        raise ExternalServiceError(f"{ROUTING_SERVICE} error: {data.get('message') or code}")

    def _parse(self, route):
        coords = [tuple(c) for c in route['geometry']['coordinates']]
        seg_m, seg_s, boundaries = [], [], []
        for leg in route['legs']:
            ann = leg.get('annotation') or {}
            seg_m += ann.get('distance', [])
            seg_s += ann.get('duration', [])
            boundaries.append(len(seg_m))

        if len(seg_m) == len(coords) - 1 and len(seg_s) == len(seg_m):
            seg_miles = [m / METERS_PER_MILE for m in seg_m]
            seg_hours = [max(s / 3600, mi / TRUCK_MAX_MPH) for s, mi in zip(seg_s, seg_miles)]
            for b in boundaries[:-1]:
                coords, seg_miles, seg_hours = self._remove_via_spike(coords, seg_miles, seg_hours, b)
        else:
            seg_miles = [self.geo_utils.haversine_miles(a, b) for a, b in zip(coords, coords[1:])]
            total = sum(seg_miles) or 1
            hours = max(route['duration'] / 3600, total / TRUCK_MAX_MPH)
            seg_hours = [mi / total * hours for mi in seg_miles]

        return RouteOption(
            name=self._route_name(route['legs']),
            coords=coords,
            cum_miles=self.geo_utils.cumulative(seg_miles),
            cum_hours=self.geo_utils.cumulative(seg_hours),
        )

    def _route_name(self, legs):
        miles, first_seen = {}, {}
        for leg in legs:
            for step in leg.get('steps') or []:
                road = (step.get('ref') or '').split(';')[0].strip() or (step.get('name') or '').strip()
                if road:
                    miles[road] = miles.get(road, 0) + step.get('distance', 0)
                    first_seen.setdefault(road, len(first_seen))
        if not miles:
            for leg in legs:
                for road in (leg.get('summary') or '').split(', '):
                    if road:
                        miles.setdefault(road, 0)
                        first_seen.setdefault(road, len(first_seen))
        top = sorted(miles, key=miles.get, reverse=True)[:3]
        return f"via {', '.join(sorted(top, key=first_seen.get))}" if top else ''

    # Cut the out-and-back a via point causes when it snaps onto a dead-end road.
    def _remove_via_spike(self, coords, seg_miles, seg_hours, boundary):
        i, j = boundary - 1, boundary + 1
        while i >= 0 and j < len(coords) and self.geo_utils.haversine_miles(coords[i], coords[j]) < VIA_SPIKE_MATCH_MILES:
            i -= 1
            j += 1
        i, j = i + 1, j - 1
        if j - i <= 2:
            return coords, seg_miles, seg_hours
        gap = self.geo_utils.haversine_miles(coords[i], coords[j])
        return (
            coords[: i + 1] + coords[j:],
            seg_miles[:i] + [gap] + seg_miles[j:],
            seg_hours[:i] + [gap / TRUCK_MAX_MPH] + seg_hours[j:],
        )

    def _overlap(self, candidate, existing):
        probe = self.geo_utils.sample_every(candidate.coords, OVERLAP_PROBE_STEP_MILES)
        ref = self.geo_utils.sample_every(existing.coords, OVERLAP_REFERENCE_STEP_MILES)
        near = sum(1 for p in probe if any(self.geo_utils.haversine_miles(p, q) < OVERLAP_NEAR_MILES for q in ref))
        return near / len(probe)

    def _detour_points(self, origin, destination):
        straight = self.geo_utils.haversine_miles(origin, destination)
        heading = self.geo_utils.bearing(origin, destination)
        offset = min(DETOUR_MAX_OFFSET_MILES, max(DETOUR_MIN_OFFSET_MILES, straight * DETOUR_OFFSET_SHARE))
        for f in DETOUR_ALONG_FRACTIONS:
            along = self.geo_utils.offset_point(origin, heading, straight * f)
            for side in (90, -90):
                yield self.geo_utils.offset_point(along, (heading + side) % 360, offset)
