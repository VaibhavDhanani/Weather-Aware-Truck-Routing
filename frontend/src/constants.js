export const EARTH_RADIUS_MI = 3958.8
export const HOUR_MS = 3_600_000

// Backend origin without a trailing slash, e.g. http://127.0.0.1:8010
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
export const PLAN_TRIP_URL = `${API_BASE_URL}/api/trips/plan/`

export const HOME_PATH = '/'
export const PLAN_PATH = '/plan'

export const INTERVAL_MILES_CHOICES = [10, 25, 50]
export const MAX_GROSS_WEIGHT_LBS = 80_000
export const LOAD_STEP_LBS = 500

export const DEFAULT_TRIP = {
  origin: 'Denver, CO',
  destination: 'Chicago, IL',
  loadWeightLbs: 42_000,
  intervalMiles: 25,
}

export const CITY_NAME_PATTERN = /^\p{L}[\p{L} .,'’-]*$/u
export const CITY_NAME_MIN_LENGTH = 2
export const CITY_NAME_MAX_LENGTH = 200
export const CITY_NAME_ERROR = 'Enter a city name, e.g. "Denver, CO" (letters, spaces and . , \' - only).'

export const CITY_SUGGESTIONS = [
  'Albany, NY', 'Albuquerque, NM', 'Amarillo, TX', 'Atlanta, GA', 'Austin, TX', 'Bangor, ME', 'Billings, MT',
  'Birmingham, AL', 'Bismarck, ND', 'Boise, ID', 'Boston, MA', 'Buffalo, NY', 'Burlington, VT', 'Charlotte, NC',
  'Cheyenne, WY', 'Chicago, IL', 'Cincinnati, OH', 'Cleveland, OH', 'Columbus, OH', 'Corpus Christi, TX',
  'Dallas, TX', 'Denver, CO', 'Des Moines, IA', 'Detroit, MI', 'Duluth, MN', 'El Paso, TX', 'Eugene, OR',
  'Fargo, ND', 'Flagstaff, AZ', 'Fresno, CA', 'Great Falls, MT', 'Green Bay, WI', 'Houston, TX',
  'Indianapolis, IN', 'Jackson, MS', 'Jacksonville, FL', 'Kansas City, MO', 'Key West, FL', 'Laredo, TX',
  'Las Vegas, NV', 'Little Rock, AR', 'Los Angeles, CA', 'Louisville, KY', 'Memphis, TN', 'Miami, FL',
  'Milwaukee, WI', 'Minneapolis, MN', 'Missoula, MT', 'Nashville, TN', 'New Orleans, LA', 'New York, NY',
  'Oklahoma City, OK', 'Omaha, NE', 'Orlando, FL', 'Philadelphia, PA', 'Phoenix, AZ', 'Pittsburgh, PA',
  'Portland, ME', 'Portland, OR', 'Raleigh, NC', 'Rapid City, SD', 'Reno, NV', 'Richmond, VA', 'Sacramento, CA',
  'Salt Lake City, UT', 'San Antonio, TX', 'San Diego, CA', 'San Francisco, CA', 'Savannah, GA', 'Seattle, WA',
  'Shreveport, LA', 'Sioux Falls, SD', 'Spokane, WA', 'St. Louis, MO', 'Tampa, FL', 'Tucson, AZ', 'Tulsa, OK',
  'Vancouver, BC', 'Washington, DC', 'Wichita, KS',
]

export const RISK_LEVELS = [
  { key: 'low', label: 'Low', color: '#2f9e5b' },
  { key: 'moderate', label: 'Moderate', color: '#d4a106' },
  { key: 'high', label: 'High', color: '#e8590c' },
  { key: 'severe', label: 'Severe', color: '#c92a2a' },
  { key: 'no_travel', label: 'No Travel', color: '#7b1fa2' },
]

export const RECOMMENDATION_LEVELS = ['no_travel', 'severe', 'high']

export const ROUTE_COLORS = { A: '#2563eb', B: '#8b3fd9', C: '#0e8fa3' }
export const FALLBACK_ROUTE_COLOR = '#475569'

export const ROUTE_LABEL_POSITION = 0.4

export const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL
export const INITIAL_VIEW_STATE = { longitude: -97.5, latitude: 39, zoom: 3.6 }
export const CLICKABLE_LAYER_IDS = ['route-line', 'checkpoint-dots']

export const FIT_BOUNDS_OPTIONS = { padding: { top: 60, bottom: 140, left: 60, right: 60 }, duration: 900 }
export const CHECKPOINT_MIN_ZOOM = 6.5
export const FLY_DURATION_MS = 800

export const HEATMAP_MIN_SCORE = 0.12
export const HEATMAP_KERNEL_CELLS = 1.8
export const HEATMAP_INTENSITY = 0.8
export const HEATMAP_OPACITY = 0.7
export const HEATMAP_COLOR_STOPS = [
  [0, 'rgba(0,0,0,0)'],
  [0.1, 'rgba(47,158,91,0.3)'],
  [0.3, 'rgba(212,161,6,0.5)'],
  [0.6, 'rgba(232,89,12,0.62)'],
  [0.9, 'rgba(201,42,42,0.72)'],
]

export const FORECAST_HOURS = 48
export const FORECAST_TICK_HOURS = [0, 12, 24, 36, 48]
export const FORECAST_PLAY_INTERVAL_MS = 700
