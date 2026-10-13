import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Popup, ScaleControl, Source } from 'react-map-gl/maplibre'
import { boundsOf, cumulativeMiles, pointAtMile, positionAtTime } from '../lib/geo'
import { formatDuration, formatTime } from '../lib/format'
import { RISK_COLOR, riskLabel } from '../lib/risk'
import { routeColor } from '../lib/routeColors'

const MAP_STYLE =
  import.meta.env.VITE_MAP_STYLE_URL ?? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const INITIAL_VIEW = { longitude: -97.5, latitude: 39, zoom: 3.6 }
const INTERACTIVE_LAYERS = ['route-line', 'checkpoint-dots']

const riskColorExpr = [
  'match',
  ['get', 'level'],
  'low', RISK_COLOR.low,
  'moderate', RISK_COLOR.moderate,
  'high', RISK_COLOR.high,
  'severe', RISK_COLOR.severe,
  'no_travel', RISK_COLOR.no_travel,
  '#888',
]

function heatmapLayer(cellSizeDeg) {
  // Keep the kernel ~1.8 grid cells wide at every zoom so the field stays
  // continuous: pixels per degree double with each zoom level.
  const r0 = cellSizeDeg * (512 / 360) * 1.8
  return {
    id: 'weather-heat',
    type: 'heatmap',
    paint: {
      'heatmap-weight': ['get', 'w'],
      'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, r0, 12, r0 * 4096],
      'heatmap-intensity': 0.8,
      'heatmap-opacity': 0.7,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)',
        0.1, 'rgba(47,158,91,0.3)',
        0.3, 'rgba(212,161,6,0.5)',
        0.6, 'rgba(232,89,12,0.62)',
        0.9, 'rgba(201,42,42,0.72)',
      ],
    },
  }
}

