import { mockPlanTrip } from '../mock/planTrip'

// Empty by default: in dev, Vite proxies /api to Django (see vite.config.js).
// Set VITE_API_BASE_URL when the API lives on another origin (e.g. production).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

// VITE_DEMO_MODE=true runs the in-browser mock planner instead of the backend.
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

/**
 * Plan a trip via the Django API (or the mock planner in demo mode).
 *
 * Request:  { origin, destination, departure (ISO), loadWeightLbs, intervalMiles: 10 | 25 | 50 }
 * Response:
 * {
 *   origin, destination: { name, label, lon, lat },
 *   departure, loadWeightLbs, intervalMiles,
 *   recommendedRouteId, fastestRouteId, safestRouteId, recommendationReason,
 *   routes: [{
 *     id, name, geometry: [[lon, lat], ...],
 *     distanceMiles, durationMinutes, departure, arrival,
 *     riskLevel: worst level on the route — 'low' | 'moderate' | 'high' | 'severe' | 'no_travel',
 *     riskScore: average checkpoint score (0–100),
 *     milesByLevel: { low, moderate, high, severe, no_travel },
 *     summary,
 *     checkpoints: [{
 *       index, mile, lon, lat, eta, inForecastWindow,
 *       weather: { tempF, windMph, gustMph, precipInHr, rainInHr, snowInHr, precipType, visibilityMi,
 *                  condition, weatherCode },
 *       risk: { level, score (0–100: wind/55·0.30 + rain/1.0·0.30 + snow/3·0.40), factors: [string] },
 *     }],
 *   }],
 *   heatmap: { forecastStart, hours, cellSizeDeg, points: [{ lon, lat, values: [weighted score 0–1 per hour] }] },
 * }
 */
export async function planTrip(params) {
  if (isDemoMode) return mockPlanTrip(params)

  let res
  try {
    res = await fetch(`${API_BASE_URL}/api/trips/plan/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch {
    throw new Error('Could not reach the trip-planning server. Is the Django backend running on port 8010?')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 502 || res.status === 504) {
      throw new Error(body.detail ?? 'The backend is not responding. Is Django running on port 8010?')
    }
    throw new Error(body.detail ?? `Trip planning failed (${res.status})`)
  }
  console.log(body)
  return body
}
