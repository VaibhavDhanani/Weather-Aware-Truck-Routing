// Synthetic, deterministic forecast for demo mode: a few storm cells that drift
// east across the trip corridor and grow/decay over the 48-hour window.

const HOUR_MS = 3_600_000

function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

const STORM_KINDS = ['rain', 'snow', 'wind', 'thunder']

export function createWeatherModel({ origin, destination, forecastStart, seed }) {
  const rand = mulberry32(seed)
  const between = (a, b) => a + rand() * (b - a)
  const dx = destination.lon - origin.lon
  const dy = destination.lat - origin.lat
  const span = Math.hypot(dx, dy)
  const t0 = forecastStart.getTime()

  const storms = Array.from({ length: 5 }, (_, i) => {
    const f = between(0.15, 0.85)
    const side = between(-0.3, 0.3) * span
    return {
      kind: STORM_KINDS[(i + Math.floor(rand() * 4)) % 4],
      lon: origin.lon + dx * f - (dy / span) * side,
      lat: origin.lat + dy * f + (dx / span) * side,
      radius: Math.min(2.8, 0.8 + span * between(0.08, 0.15)),
      vLon: between(0.12, 0.45),
      vLat: between(-0.1, 0.1),
      peakHour: between(3, 36),
      sigmaHours: between(8, 16),
      intensity: between(0.7, 1.15),
    }
  })

  return function sample(lon, lat, time) {
    const h = ((time instanceof Date ? time.getTime() : time) - t0) / HOUR_MS
    let precip = 0, wind = 0, cold = 0, thunder = 0
    for (const s of storms) {
      const dt = h - s.peakHour
      const cx = s.lon + s.vLon * dt
      const cy = s.lat + s.vLat * dt
      const d2 = ((lon - cx) * Math.cos((lat * Math.PI) / 180)) ** 2 + (lat - cy) ** 2
      const v = s.intensity * Math.exp(-d2 / s.radius ** 2) * Math.exp(-(dt * dt) / (2 * s.sigmaHours ** 2))
      if (s.kind === 'rain') precip += v
      if (s.kind === 'snow') { precip += v * 0.7; cold += v; wind += v * 0.4 }
      if (s.kind === 'wind') wind += v
      if (s.kind === 'thunder') { precip += v; wind += v * 0.6; thunder += v }
    }

    const utcHour = new Date(t0 + h * HOUR_MS).getUTCHours()
    const localHour = (utcHour + lon / 15 + 24) % 24
    const tempF = Math.round(
      78 - (lat - 28) * 1.6 - Math.min(1, cold) * 32 + 8 * Math.sin((2 * Math.PI * (localHour - 9)) / 24),
    )
    const windMph = Math.round(6 + 6 * Math.sin(lon * 1.3 + lat * 0.7 + h * 0.2) ** 2 + Math.min(1, wind) * 30)
    const precipInHr = Math.round(Math.min(1, precip) * 0.6 * 100) / 100

    let precipType = 'none'
    let condition = precip > 0.02 ? 'Cloudy' : 'Clear'
    if (precipInHr >= 0.03) {
      if (tempF <= 31) {
        precipType = 'snow'
        condition = precipInHr >= 0.15 ? 'Heavy Snow' : 'Snow'
      } else if (tempF <= 35) {
        precipType = 'ice'
        condition = 'Freezing Rain'
      } else {
        precipType = 'rain'
        condition = thunder > 0.4 ? 'Thunderstorm' : precipInHr >= 0.25 ? 'Heavy Rain' : 'Rain'
      }
    } else if (windMph >= 30) {
      condition = 'High Wind'
    }

    const visLoss = precipInHr * (precipType === 'snow' ? 40 : 16)
    const visibilityMi = Math.round(Math.max(0.25, Math.min(10, 10 - visLoss)) * 10) / 10

    // Split the precipitation for the risk rules; snow is ~5 in of snow per inch of water.
    const rainInHr = precipType === 'rain' || precipType === 'ice' ? precipInHr : 0
    const snowInHr = precipType === 'snow' ? Math.round(precipInHr * 5 * 100) / 100 : 0
    return { tempF, windMph, gustMph: windMph, precipInHr, rainInHr, snowInHr, precipType, visibilityMi, condition }
  }
}
