import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Popup, ScaleControl, Source } from 'react-map-gl/maplibre'
import {
  CHECKPOINT_MIN_ZOOM,
  CLICKABLE_LAYER_IDS,
  FIT_BOUNDS_OPTIONS,
  FLY_DURATION_MS,
  INITIAL_VIEW_STATE,
  MAP_STYLE_URL,
} from '../constants'
import { formatDuration, formatTime } from '../utils/formatUtils'
import { boundsOf } from '../utils/geoUtils'
import {
  CHECKPOINT_LAYER,
  checkpointsGeoJson,
  heatmapGeoJson,
  heatmapLayer,
  ROUTE_CASING_LAYER,
  ROUTE_LINE_LAYER,
  routesGeoJson,
} from '../utils/mapUtils'
import { riskColor, riskLabel } from '../utils/riskUtils'
import { routeColor, routeLabelPoint, truckPositionAt } from '../utils/routeUtils'

const ENDPOINT = 'size-4 border-3 border-white bg-ink shadow-float'
const PILL = 'rounded-full text-[11px] text-white'

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

  // Fit every route on screen when a new plan arrives.
  useEffect(() => {
    if (plan && mapRef.current) {
      mapRef.current.fitBounds(boundsOf(plan.routes.map((r) => r.geometry)), FIT_BOUNDS_OPTIONS)
    }
  }, [plan])

  // Fly to a checkpoint picked in the table.
  useEffect(() => {
    if (activeCheckpoint?.fly && mapRef.current) {
      mapRef.current.flyTo({
        center: [activeCheckpoint.lon, activeCheckpoint.lat],
        zoom: Math.max(mapRef.current.getZoom(), CHECKPOINT_MIN_ZOOM),
        duration: FLY_DURATION_MS,
      })
    }
  }, [activeCheckpoint])

  const routesData = useMemo(() => plan && routesGeoJson(plan.routes, selectedRouteId), [plan, selectedRouteId])
  const checkpointsData = useMemo(() => selectedRoute && checkpointsGeoJson(selectedRoute), [selectedRoute])
  const heatData = useMemo(() => plan && heatmapGeoJson(plan.heatmap, hour), [plan, hour])
  const heatLayer = useMemo(() => plan && heatmapLayer(plan.heatmap.cellSizeDeg, showHeatmap), [plan, showHeatmap])
  const routeLabels = useMemo(() => plan?.routes.map((route) => ({ route, point: routeLabelPoint(route) })) ?? [], [plan])

  const truckPosition = selectedRoute ? truckPositionAt(selectedRoute, forecastTime) : null
  const popupOnSelectedRoute = activeCheckpoint && activeCheckpoint.routeId === selectedRoute?.id
  const popupCheckpoint = popupOnSelectedRoute ? selectedRoute.checkpoints[activeCheckpoint.index] : null

  function handleClick(e) {
    const feature = e.features?.[0]
    if (!feature) {
      onActiveCheckpointChange(null)
    } else if (feature.layer.id === CHECKPOINT_LAYER.id) {
      const c = selectedRoute.checkpoints[feature.properties.index]
      onActiveCheckpointChange({ routeId: selectedRoute.id, index: c.index, lon: c.lon, lat: c.lat, fly: false })
    } else if (feature.layer.id === ROUTE_LINE_LAYER.id) {
      onSelectRoute(feature.properties.id)
    }
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW_STATE}
      mapStyle={MAP_STYLE_URL}
      interactiveLayerIds={plan ? CLICKABLE_LAYER_IDS : []}
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
            <Layer {...heatLayer} />
          </Source>
          <Source id="routes" type="geojson" data={routesData}>
            <Layer {...ROUTE_CASING_LAYER} />
            <Layer {...ROUTE_LINE_LAYER} />
          </Source>
          <Source id="checkpoints" type="geojson" data={checkpointsData}>
            <Layer {...CHECKPOINT_LAYER} />
          </Source>

          {routeLabels.map(({ route, point: [lon, lat] }) => (
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
              <RouteChip
                route={route}
                selected={route.id === selectedRouteId}
                recommended={route.id === plan.recommendedRouteId}
              />
            </Marker>
          ))}

          <Marker longitude={plan.origin.lon} latitude={plan.origin.lat} anchor="center">
            <div className={`${ENDPOINT} rounded-full`} title={plan.origin.name} />
          </Marker>
          <Marker longitude={plan.destination.lon} latitude={plan.destination.lat} anchor="center">
            <div className={`${ENDPOINT} rounded-[3px]`} title={plan.destination.name} />
          </Marker>

          {truckPosition && (
            <Marker longitude={truckPosition[0]} latitude={truckPosition[1]} anchor="center">
              <div
                className="pointer-events-none grid size-[30px] place-items-center rounded-full border-2 border-ink bg-white text-base shadow-float"
                title={`Truck position at ${formatTime(forecastTime)}`}
              >
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

function RouteChip({ route, selected, recommended }) {
  return (
    <div
      className={
        'flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-(--route-color) bg-white py-[3px] pr-1.5 pl-1 ' +
        'text-xs font-semibold whitespace-nowrap shadow-float ' +
        (selected ? 'scale-108' : 'opacity-85')
      }
      style={{ '--route-color': routeColor(route.id) }}
    >
      <strong className="grid size-[18px] place-items-center rounded-full bg-(--route-color) text-[11px] text-white">
        {route.id}
      </strong>
      {formatDuration(route.durationMinutes)}
      <span className={`${PILL} px-1.5`} style={{ background: riskColor(route.riskLevel) }}>
        {riskLabel(route.riskLevel)}
      </span>
      {recommended && (
        <span className="text-star" title="Recommended">
          ★
        </span>
      )}
    </div>
  )
}

function CheckpointPopup({ checkpoint }) {
  const { weather, risk } = checkpoint
  return (
    <div className="min-w-[200px] text-[13px]">
      <div className="flex items-center justify-between gap-2 font-bold">
        <span>Mile {checkpoint.mile}</span>
        <span className={`${PILL} px-2 font-semibold whitespace-nowrap`} style={{ background: riskColor(risk.level) }}>
          {riskLabel(risk.level)}
        </span>
      </div>
      <div className="text-muted">
        ETA {formatTime(checkpoint.eta)}
        {!checkpoint.inForecastWindow && <em> (beyond forecast range)</em>}
      </div>
      <div className="mt-1.5 mb-1 font-semibold">{weather.condition}</div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 [&_dt]:text-muted">
        <dt>Temp</dt>
        <dd>{weather.tempF}°F</dd>
        <dt>Wind</dt>
        <dd>
          {weather.windMph} mph{weather.gustMph > weather.windMph ? `, gusts ${weather.gustMph}` : ''}
        </dd>
        <dt>Rain</dt>
        <dd>{weather.rainInHr} in/h</dd>
        <dt>Snow</dt>
        <dd>{weather.snowInHr} in/h</dd>
        <dt>Visibility</dt>
        <dd>{weather.visibilityMi} mi</dd>
      </dl>

      {risk.factors.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-xs text-muted">
          {risk.factors.map((factor) => (
            <li key={factor}>{factor}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
