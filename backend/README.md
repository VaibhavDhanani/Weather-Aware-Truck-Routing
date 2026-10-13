# Weather-Aware Truck Routing — backend

Django + Django REST Framework API that plans three truck routes, samples the
forecast at each checkpoint's ETA, scores weather risk for the load, and
recommends the best balance of risk and drive time.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver        # defaults to port 8010
.venv/bin/python manage.py test             # offline; external APIs are faked
```

Requires a running **Redis** (the cache; default `redis://127.0.0.1:6379/1`,
override with `REDIS_URL`). On macOS: `brew services start redis`. Tests use an
in-memory cache instead.

No API keys are required. Every setting has a working default in
`config/settings.py` and can be overridden with environment variables or a
`backend/.env` file (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`,
`CORS_ALLOWED_ORIGINS`, `OSRM_BASE_URL`, `NOMINATIM_BASE_URL`,
`OPEN_METEO_BASE_URL`, `HTTP_USER_AGENT`, `HTTP_TIMEOUT_SECONDS`, `REDIS_URL`,
`DEV_SERVER_PORT`). Every other fixed value lives in `trips/constants.py`.

## API

`POST /api/trips/plan/`

```json
{ "origin": "Denver, CO", "destination": "Chicago, IL",
  "departure": "2026-10-12T20:00:00Z", "loadWeightLbs": 42000, "intervalMiles": 25 }
```

- `origin` / `destination`: city names only, e.g. `"Denver, CO"` (letters, spaces and
  `. , ' -`; no digits, so coordinates and street addresses are rejected with 400)
- `departure`: ISO-8601, from 1 hour ago up to 7 days ahead
- `loadWeightLbs`: 0–80,000 · `intervalMiles`: 10, 25 or 50

Response shape: `frontend/src/api/tripsApi.js`; full example:
`frontend/src/api/sample-plan-response.json`. Errors are `{"detail": "..."}` with
400 (bad input), 422 (place/route not found) or 502 (an upstream API failed).

`GET /api/health/` → `{"status": "ok"}`

## Code layout

```
base/views.py          BaseViewSet: per-action request serializer, exception → status mapping,
                       {"detail": ...} error format
trips/
├── constants.py       every fixed value (limits, thresholds, risk tables, grid sizes…)
├── exceptions.py      LocationNotFound, RouteNotFound, TripPlanningError, ExternalServiceError
├── serializers.py     PlanTripRequestSerializer (city-name validation)
├── views.py           TripViewSet (@action plan), HealthViewSet
├── urls.py            SimpleRouter → /api/trips/plan/, /api/health/
└── utils/
    ├── plan_trip_utils.py   PlanTripUtils — builds the whole response, using:
    ├── geocoding_utils.py   GeocodingUtils — city → coordinates (Nominatim, cities only)
    ├── routing_utils.py     RoutingUtils   — 3 route options (OSRM + detours)
    ├── weather_utils.py     WeatherUtils   — hourly forecast (Open-Meteo)
    ├── risk_utils.py        RiskUtils      — risk score per checkpoint / route
    ├── geo_utils.py         GeoUtils       — distance and polyline math
    └── http_utils.py        HttpUtils      — JSON GET with uniform errors
```

A new endpoint is an action on a `BaseViewSet` subclass: register its serializer in
`action_to_request_serializer_class`, call `self.get_validated_data()`, and map domain
exceptions in `exception_status_codes` (e.g. `{LocationNotFound: 422}`).

## How a plan is built

| Step | Class | Source |
|---|---|---|
| Geocode origin/destination | `GeocodingUtils` | Nominatim, `featureType=city` (cached 7 days in Redis, ≤ 1 req/s) |
| 3 route options | `RoutingUtils` | OSRM alternatives; if fewer than 3, adds detours via side waypoints (rejects ones > 60% slower or mostly overlapping). Truck speed capped at 65 mph. |
| Checkpoints + ETAs | `PlanTripUtils` | every 10/25/50 mi, ETA from OSRM per-segment timings |
| Hourly forecast | `WeatherUtils` | Open-Meteo, points snapped to a 0.2° grid, ≤ 100 per request, cached 30 min in Redis |
| Risk per checkpoint | `RiskUtils` | Level = worst of wind/rain/snow thresholds, raised by load rules; score = wind/55·0.30 + rain/1.0·0.30 + snow/3·0.40 |
| Recommendation | `RiskUtils` / `PlanTripUtils` | fewest No Travel → Severe → High miles, then lowest average score, then shortest time |
| 0–48 h heatmap | `PlanTripUtils` | ~16×16 grid over the corridor, weighted score per hour |

## Caching (Redis)

| What | Key | Expiry |
|---|---|---|
| Whole plan response for an identical request (cities, departure, load, interval) | `plan:<hash>` | 60 s (`PLAN_CACHE_SECONDS`) |
| City → coordinates | `geocode:<hash>` | never (`GEOCODE_CACHE_SECONDS = None`) |
| Hourly forecast per 0.2° grid cell | `wx2:<hour>:…` | 30 min |

## Risk rules

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | < 25 | 25–34 | 35–44 | 45–54 | ≥ 55 |
| Rain (in/hr) | < 0.10 | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | > 1.00 |
| Snow (in/hr) | < 0.5 | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | > 3.0 |

Load rules: 45–54 mph with > 30,000 lb → No Travel; 35–44 mph with > 40,000 lb → Severe.
Shared range endpoints go to the higher level. Route miles at each level count each
stretch between checkpoints at its worse end. Tables live in `trips/constants.py`.

## Limits of the free public services

- **OSRM demo server** (`router.project-osrm.org`): car profile (no truck
  restrictions such as bridge heights or hazmat), fair-use only. Self-host OSRM
  or switch providers for production.
- **Nominatim**: max 1 request/second and no autocomplete use. Put a contact
  email in `HTTP_USER_AGENT` for anything beyond local development.
- **Open-Meteo**: free for non-commercial use, ~10,000 location-calls/day. A
  long trip uses a few hundred (cached for 30 minutes). Commercial use needs
  their paid API key (`apikey` parameter + `customer-api.open-meteo.com`).
