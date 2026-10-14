# Weather-Aware Truck Routing — frontend

This is the React app for planning a truck trip and seeing which route has the safest weather. It is
built with React 19, Vite, Tailwind CSS v4 and MapLibre (through [react-map-gl](https://visgl.github.io/react-map-gl/)).
The map does not need a token.

**Live:** https://weather-aware-truck-routing-alpha.vercel.app

## Landing page

<img width="1259" height="864" alt="image" src="https://github.com/user-attachments/assets/61c67a46-907d-4b3d-a441-157de85903da" />


The landing page loads quickly because it doesn't include the map library. It shows:
- a short explanation of what the app does
- the five risk levels
- a **Plan a route** button

## Route planner

<img width="1444" height="867" alt="image" src="https://github.com/user-attachments/assets/a41906db-28d8-4ffa-9686-291e5e088162" />


### 1. Plan a trip

<img width="398" height="873" alt="image" src="https://github.com/user-attachments/assets/18ee74ad-8547-4573-9a94-f3cd5c5f2195" />

Fill in:
- **Origin** and **destination**: city names only, with suggestions while you type, e.g. `Denver, CO`
- **Departure** time: up to 7 days ahead
- **Load** weight: 0 to 80,000 lb
- **Checkpoint** interval: 10, 25 or 50 miles

The form checks the inputs in the browser using the same rules as the backend.

### 2. Compare three routes
<img width="383" height="737" alt="image" src="https://github.com/user-attachments/assets/a59a2d76-8126-4c2b-8ed0-672f44eccabe" />


Each route card shows:
- distance and drive time
- the worst weather on the route
- a bar showing how many miles fall in each risk level

The cards are tagged **Recommended**, **Fastest** and **Safest**. The reason for the recommendation is shown
above them.

### 3. Explore the map

<img width="1441" height="861" alt="image" src="https://github.com/user-attachments/assets/1856dc26-cc55-42b1-b99f-0316aaddb06d" />


- All three routes are drawn in their own colors. Click a route to select it.
- Checkpoints are colored by risk. Click one to see its temperature, wind, rain, snow, visibility and ETA.
- A truck marker shows where the truck is at the selected forecast hour.

### 4. Weather heatmap and forecast slider

<img width="165" height="181" alt="image" src="https://github.com/user-attachments/assets/faaab3a9-4c4e-46c9-9c39-b8faa5e53d66" />
<img width="570" height="102" alt="image" src="https://github.com/user-attachments/assets/afeb7c91-5154-49cc-a5f0-6163921eab5d" />


- The heatmap shows the weather risk score along the corridor for the next 48 hours.
- Use the slider, or press play, to move through the hours.
- The heatmap can be turned off.

### 5. Checkpoint table

<img width="391" height="359" alt="image" src="https://github.com/user-attachments/assets/be4cb3aa-092b-46fa-8603-60c0ac4d8355" />
<img width="461" height="456" alt="image" src="https://github.com/user-attachments/assets/54681fa7-2acf-4ee3-9ee0-18f4fcf928c5" />

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

| Variable | Example |
|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8010` |
| `VITE_MAP_STYLE_URL` | `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` |


## Code layout

```
src/
├── App.jsx              
├── constants.js         
├── maplibreWorker.js    
├── index.css            
├── api/tripsApi.js      
├── pages/              
├── components/          
└── utils/
    ├── formatUtils.js      
    ├── geoUtils.js         
    ├── routeUtils.js       
    ├── riskUtils.js        
    ├── validationUtils.js  
    └── mapUtils.js        
```
