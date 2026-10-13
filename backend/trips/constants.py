"""Every fixed value used by the trips app.

Environment-dependent settings (API base URLs, Redis URL, timeouts) live in
config/settings.py instead.
"""

# ----------------------------------------------------------------------- units

EARTH_RADIUS_MI = 3958.8
METERS_PER_MILE = 1609.344
FT_PER_MILE = 5280

# ------------------------------------------------------------------- requests

INTERVAL_MILES_CHOICES = (10, 25, 50)
MAX_GROSS_WEIGHT_LBS = 80_000  # US federal gross vehicle weight limit
MAX_DEPARTURE_DAYS_AHEAD = 7  # leaves room for the trip inside the ~15-day forecast
DEPARTURE_GRACE_HOURS = 1  # how far in the past a departure may be
LOCATION_MAX_LENGTH = 200
# Origin/destination are city names ("Denver, CO", "St. Louis", "Coeur d'Alene"):
# letters, spaces and . , ' - only — no digits, so no coordinates or street addresses.
CITY_NAME_PATTERN = r"^[^\W\d_](?:[^\W\d_]|[ .,'’-])*$"
CITY_NAME_ERROR = 'Enter a city name, e.g. "Denver, CO" (letters, spaces and . , \' - only).'

# ------------------------------------------------------------------------ http

# Rate-limited (429) or briefly unavailable (503): wait and retry, honouring Retry-After
# when it is short. Keeps a plan well inside gunicorn's 120 s worker timeout.
HTTP_RETRY_STATUSES = (429, 503)
HTTP_RETRY_DELAYS_SECONDS = (3, 10)
HTTP_MAX_RETRY_AFTER_SECONDS = 15

# ------------------------------------------------------------------ geocoding

GEOCODE_CACHE_SECONDS = None  # never expires: a city's coordinates don't change
NOMINATIM_MIN_INTERVAL_SECONDS = 1.0  # Nominatim usage policy: max 1 request/second
GEOCODING_SERVICE = 'Geocoding service (Nominatim)'

# -------------------------------------------------------------------- routing

ROUTING_SERVICE = 'Routing service (OSRM)'
MAX_ROUTES = 3
ROUTE_IDS = 'ABC'
# OSRM's car profile drives at posted limits; heavy trucks are usually governed lower.
TRUCK_MAX_MPH = 65
# A synthesized detour is only offered if it isn't absurdly slow...
DETOUR_MAX_SLOWDOWN = 1.6
# ...and actually takes different roads (share of its length near an existing route).
DETOUR_MAX_OVERLAP = 0.75
DETOUR_OFFSET_SHARE = 0.18  # sideways offset of the via point, as a share of the trip
DETOUR_MIN_OFFSET_MILES = 25
DETOUR_MAX_OFFSET_MILES = 250
DETOUR_ALONG_FRACTIONS = (0.5, 0.35, 0.65)  # where along the trip to place via points
OVERLAP_PROBE_STEP_MILES = 5
OVERLAP_REFERENCE_STEP_MILES = 1.5
OVERLAP_NEAR_MILES = 2
VIA_SPIKE_MATCH_MILES = 0.03  # out-and-back vertices closer than this are a spike

# -------------------------------------------------------------------- weather

WEATHER_SERVICE = 'Weather service (Open-Meteo)'
# Forecast models are ~3–25 km, so nearby samples share one grid cell. This keeps
# a long trip at 10-mile checkpoints to a few hundred locations (Open-Meteo's free
# tier counts each location as one call).
WEATHER_GRID_DEG = 0.2
WEATHER_BATCH_SIZE = 100
WEATHER_MAX_PARALLEL = 1  # sequential batches: bursts trip Open-Meteo's per-minute limit
WEATHER_CACHE_SECONDS = 30 * 60
WEATHER_CACHE_VERSION = 'wx2'  # bump when HOURLY_VARS changes so stale entries are ignored
MAX_FORECAST_HOURS = 15 * 24
DEFAULT_VISIBILITY_MI = 10.0
HIGH_WIND_MPH = 30
GUST_WEIGHT = 0.75  # gusts are momentary, so they count a little less than sustained wind

