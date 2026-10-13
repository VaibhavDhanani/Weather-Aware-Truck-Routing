import math

from trips.constants import EARTH_RADIUS_MI


class GeoUtils:
    """Distance and polyline helpers. Points are (lon, lat) tuples."""

    def haversine_miles(self, a, b):
        """Great-circle distance in miles between two points."""
        lon1, lat1 = map(math.radians, a)
        lon2, lat2 = map(math.radians, b)
        h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
        return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(min(1.0, h)))

    def cumulative(self, values):
        """Running totals, starting at 0: [a, b] -> [0, a, a + b]."""
        out = [0.0]
        for v in values:
            out.append(out[-1] + v)
        return out

    def interpolate(self, cum, values, x):
        """Value at position `x`, where `values[i]` sits at running position `cum[i]`.

        `values` may hold numbers or (lon, lat) tuples.
        """
        if x <= cum[0]:
            return values[0]
        if x >= cum[-1]:
            return values[-1]
        lo, hi = 0, len(cum) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if cum[mid] <= x:
                lo = mid
            else:
                hi = mid
        span = cum[hi] - cum[lo]
        f = (x - cum[lo]) / span if span else 0.0
        a, b = values[lo], values[hi]
        if isinstance(a, tuple):
            return tuple(p + (q - p) * f for p, q in zip(a, b))
        return a + (b - a) * f

    def bounds(self, lines):
        """((min_lon, min_lat), (max_lon, max_lat)) covering every polyline."""
        lons = [p[0] for line in lines for p in line]
        lats = [p[1] for line in lines for p in line]
        return (min(lons), min(lats)), (max(lons), max(lats))

    def bearing(self, a, b):
        """Initial compass bearing in degrees from point a to point b."""
        lon1, lat1 = map(math.radians, a)
        lon2, lat2 = map(math.radians, b)
        x = math.sin(lon2 - lon1) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
        return math.degrees(math.atan2(x, y)) % 360

    def offset_point(self, origin, bearing_deg, distance_miles):
        """Point `distance_miles` from `origin` along `bearing_deg`."""
        lon, lat = map(math.radians, origin)
        d = distance_miles / EARTH_RADIUS_MI
        brg = math.radians(bearing_deg)
        lat2 = math.asin(math.sin(lat) * math.cos(d) + math.cos(lat) * math.sin(d) * math.cos(brg))
        lon2 = lon + math.atan2(
            math.sin(brg) * math.sin(d) * math.cos(lat), math.cos(d) - math.sin(lat) * math.sin(lat2)
        )
        return math.degrees(lon2), math.degrees(lat2)

    def sample_every(self, coords, step_miles):
        """Vertices roughly every `step_miles` along a polyline, always keeping both ends."""
        if not coords:
            return []
        out = [coords[0]]
        since = 0.0
        for a, b in zip(coords, coords[1:]):
            since += self.haversine_miles(a, b)
            if since >= step_miles:
                out.append(b)
                since = 0.0
        if out[-1] != coords[-1]:
            out.append(coords[-1])
        return out
