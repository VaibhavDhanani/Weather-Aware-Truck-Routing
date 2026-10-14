EARTH_RADIUS_MI = 3958.8
METERS_PER_MILE = 1609.344
FT_PER_MILE = 5280

INTERVAL_MILES_CHOICES = (10, 25, 50)
MAX_GROSS_WEIGHT_LBS = 80_000
MAX_DEPARTURE_DAYS_AHEAD = 7
DEPARTURE_GRACE_HOURS = 1
LOCATION_MAX_LENGTH = 200
CITY_NAME_PATTERN = r"^[^\W\d_](?:[^\W\d_]|[ .,'’-])*$"
CITY_NAME_ERROR = 'Enter a city name, e.g. "Denver, CO" (letters, spaces and . , \' - only).'

HTTP_RETRY_STATUSES = (429, 503)
HTTP_RETRY_DELAYS_SECONDS = (3, 10)
HTTP_MAX_RETRY_AFTER_SECONDS = 15
HTTP_TIMEOUT_RETRIES = 1

GEOCODE_CACHE_SECONDS = None
NOMINATIM_MIN_INTERVAL_SECONDS = 1.0
GEOCODING_SERVICE = 'Geocoding service (Nominatim)'

ROUTING_SERVICE = 'Routing service (OSRM)'
MAX_ROUTES = 3
ROUTE_IDS = 'ABC'
TRUCK_MAX_MPH = 65
DETOUR_MAX_SLOWDOWN = 1.6
DETOUR_MAX_OVERLAP = 0.75
DETOUR_OFFSET_SHARE = 0.18
DETOUR_MIN_OFFSET_MILES = 25
DETOUR_MAX_OFFSET_MILES = 250
DETOUR_ALONG_FRACTIONS = (0.5, 0.35, 0.65)
OVERLAP_PROBE_STEP_MILES = 5
OVERLAP_REFERENCE_STEP_MILES = 1.5
OVERLAP_NEAR_MILES = 2
VIA_SPIKE_MATCH_MILES = 0.03

WEATHER_SERVICE = 'Weather service (Open-Meteo)'
WEATHER_GRID_DEG = 0.2
WEATHER_BATCH_SIZE = 50
WEATHER_MAX_PARALLEL = 1
WEATHER_CACHE_SECONDS = 30 * 60
WEATHER_CACHE_VERSION = 'wx3'  # bump when HOURLY_VARS changes
# Every fetch covers at least this window so trips of different lengths share cached cells.
WEATHER_MIN_FETCH_HOURS = 96
MAX_FORECAST_HOURS = 15 * 24
DEFAULT_VISIBILITY_MI = 10.0
HIGH_WIND_MPH = 30
GUST_WEIGHT = 0.75

HOURLY_VARS = (
    'temperature_2m',
    'precipitation',
    'rain',
    'showers',
    'snowfall',
    'wind_speed_10m',
    'wind_gusts_10m',
    'visibility',
    'weather_code',
)

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

RISK_LEVELS = ('low', 'moderate', 'high', 'severe', 'no_travel')
RISK_LEVEL_LABELS = {
    'low': 'Low', 'moderate': 'Moderate', 'high': 'High', 'severe': 'Severe', 'no_travel': 'No Travel',
}
RISK_SCORE_WEIGHTS = (  # (weather field, scale, weight)
    ('windMph', 55, 0.30),
    ('rainInHr', 1.0, 0.30),
    ('snowInHr', 3.0, 0.40),
)

# (level, threshold, inclusive), checked worst-first; below every threshold is low
WIND_RULES = (
    ('no_travel', 55, True),
    ('severe', 45, True),
    ('high', 35, True),
    ('moderate', 25, True),
)
RAIN_RULES = (
    ('no_travel', 1.00, False),
    ('severe', 0.50, True),
    ('high', 0.25, True),
    ('moderate', 0.10, True),
)
SNOW_RULES = (
    ('no_travel', 3.0, False),
    ('severe', 2.0, True),
    ('high', 1.0, True),
    ('moderate', 0.5, True),
)
# (min mph, max mph, load must exceed lbs, resulting level)
LOAD_RULES = (
    (45, 54, 30_000, 'no_travel'),
    (35, 44, 40_000, 'severe'),
)

HEATMAP_HOURS = 48
HEATMAP_CELLS = 12
HEATMAP_PAD_DEG = 1.0
DISPLAY_STEP_MILES = 0.5
SAME_PLACE_MILES = 1
PLAN_CACHE_SECONDS = 60
RECOMMENDATION_LEVELS = ('no_travel', 'severe', 'high')
