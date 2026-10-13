// Demo-mode stand-in for the Django `plan trip` endpoint. Returns the same
// response shape documented in src/api/client.js.
import { cumulativeMiles, pointAtMile, boundsOf } from '../lib/geo'
import { assessRisk, compareRoutes, riskLabel, routeRisk } from '../lib/risk'
import { formatTime } from '../lib/format'
import { CITIES, findCity } from '../lib/cities'
import { createWeatherModel, hashString } from './weatherModel'

const HOUR_MS = 3_600_000
const FORECAST_HOURS = 48

// Each variant bends the path to one side of the direct line and travels at a
// different average speed (interstate vs. secondary highways).
const VARIANTS = [
  { id: 'A', bend: 0, wiggle: 0.04, speedMph: 58 },
  { id: 'B', bend: 0.09, wiggle: 0.04, speedMph: 55 },
  { id: 'C', bend: -0.08, wiggle: 0.035, speedMph: 53 },
]

function buildGeometry(o, d, { bend, wiggle }, seed) {
  const dx = d.lon - o.lon
  const dy = d.lat - o.lat
  const span = Math.hypot(dx, dy)
  const nx = -dy / span
  const ny = dx / span
  const steps = 160
  const phase = (seed % 100) / 10
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const envelope = Math.sin(Math.PI * f)
    const offset = span * (bend * envelope + wiggle * envelope * Math.sin(f * 9 + phase))
    coords.push([o.lon + dx * f + nx * offset, o.lat + dy * f + ny * offset])
  }
  return { coords, northward: ny * bend > 0 }
}

function routeName(variant, northward) {
  if (variant.bend === 0) return 'Direct interstate'
  return northward ? 'Northern corridor' : 'Southern corridor'
}

function describeRoute(route, { fastest, safest }) {
  const tags = []
  if (route.id === fastest) tags.push('Fastest option.')
  if (route.id === safest) tags.push('Lowest weather risk.')
  if (route.riskLevel === 'low') {
    tags.push('No significant weather expected.')
    return tags.join(' ')
  }
  const worst = route.checkpoints.find((c) => c.risk.level === route.riskLevel)
  tags.push(
    `Worst: ${riskLabel(worst.risk.level)} near mile ${worst.mile} (~${formatTime(worst.eta)}) — ${worst.risk.factors.join('; ')}.`,
  )
  const flagged = ['no_travel', 'severe', 'high']
    .filter((l) => route.milesByLevel[l])
    .map((l) => `${route.milesByLevel[l]} mi ${riskLabel(l)}`)
  if (flagged.length) tags.push(`${flagged.join(', ')}.`)
  return tags.join(' ')
}

