# Weather-Aware Truck Routing — backend

This is a Django + Django REST Framework API. For a truck trip it:
- finds three routes;
- forecasts the weather at each checkpoint for the time the truck will reach it;
- scores the risk for the truck's load;
- recommends the route with the best balance of safety and drive time.

The API is stateless. It has no database, no auth and no migrations. It only uses three free external
services, and Redis as a cache.

**Live:** https://weather-truck-api.onrender.com/api/health/

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver        # http://127.0.0.1:8010
```

It needs a running Redis (`brew services start redis` on macOS).

## External APIs used

All three services are free and need no API key.

| Service | Used for | Endpoint | Notes |
|---|---|---|---|
| [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) (OpenStreetMap) | City name → coordinates | `GET /search?q=…&featureType=city&limit=1` | At most 1 request/second (enforced in code). Needs a real `User-Agent` (`HTTP_USER_AGENT`). |
| [OSRM](https://project-osrm.org/docs/v5.24.0/api/) | Driving routes, road names, timing per segment | `GET /route/v1/driving/{lon,lat;…}?alternatives=3&steps=true&annotations=distance,duration` | Public demo server with a car profile. It doesn't know truck limits such as bridge heights or hazmat rules. |
| [Open-Meteo](https://open-meteo.com/en/docs) | Hourly forecast: temperature, rain, showers, snowfall, wind, gusts, visibility, weather code | `GET /v1/forecast` with up to 50 locations per request | The limit is per IP: about 600 calls/minute, 5,000/hour and 10,000/day. Each location counts as one call. |

`HttpUtils` sends every outgoing request through one shared session.
- It retries **429** and **503** twice: after 3 s, then after 10 s. If the server sends a short
  `Retry-After`, it waits that long instead.
- It retries a **timeout** once (`HTTP_TIMEOUT_RETRIES`). Each attempt waits up to `HTTP_TIMEOUT_SECONDS`.
- Any other failure becomes a `502` with a readable message. That message includes Open-Meteo's
  `reason` when one is given.

Free hosts like Render share outbound IP addresses. Because of that, Open-Meteo can return 429 even when
this app is idle. A paid Open-Meteo key (`customer-api.open-meteo.com` + `apikey`) avoids this.

## Core logic

`PlanTripUtils.plan_trip()` builds the whole response.

1. **Geocode** the origin and destination. Only city names are accepted (letters, spaces and `. , ' -`),
   so coordinates and street addresses are rejected with a 400.
2. **Find three routes.** OSRM usually returns one or two alternatives. To reach three, the API adds
   detours. It picks via points to either side of the straight line between the cities, and keeps a
   detour only if it meets both of these:
   - it is at most 1.6× slower than the fastest route;
   - no more than 75% of it runs alongside an existing route.

   Truck speed is capped at 65 mph, because OSRM's car profile drives at the posted limits.
3. **Place checkpoints** every 10, 25 or 50 miles. Each checkpoint gets an **ETA**, worked out from OSRM's
   timing for every segment.
4. **Fetch the forecast once** for every checkpoint and every heatmap point. Points are snapped to a
   0.2° grid, which is roughly the forecast models' resolution. Nearby checkpoints therefore share one
   forecast, and a long trip needs only a few hundred locations. Locations are fetched 50 at a time,
   one request after another, so each response stays small and fast. Every fetch covers at least 96
   hours, or longer if the trip needs it.
5. **Score each checkpoint** using the weather for the hour nearest its ETA.
   - **Level**: the worst level among wind, rain and snow (see the table below). The load rules can
     only raise it.
   - **Score (0–100)**: `min(wind/55, 1)·0.30 + min(rain/1.0, 1)·0.30 + min(snow/3, 1)·0.40`. Snow
     weighs more because it reduces traction and stays on the road.
6. **Score each route.**
   - The route's level is its worst checkpoint level.
   - Its score is the average of its checkpoint scores.
   - Miles are counted by level. Each stretch between two checkpoints counts at the worse level of its
     two ends.
7. **Recommend a route.** Routes are ranked by the fewest **No Travel** miles, then **Severe** miles,
   then **High** miles. Ties go to the lowest average score, then the shortest drive time. The
   response also names the fastest route, the safest route, and the rule that decided the
   recommendation.
8. **Build the heatmap.** It is a 12-point grid along the longer side of the corridor, with a weighted
   score for each hour from 0 to 48.

### Risk rules

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | < 25 | 25–34 | 35–44 | 45–54 | ≥ 55 |
| Rain (in/hr) | < 0.10 | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | > 1.00 |
| Snow (in/hr) | < 0.5 | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | > 3.0 |

**Load rules**
- Wind of 45–54 mph with a load over 30,000 lb → **No Travel**.
- Wind of 35–44 mph with a load over 40,000 lb → **Severe**.

Where two ranges share an endpoint, the value gets the higher level. All of these tables are in
`trips/constants.py`.

## Caching (Redis)

The cache has three layers, from the broadest to the most reused:

| What | Key | Expiry | Why |
|---|---|---|---|
| Whole plan response | `plan:<sha1 of cities, departure, load, interval>` | 60 s | A repeated request (refresh, double click) returns instantly. |
| City → coordinates | `geocode:<sha1 of city>` | never | A city doesn't move, and Nominatim allows only 1 request/second. |
| Hourly forecast per 0.2° grid cell | `wx3:<start hour>:<lon>:<lat>` | 30 min | Routes that overlap, and later trips through the same area in the same hour, reuse forecasts. Only missing cells are fetched. |

