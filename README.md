# Weather-Aware Truck Routing

A web app that helps a truck driver or dispatcher choose the safest route **before** the truck leaves.

Enter an origin city, a destination city, a departure time and the load weight. The app finds three
routes. It checks the hourly forecast at a checkpoint every 10, 25 or 50 miles, using the time the truck
will actually reach each checkpoint. It then rates each stretch from **Low** to **No Travel** and
recommends one route, with a reason.

- **Live app:** https://weather-aware-truck-routing-alpha.vercel.app
- **API:** https://weather-truck-api.onrender.com/api/health/

## What we built

| | Stack | Hosted on | Details |
|---|---|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v4, MapLibre (react-map-gl) | Vercel | [frontend/README.md](frontend/README.md) |
| **Backend** | Django 5, Django REST Framework, Redis, gunicorn | Render (+ Render Key Value for Redis) | [backend/README.md](backend/README.md) |

The React app is a single-page app with two pages: a landing page and the route planner. It sends one
request, `POST /api/trips/plan/`, and draws the response on a map. The Django API does all the work. It
geocodes the cities, gets the routes, fetches forecasts, scores the risk and picks a route. It caches
results in Redis. It has no database.

All external data comes from free services that need no API key:

- **OSRM** for routes
- **Nominatim** (OpenStreetMap) to turn city names into coordinates
- **Open-Meteo** for hourly forecasts

## How it works

```
React (Vercel)                 Django API (Render)                         Free services
──────────────                 ───────────────────                         ─────────────
TripForm ── POST /api/trips/plan/ ──► geocode origin + destination ───────► Nominatim
                                      3 route options ────────────────────► OSRM
                                      checkpoints + ETA every N miles
                                      hourly forecast at each ETA ────────► Open-Meteo
                                      risk per checkpoint → per route
                                      recommend + 48 h heatmap
Map, route cards, ◄── JSON ─────────── (Redis caches plans, cities, forecasts)
checkpoint table
```

The route is chosen in this order:

1. the fewest miles in **No Travel** weather, then **Severe**, then **High**;
2. then the lowest average risk score;
3. then the shortest drive time.

## Repository layout

```
frontend/   React + Vite app          → frontend/README.md
backend/    Django + DRF API          → backend/README.md
```

## Run locally

You need Node 20.19+, Python 3.10+ and a local Redis (`brew services start redis`).

```bash
# backend → http://127.0.0.1:8010
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py runserver

# frontend → http://localhost:5175
cd frontend
npm install
npm run dev
```

The frontend needs `VITE_API_BASE_URL` and `VITE_MAP_STYLE_URL` in `frontend/.env.local` (see
[frontend/README.md](frontend/README.md)). The backend works without any env file.

## Deployment

Both apps deploy automatically when you push to `main`.

- **Vercel** (`frontend/`):
  - Set `VITE_API_BASE_URL` to the Render URL, with no trailing slash.
  - Set `VITE_MAP_STYLE_URL`.
  - `vercel.json` sends every path to `index.html`.
- **Render** (`backend/`):
  - Build command: `pip install -r requirements.txt`.
  - Start command: `gunicorn config.wsgi --timeout 120`.
  - Set these env vars:
    - `DJANGO_SECRET_KEY`
    - `DJANGO_DEBUG=false`
    - `DJANGO_ALLOWED_HOSTS` (the bare host, no `https://`)
    - `CORS_ALLOWED_ORIGINS` (the Vercel URL)
    - `REDIS_URL` (the internal Key Value URL)
    - `HTTP_USER_AGENT`
  - Health check path: `/api/health/`.
