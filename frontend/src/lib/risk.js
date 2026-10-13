// Risk levels shared by the map, legend and route cards, mildest first.
export const RISK_LEVELS = [
  { key: 'low', label: 'Low', color: '#2f9e5b' },
  { key: 'moderate', label: 'Moderate', color: '#d4a106' },
  { key: 'high', label: 'High', color: '#e8590c' },
  { key: 'severe', label: 'Severe', color: '#c92a2a' },
  { key: 'no_travel', label: 'No Travel', color: '#7b1fa2' },
]

export const RISK_COLOR = Object.fromEntries(RISK_LEVELS.map((l) => [l.key, l.color]))
const RANK = Object.fromEntries(RISK_LEVELS.map((l, i) => [l.key, i]))

export function riskLabel(key) {
  return RISK_LEVELS.find((l) => l.key === key)?.label ?? key
}

export function worstLevel(levels) {
  return levels.reduce((worst, l) => (RANK[l] > RANK[worst] ? l : worst), 'low')
}

// ---------------------------------------------------------------------------
// Demo mode only: the same rules the backend applies (backend/trips/constants.py).

const WIND_RULES = [['no_travel', 55, true], ['severe', 45, true], ['high', 35, true], ['moderate', 25, true]]
const RAIN_RULES = [['no_travel', 1.0, false], ['severe', 0.5, true], ['high', 0.25, true], ['moderate', 0.1, true]]
const SNOW_RULES = [['no_travel', 3.0, false], ['severe', 2.0, true], ['high', 1.0, true], ['moderate', 0.5, true]]
const LOAD_RULES = [[45, 54, 30000, 'no_travel'], [35, 44, 40000, 'severe']] // min mph, max mph, load over, level
const SCORE_WEIGHTS = [['windMph', 55, 0.3], ['rainInHr', 1.0, 0.3], ['snowInHr', 3.0, 0.4]] // field, scale, weight

/** 0–1: wind/55, rain/1.0 and snow/3 (each capped at 1), weighted 0.30/0.30/0.40. */
export function weightedScore(weather) {
  return SCORE_WEIGHTS.reduce((sum, [field, scale, weight]) => sum + Math.min(weather[field] / scale, 1) * weight, 0)
}

function levelFor(value, rules) {
  const hit = rules.find(([, threshold, inclusive]) => value > threshold || (inclusive && value === threshold))
  return hit ? hit[0] : 'low'
}

export function assessRisk(weather, loadLbs) {
  const { windMph: wind, rainInHr: rain, snowInHr: snow } = weather
  const candidates = [
    [levelFor(wind, WIND_RULES), `Wind ${wind} mph`],
    [levelFor(rain, RAIN_RULES), `Rain ${rain} in/hr`],
    [levelFor(snow, SNOW_RULES), `Snow ${snow} in/hr`],
  ]
  for (const [min, max, over, level] of LOAD_RULES) {
    if (wind >= min && wind <= max && loadLbs > over) {
      candidates.push([level, `Wind ${wind} mph with a load over ${over.toLocaleString()} lb`])
    }
  }
  const level = worstLevel(candidates.map(([l]) => l))
  return {
    level,
    score: Math.round(weightedScore(weather) * 100),
    factors: candidates.filter(([l]) => l !== 'low').map(([l, reason]) => `${reason} → ${riskLabel(l)}`),
  }
}

/** Worst level, average weighted score and miles per level; a stretch counts at its worse end. */
export function routeRisk(checkpoints) {
  const milesByLevel = Object.fromEntries(RISK_LEVELS.map((l) => [l.key, 0]))
  checkpoints.slice(1).forEach((b, i) => {
    const a = checkpoints[i]
    milesByLevel[worstLevel([a.risk.level, b.risk.level])] += b.mile - a.mile
  })
  const scores = checkpoints.map((c) => c.risk.score)
  return {
    riskLevel: worstLevel(checkpoints.map((c) => c.risk.level)),
    riskScore: Math.round(scores.reduce((s, x) => s + x, 0) / scores.length),
    milesByLevel,
  }
}

/** Best first: fewest No Travel / Severe / High miles, lowest average risk, shortest time. */
export function compareRoutes(a, b) {
  const key = (r) => [r.milesByLevel.no_travel, r.milesByLevel.severe, r.milesByLevel.high, r.riskScore, r.durationMinutes]
  const ka = key(a)
  const kb = key(b)
  const i = ka.findIndex((v, idx) => v !== kb[idx])
  return i === -1 ? 0 : ka[i] - kb[i]
}
