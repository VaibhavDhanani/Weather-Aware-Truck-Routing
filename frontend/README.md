# Weather-Aware Truck Routing — frontend

React + Vite app using [react-map-gl](https://visgl.github.io/react-map-gl/) (MapLibre build, no token needed).

```bash
npm install
npm run dev      # http://localhost:5175, with the Django backend on :8010 (see ../backend/README.md)
```

## Backend connection

The dev server always runs on port 5175 and proxies `/api/*` to `http://127.0.0.1:8010` (`vite.config.js`), so no
configuration is needed. Optional environment variables:

- `VITE_API_BASE_URL` — API origin when it isn't proxied (e.g. a production deploy)
- `VITE_MAP_STYLE_URL` — any MapLibre style; defaults to CARTO Positron (no key)

The response shape is documented in `src/api/tripsApi.js` with a full example in
`src/api/sample-plan-response.json`.

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
- `src/components/` — `TripForm`, `RouteList`, `CheckpointTable`, `RouteMap`, `ForecastSlider`, `Legend`, `RiskDot`
- `src/maplibreWorker.js` — registers MapLibre's web worker with Vite (required for MapLibre v6)
- Styling is Tailwind CSS v4 (`@tailwindcss/vite`); theme colors are defined in `src/index.css`.
