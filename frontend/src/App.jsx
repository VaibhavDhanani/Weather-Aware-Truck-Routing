import { useCallback, useState } from 'react'
import { isDemoMode, planTrip } from './api/client'
import CheckpointTable from './components/CheckpointTable'
import ForecastSlider from './components/ForecastSlider'
import Legend from './components/Legend'
import RouteList from './components/RouteList'
import RouteMap from './components/RouteMap'
import TripForm from './components/TripForm'
import './App.css'

const HOUR_MS = 3_600_000

export default function App() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [activeCheckpoint, setActiveCheckpoint] = useState(null)
  const [hour, setHour] = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(true)

  const maxHour = plan?.heatmap.hours ?? 48
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
      // Start the slider at departure so the truck marker is on the map.
      const departHour = Math.round((Date.parse(result.departure) - Date.parse(result.heatmap.forecastStart)) / HOUR_MS)
      setHour(Math.min(result.heatmap.hours, Math.max(0, departHour)))
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
    <div className="app">
      <aside className="sidebar">
        <header className="brand">
          <h1>Weather-Aware Truck Routing</h1>
          {isDemoMode && <span className="demo-badge" title="Using simulated routes and weather">Demo data</span>}
        </header>

        <TripForm onSubmit={handlePlan} loading={loading} />

        {error && <div className="error">{error}</div>}

        {plan ? (
          <>
            <RouteList plan={plan} selectedRouteId={selectedRouteId} onSelect={selectRoute} />
            {selectedRoute && (
              <CheckpointTable route={selectedRoute} activeCheckpoint={activeCheckpoint} onSelect={setActiveCheckpoint} />
            )}
          </>
        ) : (
          !error && (
            <p className="empty-hint">
              Enter a trip and press <strong>Plan routes</strong> to compare three routes by weather risk and drive time.
            </p>
          )
        )}
      </aside>

      <main className="map-area">
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
