# Weather-Aware Truck Routing — frontend

This is the React app for planning a truck trip and seeing which route has the safest weather. It is
built with React 19, Vite, Tailwind CSS v4 and MapLibre (through [react-map-gl](https://visgl.github.io/react-map-gl/)).
The map does not need a token.

**Live:** https://weather-aware-truck-routing-alpha.vercel.app

> Screenshots live in `docs/images/`. Add the files named below and they will show up here.

## Landing page (`/`)

![Landing page](docs/images/landing.png)

The landing page loads quickly because it doesn't include the map library. It shows:
- a short explanation of what the app does
- the five risk levels
- a **Plan a route** button

## Route planner (`/plan`)

![Route planner](docs/images/planner.png)

### 1. Plan a trip

![Trip form](docs/images/trip-form.png)

Fill in:
- **Origin** and **destination**: city names only, with suggestions while you type, e.g. `Denver, CO`
- **Departure** time: up to 7 days ahead
- **Load** weight: 0 to 80,000 lb
- **Checkpoint** interval: 10, 25 or 50 miles

The form checks the inputs in the browser using the same rules as the backend.

### 2. Compare three routes

![Route cards](docs/images/route-cards.png)

Each route card shows:
- distance and drive time
- the worst weather on the route
- a bar showing how many miles fall in each risk level

The cards are tagged **Recommended**, **Fastest** and **Safest**. The reason for the recommendation is shown
above them.

### 3. Explore the map

![Map with routes and checkpoints](docs/images/map.png)

- All three routes are drawn in their own colors. Click a route to select it.
- Checkpoints are colored by risk. Click one to see its temperature, wind, rain, snow, visibility and ETA.
- A truck marker shows where the truck is at the selected forecast hour.

### 4. Weather heatmap and forecast slider

![Heatmap and forecast slider](docs/images/heatmap.png)

- The heatmap shows the weather risk score along the corridor for the next 48 hours.
- Use the slider, or press play, to move through the hours.
- The heatmap can be turned off.

### 5. Checkpoint table

![Checkpoint table](docs/images/checkpoints.png)

The table lists every checkpoint on the selected route with its mile, ETA, weather, wind and risk.
Click a row to fly the map to that checkpoint.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5175 (backend on :8010, see ../backend/README.md)
npm run build     # production build in dist/
npm run preview   # serve dist/ on :5175
npm run lint      # oxlint
```

## Environment variables

Both are required. Set them in `.env.local` for local work and in the Vercel dashboard for production.
Vite builds them into the bundle, so redeploy after you change them.

| Variable | Example |
|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8010` locally, `https://weather-truck-api.onrender.com` in production (no trailing slash) |
| `VITE_MAP_STYLE_URL` | `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` (CARTO Positron, no key) |

## How it is built

- **Routing without a router.** `src/App.jsx` picks the page from `window.location.pathname`, and the
  pages link to each other with plain `<a href>`. `vercel.json` serves `index.html` for every path, so
  `/plan` works when opened directly.
- **Small first load.** `PlanPage` is lazy-loaded, and MapLibre (~1 MB) is in its own chunk, so the
  landing page downloads about 72 kB (gzipped).
- **One API call.** `src/api/tripsApi.js` sends `POST /api/trips/plan/` and turns failures into readable
  messages. The response shape is described in [../backend/README.md](../backend/README.md#api).
- **Map layers.** The routes, checkpoints and heatmap are GeoJSON sources with MapLibre layers, built in
  `src/utils/mapUtils.js`.

## Code layout

```
src/
├── App.jsx              picks LandingPage or PlanPage from the URL
├── constants.js         every fixed value: API URL, form limits, city suggestions, risk levels, map/heatmap settings
├── maplibreWorker.js    registers MapLibre's web worker with Vite
├── index.css            Tailwind import + theme colors and the `desk` breakpoint
├── api/tripsApi.js      planTrip()
├── pages/               LandingPage, PlanPage
├── components/          TripForm, RouteList, RouteMap, CheckpointTable, ForecastSlider, Legend, RiskDot
└── utils/
    ├── formatUtils.js      durations, miles, times
    ├── geoUtils.js         distance, point along a polyline, bounds
    ├── routeUtils.js       route colors, chip position, truck position at a time
    ├── riskUtils.js        risk level labels and colors
    ├── validationUtils.js  city-name check (same rule as the backend)
    └── mapUtils.js         MapLibre layer styles and GeoJSON builders
```