Forecasts are read with one `get_many` and stored with one `set_many`. The key has no trip length in
it. Every fetch covers at least `WEATHER_MIN_FETCH_HOURS` (96), so short and long trips share cells. A
cached cell that covers fewer hours than a trip needs is fetched again. The `wx3` prefix is
`WEATHER_CACHE_VERSION`. Bump it when the forecast variables or the key format change, so old entries
are ignored.

Every cache lookup is logged to stdout (Render → Logs):

```
INFO config.wsgi: Redis connected (red-xxxx)
INFO trips.utils.plan_trip_utils: Redis plan cache miss: Denver, CO -> Chicago, IL
INFO trips.utils.geocoding_utils: Redis geocode cache hit: Denver, CO
INFO trips.utils.weather_utils: Redis weather cache: 184 of 194 grid cells cached, fetching 10
```

If `REDIS_URL` is wrong, each gunicorn worker logs `ERROR config.wsgi: Redis unavailable (<host>)` at
startup, and requests fail with a 500.

## API

### `POST /api/trips/plan/`

```json
{
  "origin": "Denver, CO",
  "destination": "Chicago, IL",
  "departure": "2026-10-15T14:00:00Z",
  "loadWeightLbs": 42000,
  "intervalMiles": 25
}
```

| Field | Rule |
|---|---|
| `origin`, `destination` | City name, 2–200 characters, no digits |
| `departure` | ISO-8601, from 1 hour ago up to 7 days ahead |
| `loadWeightLbs` | 0–80,000 |
| `intervalMiles` | 10, 25 or 50 |

Response (shortened):

```json
{
  "origin": { "name": "Denver, CO", "label": "Denver, Colorado, United States", "lon": -104.98, "lat": 39.74 },
  "destination": { "...": "..." },
  "departure": "2026-10-15T14:00:00Z",
  "fastestRouteId": "A",
  "safestRouteId": "B",
  "recommendedRouteId": "B",
  "recommendationReason": "Fewest High miles (0 vs 53 on Route A).",
  "routes": [
    {
      "id": "A",
      "name": "via I 76, I 80",
      "summary": "…",
      "geometry": [[-104.98, 39.74], "…"],
      "distanceMiles": 1003,
      "durationMinutes": 925,
      "departure": "…",
      "arrival": "…",
      "riskLevel": "high",
      "riskScore": 21,
      "milesByLevel": { "low": 850, "moderate": 100, "high": 53, "severe": 0, "no_travel": 0 },
      "checkpoints": [
        {
          "index": 0, "mile": 0, "lon": -104.98, "lat": 39.74, "eta": "…", "inForecastWindow": true,
          "weather": { "tempF": 54, "windMph": 12, "gustMph": 20, "precipInHr": 0, "rainInHr": 0, "snowInHr": 0,
                       "precipType": "none", "visibilityMi": 10, "condition": "Clear", "weatherCode": 0 },
          "risk": { "level": "low", "score": 7, "factors": [] }
        }
      ]
    }
  ],
  "heatmap": {
    "forecastStart": "…",
    "hours": 48,
    "cellSizeDeg": 1.2,
    "points": [{ "lon": -105.9, "lat": 38.7, "values": [0.07, 0.08, "… 49 hourly scores"] }]
  }
}
```

Errors are always `{"detail": "..."}`. Validation errors also include `"errors"`.

| Status | When |
|---|---|
| 400 | Invalid input |
| 422 | City not found, no drivable route, or origin and destination are the same place |
| 502 | Nominatim, OSRM or Open-Meteo failed |

### `GET /api/health/`

Returns `{"status": "ok"}`. Use it as Render's health check path.

## Configuration

Every setting has a default that works locally. Override settings with environment variables, or with
`backend/.env.local`, which `settings.py` loads.

| Variable | Default | Production |
|---|---|---|
| `DJANGO_SECRET_KEY` | — | a random secret |
| `DJANGO_DEBUG` | `true` | `false` |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | `weather-truck-api.onrender.com` (bare host) |
| `CORS_ALLOWED_ORIGINS` | — (any localhost port is always allowed) | the Vercel URL |
| `REDIS_URL` | `redis://127.0.0.1:6379/1` | Render Key Value internal URL |
| `HTTP_USER_AGENT` | `weather-aware-truck-routing/0.1 (dev)` | the app name + a contact URL |
| `HTTP_TIMEOUT_SECONDS` | `30` | `30` |
| `OSRM_BASE_URL`, `NOMINATIM_BASE_URL`, `OPEN_METEO_BASE_URL` | the public servers | — |
| `DEV_SERVER_PORT` | `8010` | — |


## Code layout

```
config/                settings, urls (/api/ → trips.urls), wsgi (+ Redis startup check)
base/views.py          BaseViewSet: per-action request serializer, exception → status code, {"detail"} errors
trips/
├── constants.py       every fixed value
├── exceptions.py      LocationNotFound, RouteNotFound, TripPlanningError, ExternalServiceError
├── serializers.py     PlanTripRequestSerializer
├── views.py           TripViewSet (plan), HealthViewSet
├── urls.py            SimpleRouter → /api/trips/plan/, /api/health/
└── utils/
    ├── plan_trip_utils.py   PlanTripUtils   — builds the plan
    ├── geocoding_utils.py   GeocodingUtils  — Nominatim
    ├── routing_utils.py     RoutingUtils    — OSRM + detours
    ├── weather_utils.py     WeatherUtils    — Open-Meteo + forecast cache
    ├── risk_utils.py        RiskUtils       — checkpoint / route risk, ranking
    ├── geo_utils.py         GeoUtils        — distance and polyline math
    └── http_utils.py        HttpUtils       — JSON GET, retries, errors
```