export default function RouteMap({
  plan,
  selectedRouteId,
  onSelectRoute,
  forecastTime,
  hour,
  showHeatmap,
  activeCheckpoint,
  onActiveCheckpointChange,
}) {
  const mapRef = useRef(null)
  const [cursor, setCursor] = useState('')

  const selectedRoute = plan?.routes.find((r) => r.id === selectedRouteId)

  useEffect(() => {
    if (!plan || !mapRef.current) return
    mapRef.current.fitBounds(boundsOf(plan.routes.map((r) => r.geometry)), {
      padding: { top: 60, bottom: 140, left: 60, right: 60 },
      duration: 900,
    })
  }, [plan])

  useEffect(() => {
    if (activeCheckpoint?.fly && mapRef.current) {
      mapRef.current.flyTo({
        center: [activeCheckpoint.lon, activeCheckpoint.lat],
        zoom: Math.max(mapRef.current.getZoom(), 6.5),
        duration: 800,
      })
    }
  }, [activeCheckpoint])

  const routesData = useMemo(
    () =>
      plan && {
        type: 'FeatureCollection',
        features: plan.routes.map((r) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: r.geometry },
          properties: { id: r.id, color: routeColor(r.id), selected: r.id === selectedRouteId },
        })),
      },
    [plan, selectedRouteId],
  )

  const checkpointsData = useMemo(
    () =>
      selectedRoute && {
        type: 'FeatureCollection',
        features: selectedRoute.checkpoints.map((c) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: { index: c.index, level: c.risk.level },
        })),
      },
    [selectedRoute],
  )

  const heatData = useMemo(
    () =>
      plan && {
        type: 'FeatureCollection',
        features: plan.heatmap.points.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { w: p.values[hour] < 0.12 ? 0 : p.values[hour] },
        })),
      },
    [plan, hour],
  )

  const heatLayer = useMemo(() => plan && heatmapLayer(plan.heatmap.cellSizeDeg), [plan])

  // Label each route about 40% of the way along so the chips don't stack on the endpoints.
  const routeLabels = useMemo(
    () =>
      plan?.routes.map((r) => {
        const cum = cumulativeMiles(r.geometry)
        const [lon, lat] = pointAtMile(r.geometry, cum, cum.at(-1) * 0.4)
        return { route: r, lon, lat }
      }) ?? [],
    [plan],
  )

  const truckPosition = selectedRoute ? positionAtTime(selectedRoute, forecastTime) : null

  const popupCheckpoint =
    activeCheckpoint && selectedRoute?.id === activeCheckpoint.routeId
      ? selectedRoute.checkpoints[activeCheckpoint.index]
      : null

  function handleClick(e) {
    const feature = e.features?.[0]
    if (!feature) {
      onActiveCheckpointChange(null)
      return
    }
    if (feature.layer.id === 'checkpoint-dots') {
      const cp = selectedRoute.checkpoints[feature.properties.index]
      onActiveCheckpointChange({ routeId: selectedRoute.id, index: cp.index, lon: cp.lon, lat: cp.lat, fly: false })
    } else if (feature.layer.id === 'route-line') {
      onSelectRoute(feature.properties.id)
    }
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      mapStyle={MAP_STYLE}
      interactiveLayerIds={plan ? INTERACTIVE_LAYERS : []}
      onClick={handleClick}
      onMouseEnter={() => setCursor('pointer')}
      onMouseLeave={() => setCursor('')}
      cursor={cursor}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl position="top-right" />
      <ScaleControl position="bottom-right" unit="imperial" />

      {plan && (
        <>
          <Source id="weather" type="geojson" data={heatData}>
            <Layer {...heatLayer} layout={{ visibility: showHeatmap ? 'visible' : 'none' }} />
          </Source>

          <Source id="routes" type="geojson" data={routesData}>
            <Layer
              id="route-casing"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', ['get', 'selected'], 1, 0] }}
              paint={{ 'line-color': '#ffffff', 'line-width': ['case', ['get', 'selected'], 10, 6] }}
            />
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', ['get', 'selected'], 1, 0] }}
              paint={{
                'line-color': ['get', 'color'],
                'line-width': ['case', ['get', 'selected'], 6, 3.5],
                'line-opacity': ['case', ['get', 'selected'], 1, 0.5],
              }}
            />
          </Source>

          <Source id="checkpoints" type="geojson" data={checkpointsData}>
            <Layer
              id="checkpoint-dots"
              type="circle"
              paint={{
                'circle-color': riskColorExpr,
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.5, 8, 7],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.5,
              }}
            />
          </Source>

          {routeLabels.map(({ route, lon, lat }) => (
            <Marker
              key={route.id}
              longitude={lon}
              latitude={lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                onSelectRoute(route.id)
              }}
            >
              <div
                className={`route-chip${route.id === selectedRouteId ? ' is-selected' : ''}`}
                style={{ '--route-color': routeColor(route.id) }}
              >
                <strong>{route.id}</strong>
                {formatDuration(route.durationMinutes)}
                <span className="route-chip-risk" style={{ background: RISK_COLOR[route.riskLevel] }}>
                  {riskLabel(route.riskLevel)}
                </span>
                {route.id === plan.recommendedRouteId && <span className="route-chip-star" title="Recommended">★</span>}
              </div>
            </Marker>
          ))}

          <Marker longitude={plan.origin.lon} latitude={plan.origin.lat} anchor="center">
            <div className="endpoint endpoint-origin" title={plan.origin.name} />
          </Marker>
          <Marker longitude={plan.destination.lon} latitude={plan.destination.lat} anchor="center">
            <div className="endpoint endpoint-destination" title={plan.destination.name} />
          </Marker>

          {truckPosition && (
            <Marker longitude={truckPosition[0]} latitude={truckPosition[1]} anchor="center">
              <div className="truck-marker" title={`Truck position at ${formatTime(forecastTime)}`}>
                🚚
              </div>
            </Marker>
          )}

          {popupCheckpoint && (
            <Popup
              longitude={popupCheckpoint.lon}
              latitude={popupCheckpoint.lat}
              anchor="bottom"
              offset={10}
              closeOnClick={false}
              onClose={() => onActiveCheckpointChange(null)}
              maxWidth="280px"
            >
              <CheckpointPopup checkpoint={popupCheckpoint} />
            </Popup>
          )}
        </>
      )}
    </Map>
  )
}

function CheckpointPopup({ checkpoint: c }) {
  const w = c.weather
  return (
    <div className="cp-popup">
      <div className="cp-popup-head">
        <span>Mile {c.mile}</span>
        <span className="risk-pill" style={{ background: RISK_COLOR[c.risk.level] }}>
          {riskLabel(c.risk.level)}
        </span>
      </div>
      <div className="cp-popup-eta">
        ETA {formatTime(c.eta)}
        {!c.inForecastWindow && <em> (beyond forecast range)</em>}
      </div>
      <div className="cp-popup-condition">{w.condition}</div>
      <dl className="cp-popup-grid">
        <dt>Temp</dt><dd>{w.tempF}°F</dd>
        <dt>Wind</dt><dd>{w.windMph} mph{w.gustMph > w.windMph ? `, gusts ${w.gustMph}` : ''}</dd>
        <dt>Rain</dt><dd>{w.rainInHr} in/h</dd>
        <dt>Snow</dt><dd>{w.snowInHr} in/h</dd>
        <dt>Visibility</dt><dd>{w.visibilityMi} mi</dd>
      </dl>
      {c.risk.factors.length > 0 && (
        <ul className="cp-popup-factors">
          {c.risk.factors.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
