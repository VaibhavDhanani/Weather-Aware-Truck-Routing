const EARTH_RADIUS_MI = 3958.8
const toRad = (deg) => (deg * Math.PI) / 180

/** Great-circle distance in miles between two [lon, lat] points. */
export function haversineMiles([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(a))
}

/** Running distance (miles) at each vertex of a [lon, lat] polyline. */
export function cumulativeMiles(coords) {
  const out = [0]
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + haversineMiles(coords[i - 1], coords[i]))
  }
  return out
}

/** Point `mile` miles along a polyline (clamped to its ends). */
export function pointAtMile(coords, cum, mile) {
  if (mile <= 0) return coords[0]
  const total = cum[cum.length - 1]
  if (mile >= total) return coords[coords.length - 1]
  let i = 1
  while (cum[i] < mile) i++
  const f = (mile - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
  const [x1, y1] = coords[i - 1]
  const [x2, y2] = coords[i]
  return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f]
}

/** [[minLon, minLat], [maxLon, maxLat]] covering every given polyline. */
export function boundsOf(lines) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const line of lines) {
    for (const [x, y] of line) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return [[minX, minY], [maxX, maxY]]
}

/**
 * Where the truck is on `route` at `time`, interpolated between checkpoint
 * ETAs. Returns null before departure or after arrival.
 */
export function positionAtTime(route, time) {
  const cps = route.checkpoints
  const t = time.getTime()
  const first = Date.parse(cps[0].eta)
  const last = Date.parse(cps[cps.length - 1].eta)
  if (t < first || t > last) return null
  let i = 1
  while (Date.parse(cps[i].eta) < t) i++
  const t0 = Date.parse(cps[i - 1].eta)
  const t1 = Date.parse(cps[i].eta)
  const f = (t - t0) / (t1 - t0 || 1)
  const mile = cps[i - 1].mile + (cps[i].mile - cps[i - 1].mile) * f
  const cum = cumulativeMiles(route.geometry)
  return pointAtMile(route.geometry, cum, mile)
}
