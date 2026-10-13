# Weather-Aware Truck Routing — frontend

React + Vite app using [react-map-gl](https://visgl.github.io/react-map-gl/) (MapLibre build, no token needed).

```bash
npm install
npm run dev      # http://localhost:5175, with the Django backend on :8010 (see ../backend/README.md)
```

## Backend connection

The dev server always runs on port 5175 and proxies `/api/*` to `http://localhost:8010` (`vite.config.js`), so no
configuration is needed. Optional environment variables:

- `VITE_API_BASE_URL` — API origin when it isn't proxied (e.g. a production deploy)
- `VITE_DEMO_MODE=true` — skip the backend and plan trips in the browser with
  `src/mock/planTrip.js` (fixed city list, synthetic storms)
- `VITE_MAP_STYLE_URL` — any MapLibre style; defaults to CARTO Positron (no key)

The response shape is documented in `src/api/client.js` with a full example in
`src/api/sample-plan-response.json`.

## Layout

- `src/components/RouteMap.jsx` — map: routes, risk-colored checkpoints, popups, route chips,
  truck position at the forecast hour, weather heatmap layer
- `src/components/ForecastSlider.jsx` — 0–48 h forecast slider with play/pause
- `src/components/TripForm.jsx`, `RouteList.jsx`, `CheckpointTable.jsx`, `Legend.jsx`
- `src/lib/risk.js` — risk levels + **placeholder** risk/load rules (to be replaced by the provided rules)
- `src/lib/maplibreWorker.js` — registers MapLibre's web worker with Vite (required for MapLibre v6)
