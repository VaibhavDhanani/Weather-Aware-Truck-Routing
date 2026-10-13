import { useState } from 'react'
import {
  CITY_NAME_ERROR,
  CITY_NAME_MAX_LENGTH,
  CITY_SUGGESTIONS,
  DEFAULT_TRIP,
  INTERVAL_MILES_CHOICES,
  LOAD_STEP_LBS,
  MAX_GROSS_WEIGHT_LBS,
} from '../constants'
import { nextFullHour, toLocalInputValue } from '../utils/formatUtils'
import { isCityName } from '../utils/validationUtils'

const LABEL = 'flex flex-col gap-1 text-xs font-semibold text-muted'
const INPUT =
  'min-w-0 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm font-normal text-ink ' +
  'focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger'
const SEGMENT =
  'flex-1 cursor-pointer border border-line py-[7px] text-center text-[13px] ' +
  'not-first-of-type:border-l-0 first-of-type:rounded-l-lg last-of-type:rounded-r-lg ' +
  'has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent ' +
  'has-focus-visible:outline-2 has-focus-visible:outline-accent'

export default function TripForm({ onSubmit, loading }) {
  const [origin, setOrigin] = useState(DEFAULT_TRIP.origin)
  const [destination, setDestination] = useState(DEFAULT_TRIP.destination)
  const [departure, setDeparture] = useState(() => toLocalInputValue(nextFullHour()))
  const [loadWeightLbs, setLoadWeightLbs] = useState(DEFAULT_TRIP.loadWeightLbs)
  const [intervalMiles, setIntervalMiles] = useState(DEFAULT_TRIP.intervalMiles)

  function handleSubmit(e) {
    e.preventDefault()
    if (!isCityName(origin) || !isCityName(destination)) return
    onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      departure: new Date(departure).toISOString(),
      loadWeightLbs: Number(loadWeightLbs),
      intervalMiles,
    })
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={handleSubmit}>
      <CityInput label="Origin" value={origin} onChange={setOrigin} />
      <CityInput label="Destination" value={destination} onChange={setDestination} />
      <datalist id="city-suggestions">
        {CITY_SUGGESTIONS.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>

      <div className="grid grid-cols-[1.4fr_1fr] gap-2.5">
        <label className={LABEL}>
          Departure
          <input
            className={INPUT}
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            required
          />
        </label>
        <label className={LABEL}>
          Load (lbs)
          <input
            className={INPUT}
            type="number"
            min={0}
            max={MAX_GROSS_WEIGHT_LBS}
            step={LOAD_STEP_LBS}
            value={loadWeightLbs}
            onChange={(e) => setLoadWeightLbs(e.target.value)}
            required
          />
        </label>
      </div>

      <fieldset className="flex">
        <legend className="mb-1 text-xs font-semibold text-muted">Weather checkpoint every</legend>
        {INTERVAL_MILES_CHOICES.map((miles) => (
          <label key={miles} className={SEGMENT}>
            <input
              className="sr-only"
              type="radio"
              name="interval"
              checked={intervalMiles === miles}
              onChange={() => setIntervalMiles(miles)}
            />
            {miles} mi
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        className="cursor-pointer rounded-lg bg-accent p-2.5 font-semibold text-white disabled:cursor-progress disabled:opacity-60"
        disabled={loading}
      >
        {loading ? 'Planning…' : 'Plan routes'}
      </button>
    </form>
  )
}

function CityInput({ label, value, onChange }) {
  const invalid = value.trim() !== '' && !isCityName(value)

  function handleChange(e) {
    const next = e.target.value
    // Native validity blocks form submission while the value isn't a city name.
    e.target.setCustomValidity(next.trim() === '' || isCityName(next) ? '' : CITY_NAME_ERROR)
    onChange(next)
  }

  return (
    <label className={LABEL}>
      {label}
      <input
        className={INPUT}
        value={value}
        onChange={handleChange}
        list="city-suggestions"
        placeholder="City, e.g. Denver, CO"
        maxLength={CITY_NAME_MAX_LENGTH}
        aria-invalid={invalid}
        required
      />
      {invalid && <span className="font-normal text-danger">{CITY_NAME_ERROR}</span>}
    </label>
  )
}
