import { CITY_NAME_MAX_LENGTH, CITY_NAME_MIN_LENGTH, CITY_NAME_PATTERN } from '../constants'

export function isCityName(value) {
  const name = value.trim()
  return name.length >= CITY_NAME_MIN_LENGTH && name.length <= CITY_NAME_MAX_LENGTH && CITY_NAME_PATTERN.test(name)
}
