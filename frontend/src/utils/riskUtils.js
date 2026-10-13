import { RISK_LEVELS } from '../constants'

const LEVELS_BY_KEY = Object.fromEntries(RISK_LEVELS.map((level) => [level.key, level]))

export function riskLabel(levelKey) {
  return LEVELS_BY_KEY[levelKey]?.label ?? levelKey
}

export function riskColor(levelKey) {
  return LEVELS_BY_KEY[levelKey]?.color ?? '#888'
}
