import { EARTH_RADIUS_MI } from '../constants'

const toRadians = (degrees) => (degrees * Math.PI) / 180

/** Great-circle distance in miles between two [lon, lat] points. */
export function haversineMiles([lon1, lat1], [lon2, lat2]) {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(a))
}

/** Running distance in miles at each vertex of a [lon, lat] polyline. */
export function cumulativeMiles(coords) {
  const miles = [0]
  for (let i = 1; i < coords.length; i++) {
    miles.push(miles[i - 1] + haversineMiles(coords[i - 1], coords[i]))
  }
  return miles
}

/** The point `mile` miles along a polyline, clamped to its ends. */
export function pointAtMile(coords, cumMiles, mile) {
  if (mile <= 0) return coords[0]
  if (mile >= cumMiles.at(-1)) return coords.at(-1)

  let i = 1
  while (cumMiles[i] < mile) i++
  const fraction = (mile - cumMiles[i - 1]) / (cumMiles[i] - cumMiles[i - 1] || 1)
  const [x1, y1] = coords[i - 1]
  const [x2, y2] = coords[i]
  return [x1 + (x2 - x1) * fraction, y1 + (y2 - y1) * fraction]
}

/** [[minLon, minLat], [maxLon, maxLat]] covering every given polyline. */
export function boundsOf(lines) {
  const points = lines.flat()
  const lons = points.map(([lon]) => lon)
  const lats = points.map(([, lat]) => lat)
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}
