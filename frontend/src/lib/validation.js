// Mirrors CITY_NAME_PATTERN in backend/trips/constants.py: letters, spaces and . , ' -
// only (no digits), so origin/destination are always city names, never coordinates
// or street addresses.
const CITY_NAME_RE = /^\p{L}[\p{L} .,'’-]*$/u

export const CITY_NAME_MIN_LENGTH = 2
export const CITY_NAME_MAX_LENGTH = 200
export const CITY_NAME_ERROR = 'Enter a city name, e.g. "Denver, CO" (letters, spaces and . , \' - only).'

export function isCityName(value) {
  const v = value.trim()
  return v.length >= CITY_NAME_MIN_LENGTH && v.length <= CITY_NAME_MAX_LENGTH && CITY_NAME_RE.test(v)
}
