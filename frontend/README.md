# Weather-Aware Truck Routing — frontend

React + Vite app using [react-map-gl](https://visgl.github.io/react-map-gl/) (MapLibre build, no token needed).

```bash
npm install
npm run dev      # http://localhost:5175, with the Django backend on :8010 (see ../backend/README.md)
```

## Backend connection

The dev server always runs on port 5175. Set both variables in `.env.local` locally and in the Vercel
dashboard in production (Vite bakes them in at build time, so redeploy after changing them):

- `VITE_API_BASE_URL` — API origin, e.g. `http://127.0.0.1:8010` locally or the Render URL in production
- `VITE_MAP_STYLE_URL` — any MapLibre style, e.g. CARTO Positron
  `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` (no key)

The response shape is documented in `src/api/tripsApi.js`.

## Pages

- `/` — landing page (`src/pages/LandingPage.jsx`), small and loads instantly
- `/plan` — the route planner (`src/pages/PlanPage.jsx`), lazy-loaded with MapLibre in its own chunk

`src/App.jsx` picks the page from the URL path; the pages link with plain `<a href>`.
`vercel.json` serves `index.html` for every path so `/plan` works when opened directly.

## Code layout

Same shape as the backend: one constants file, small utils modules per concern, components only render.

- `src/constants.js` — every fixed value (API URL, form limits, city suggestions, risk levels, map and heatmap
  settings). Values that mirror the backend name their counterpart in `backend/trips/constants.py`.
- `src/api/tripsApi.js` — `planTrip()`, the one backend call
- `src/utils/`
  - `formatUtils.js` — durations, miles, times, datetime-local values
  - `geoUtils.js` — haversine distance, points along a polyline, bounds
  - `routeUtils.js` — route colors, route chip position, truck position at a time
  - `riskUtils.js` — risk level labels and colors
  - `validationUtils.js` — city-name check (same rule as the backend)
  - `mapUtils.js` — MapLibre layer styles and the GeoJSON for routes, checkpoints and the heatmap
- `src/pages/` — `LandingPage`, `PlanPage`
- `src/components/` — `TripForm`, `RouteList`, `CheckpointTable`, `RouteMap`, `ForecastSlider`, `Legend`, `RiskDot`
- `src/maplibreWorker.js` — registers MapLibre's web worker with Vite (required for MapLibre v6)
- Styling is Tailwind CSS v4 (`@tailwindcss/vite`); theme colors are defined in `src/index.css`.
