import 'maplibre-gl/dist/maplibre-gl.css'
import '../maplibreWorker'
import { useCallback, useState } from 'react'
import { planTrip } from '../api/tripsApi'
import CheckpointTable from '../components/CheckpointTable'
import ForecastSlider from '../components/ForecastSlider'
import Legend from '../components/Legend'
import RouteList from '../components/RouteList'
import RouteMap from '../components/RouteMap'
import TripForm from '../components/TripForm'
import { FORECAST_HOURS, HOME_PATH, HOUR_MS } from '../constants'

export default function PlanPage() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [activeCheckpoint, setActiveCheckpoint] = useState(null)
  const [hour, setHour] = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(true)

  const maxHour = plan?.heatmap.hours ?? FORECAST_HOURS
  const forecastTime = plan && new Date(Date.parse(plan.heatmap.forecastStart) + hour * HOUR_MS)
  const selectedRoute = plan?.routes.find((r) => r.id === selectedRouteId)

  async function handlePlan(params) {
    setLoading(true)
    setError(null)
    try {
      const result = await planTrip(params)
      setPlan(result)
      setSelectedRouteId(result.recommendedRouteId)
      setActiveCheckpoint(null)
      const departureHour = Math.round((Date.parse(result.departure) - Date.parse(result.heatmap.forecastStart)) / HOUR_MS)
      setHour(Math.min(result.heatmap.hours, Math.max(0, departureHour)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectRoute = useCallback((id) => {
    setSelectedRouteId(id)
    setActiveCheckpoint(null)
  }, [])

  return (
    <div className="grid grid-cols-1 desk:h-full desk:grid-cols-[400px_1fr]">
      <aside className="flex flex-col gap-4 bg-surface p-[18px] desk:overflow-y-auto desk:border-r desk:border-line">
        <a href={HOME_PATH} className="text-lg font-bold hover:text-accent">
          Weather-Aware Truck Routing
        </a>

        <TripForm onSubmit={handlePlan} loading={loading} />

        {error && <div className="rounded-lg bg-danger-soft px-3 py-2.5 text-danger">{error}</div>}

        {plan ? (
          <>
            <RouteList plan={plan} selectedRouteId={selectedRouteId} onSelect={selectRoute} />
            {selectedRoute && (
              <CheckpointTable route={selectedRoute} activeCheckpoint={activeCheckpoint} onSelect={setActiveCheckpoint} />
            )}
          </>
        ) : (
          !error && (
            <p className="text-muted">
              Enter a trip and press <strong>Plan routes</strong> to compare three routes by weather risk and drive time.
            </p>
          )
        )}
      </aside>

      <main className="relative -order-1 h-[60vh] min-h-0 desk:order-none desk:h-auto">
        <RouteMap
          plan={plan}
          selectedRouteId={selectedRouteId}
          onSelectRoute={selectRoute}
          forecastTime={forecastTime}
          hour={hour}
          showHeatmap={showHeatmap}
          activeCheckpoint={activeCheckpoint}
          onActiveCheckpointChange={setActiveCheckpoint}
        />
        {plan && (
          <>
            <Legend />
            <ForecastSlider
              hour={hour}
              maxHour={maxHour}
              forecastTime={forecastTime}
              onChange={setHour}
              showHeatmap={showHeatmap}
              onToggleHeatmap={setShowHeatmap}
            />
          </>
        )}
      </main>
    </div>
  )
}
