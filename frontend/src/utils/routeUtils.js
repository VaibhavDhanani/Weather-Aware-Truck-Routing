import { FALLBACK_ROUTE_COLOR, ROUTE_COLORS, ROUTE_LABEL_POSITION } from '../constants'
import { cumulativeMiles, pointAtMile } from './geoUtils'

export function routeColor(routeId) {
  return ROUTE_COLORS[routeId] ?? FALLBACK_ROUTE_COLOR
}

export function routeLabelPoint(route) {
  const cumMiles = cumulativeMiles(route.geometry)
  return pointAtMile(route.geometry, cumMiles, cumMiles.at(-1) * ROUTE_LABEL_POSITION)
}

export function truckPositionAt(route, time) {
  const checkpoints = route.checkpoints
  const t = time.getTime()
  if (t < Date.parse(checkpoints[0].eta) || t > Date.parse(checkpoints.at(-1).eta)) return null

  let i = 1
  while (Date.parse(checkpoints[i].eta) < t) i++
  const [prev, next] = [checkpoints[i - 1], checkpoints[i]]
  const t0 = Date.parse(prev.eta)
  const fraction = (t - t0) / (Date.parse(next.eta) - t0 || 1)
  const mile = prev.mile + (next.mile - prev.mile) * fraction
  return pointAtMile(route.geometry, cumulativeMiles(route.geometry), mile)
}