HOURLY_VARS = (
    'temperature_2m',
    'precipitation',
    'rain',  # liquid rain (large-scale)
    'showers',  # liquid rain (convective)
    'snowfall',  # inches of snow, the unit the snow thresholds use
    'wind_speed_10m',
    'wind_gusts_10m',
    'visibility',
    'weather_code',
)

# WMO weather interpretation codes, as used by Open-Meteo.
WMO_CONDITIONS = {
    0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy',
    45: 'Fog', 48: 'Freezing Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    66: 'Freezing Rain', 67: 'Freezing Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
    80: 'Rain Showers', 81: 'Rain Showers', 82: 'Heavy Showers',
    85: 'Snow Showers', 86: 'Heavy Snow Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Thunderstorm with Hail',
}
SNOW_CODES = {71, 73, 75, 77, 85, 86}
ICE_CODES = {56, 57, 66, 67}
THUNDER_CODES = {95, 96, 99}
RAIN_CODE_RANGE = (51, 82)
CALM_CONDITIONS = {'Clear', 'Mostly Clear', 'Partly Cloudy', 'Cloudy'}
FREEZING_F = 32
MIN_PRECIP_IN_HR = 0.01

# ----------------------------------------------------------------------- risk
# Provided risk/load rules. A checkpoint's level is the worst of wind, rain and
# snow; load rules can only raise it.

RISK_LEVELS = ('low', 'moderate', 'high', 'severe', 'no_travel')  # mildest -> worst
RISK_LEVEL_LABELS = {
    'low': 'Low', 'moderate': 'Moderate', 'high': 'High', 'severe': 'Severe', 'no_travel': 'No Travel',
}
# Weighted risk score (0–1) per checkpoint: each input is scaled by its No Travel
# threshold (capped at 1) and weighted. Used for a route's average risk and the
# heatmap; the levels above still decide Low … No Travel.
RISK_SCORE_WEIGHTS = (  # (weather field, scale, weight)
    ('windMph', 55, 0.30),
    ('rainInHr', 1.0, 0.30),
    ('snowInHr', 3.0, 0.40),  # snow weighs more: less traction and it lingers on the road
)

# (level, threshold, inclusive) checked worst-first; below every threshold = low.
# Where the brief's ranges share an endpoint (e.g. rain 0.25), the higher level wins.
WIND_RULES = (  # sustained wind, mph
    ('no_travel', 55, True),  # ≥ 55
    ('severe', 45, True),  # 45–54
    ('high', 35, True),  # 35–44
    ('moderate', 25, True),  # 25–34
)
RAIN_RULES = (  # in/hr
    ('no_travel', 1.00, False),  # > 1.00
    ('severe', 0.50, True),  # 0.50–1.00
    ('high', 0.25, True),  # 0.25–0.50
    ('moderate', 0.10, True),  # 0.10–0.25
)
SNOW_RULES = (  # in/hr
    ('no_travel', 3.0, False),  # > 3.0
    ('severe', 2.0, True),  # 2.0–3.0
    ('high', 1.0, True),  # 1.0–2.0
    ('moderate', 0.5, True),  # 0.5–1.0
)
# (min mph, max mph, load must exceed lbs, resulting level)
LOAD_RULES = (
    (45, 54, 30_000, 'no_travel'),
    (35, 44, 40_000, 'severe'),
)

# ------------------------------------------------------------------- planning

HEATMAP_HOURS = 48
HEATMAP_CELLS = 12  # grid points along the corridor's longer side (each one is an Open-Meteo call)
HEATMAP_PAD_DEG = 1.0
DISPLAY_STEP_MILES = 0.5  # geometry resolution sent to the map
SAME_PLACE_MILES = 1
PLAN_CACHE_SECONDS = 60  # identical trip requests within a minute reuse the whole response
# Recommendation order: fewest miles at these levels (worst first), then lowest
# average risk, then shortest travel time. No Travel ranks above Severe.
RECOMMENDATION_LEVELS = ('no_travel', 'severe', 'high')