export async function mockPlanTrip({ origin, destination, departure, loadWeightLbs, intervalMiles }) {
  await new Promise((r) => setTimeout(r, 450))

  const o = findCity(origin)
  const d = findCity(destination)
  if (!o || !d) {
    const missing = !o ? origin : destination
    throw new Error(
      `Demo mode only knows a fixed list of cities and couldn't find "${missing}". Try e.g. ${CITIES.slice(0, 3)
        .map((c) => c.name)
        .join(', ')}.`,
    )
  }
  if (o === d) throw new Error('Origin and destination must be different.')

  const departAt = new Date(departure)
  const forecastStart = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS)
  const forecastEnd = forecastStart.getTime() + FORECAST_HOURS * HOUR_MS
  const seed = hashString(`${o.name}|${d.name}|${forecastStart.toDateString()}`)
  const weatherAt = createWeatherModel({ origin: o, destination: d, forecastStart, seed })

  const routes = VARIANTS.map((variant) => {
    const { coords, northward } = buildGeometry(o, d, variant, seed)
    const cum = cumulativeMiles(coords)
    const distanceMiles = cum.at(-1)

    const miles = []
    for (let m = 0; m < distanceMiles; m += intervalMiles) miles.push(m)
    miles.push(distanceMiles)

    const checkpoints = miles.map((mile, index) => {
      const [lon, lat] = pointAtMile(coords, cum, mile)
      const eta = new Date(departAt.getTime() + (mile / variant.speedMph) * HOUR_MS)
      const weather = weatherAt(lon, lat, eta)
      return {
        index,
        mile: Math.round(mile),
        lon,
        lat,
        eta: eta.toISOString(),
        inForecastWindow: eta.getTime() <= forecastEnd,
        weather,
        risk: assessRisk(weather, loadWeightLbs),
      }
    })

    return {
      id: variant.id,
      name: routeName(variant, northward),
      geometry: coords,
      distanceMiles: Math.round(distanceMiles),
      durationMinutes: Math.round((distanceMiles / variant.speedMph) * 60),
      departure: departAt.toISOString(),
      arrival: checkpoints.at(-1).eta,
      ...routeRisk(checkpoints),
      checkpoints,
    }
  })

  // Fewest No Travel / Severe / High miles, then lowest average risk, then shortest time.
  const ranked = [...routes].sort(compareRoutes)
  const fastest = routes.reduce((a, b) => (b.durationMinutes < a.durationMinutes ? b : a))
  const safest = [...routes].sort((a, b) => compareRoutes({ ...a, durationMinutes: 0 }, { ...b, durationMinutes: 0 }))[0]
  for (const r of routes) r.summary = describeRoute(r, { fastest: fastest.id, safest: safest.id })
  const recommended = ranked[0]

  return {
    origin: o,
    destination: d,
    departure: departAt.toISOString(),
    loadWeightLbs,
    intervalMiles,
    fastestRouteId: fastest.id,
    safestRouteId: safest.id,
    recommendedRouteId: recommended.id,
    recommendationReason: recommendationReason(ranked),
    routes,
    heatmap: buildHeatmap(routes, weatherAt, forecastStart, loadWeightLbs),
  }
}

function recommendationReason([rec, runner]) {
  const warning = rec.milesByLevel.no_travel
    ? 'Every route crosses No Travel conditions — consider another departure time. '
    : ''
  if (!runner) return `${warning}Only one route was found.`
  const vs = `Route ${runner.id}`
  for (const level of ['no_travel', 'severe', 'high']) {
    if (rec.milesByLevel[level] !== runner.milesByLevel[level]) {
      return `${warning}Fewest ${riskLabel(level)} miles (${rec.milesByLevel[level]} vs ${runner.milesByLevel[level]} on ${vs}).`
    }
  }
  if (rec.riskScore !== runner.riskScore) {
    return `${warning}Same No Travel/Severe/High mileage as ${vs}, lower average risk (${rec.riskScore} vs ${runner.riskScore}).`
  }
  return `${warning}Same risk as ${vs}, but ${runner.durationMinutes - rec.durationMinutes} min shorter.`
}

function buildHeatmap(routes, weatherAt, forecastStart, loadWeightLbs) {
  const [[minLon, minLat], [maxLon, maxLat]] = boundsOf(routes.map((r) => r.geometry))
  const pad = 1.5
  const west = minLon - pad, east = maxLon + pad, south = minLat - pad, north = maxLat + pad
  const cols = 34
  const step = (east - west) / (cols - 1)
  // Web Mercator stretches latitude, so space rows closer to keep cells square on screen.
  const latStep = step * Math.cos((((north + south) / 2) * Math.PI) / 180)
  const rows = Math.max(8, Math.round((north - south) / latStep) + 1)

  const points = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lon = west + c * step
      const lat = south + r * latStep
      const values = []
      for (let h = 0; h <= FORECAST_HOURS; h++) {
        const w = weatherAt(lon, lat, forecastStart.getTime() + h * HOUR_MS)
        values.push(Math.round(assessRisk(w, loadWeightLbs).score) / 100)
      }
      points.push({ lon, lat, values })
    }
  }
  return {
    forecastStart: forecastStart.toISOString(),
    hours: FORECAST_HOURS,
    cellSizeDeg: step,
    points,
  }
}
