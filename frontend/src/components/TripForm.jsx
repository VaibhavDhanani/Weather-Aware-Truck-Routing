import { useState } from 'react'
import { toLocalInputValue } from '../lib/format'
import { CITY_NAME_ERROR, CITY_NAME_MAX_LENGTH, isCityName } from '../lib/validation'
import { CITIES } from '../lib/cities'

const INTERVALS = [10, 25, 50]

function CityInput({ label, value, onChange }) {
  const invalid = value.trim() !== '' && !isCityName(value)
  return (
    <label>
      {label}
      <input
        value={value}
        onChange={(e) => {
          const next = e.target.value
          // Native validity blocks form submission while the value isn't a city name.
          e.target.setCustomValidity(next.trim() === '' || isCityName(next) ? '' : CITY_NAME_ERROR)
          onChange(next)
        }}
        list="city-suggestions"
        placeholder="City, e.g. Denver, CO"
        maxLength={CITY_NAME_MAX_LENGTH}
        aria-invalid={invalid}
        required
      />
      {invalid && <span className="field-error">{CITY_NAME_ERROR}</span>}
    </label>
  )
}

function nextHour() {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

export default function TripForm({ onSubmit, loading }) {
  const [origin, setOrigin] = useState('Denver, CO')
  const [destination, setDestination] = useState('Chicago, IL')
  const [departure, setDeparture] = useState(() => toLocalInputValue(nextHour()))
  const [loadWeightLbs, setLoadWeightLbs] = useState(42000)
  const [intervalMiles, setIntervalMiles] = useState(25)

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
    <form className="trip-form" onSubmit={handleSubmit}>
      <CityInput label="Origin" value={origin} onChange={setOrigin} />
      <CityInput label="Destination" value={destination} onChange={setDestination} />
      {/* Suggestions only; any city name can be typed. */}
      <datalist id="city-suggestions">
        {CITIES.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>

      <div className="trip-form-row">
        <label>
          Departure
          <input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} required />
        </label>
        <label>
          Load (lbs)
          <input
            type="number"
            min={0}
            max={80000}
            step={500}
            value={loadWeightLbs}
            onChange={(e) => setLoadWeightLbs(e.target.value)}
            required
          />
        </label>
      </div>

      <fieldset className="segmented">
        <legend>Weather checkpoint every</legend>
        {INTERVALS.map((mi) => (
          <label key={mi} className={intervalMiles === mi ? 'is-active' : ''}>
            <input
              type="radio"
              name="interval"
              value={mi}
              checked={intervalMiles === mi}
              onChange={() => setIntervalMiles(mi)}
            />
            {mi} mi
          </label>
        ))}
      </fieldset>

      <button type="submit" className="primary" disabled={loading}>
        {loading ? 'Planning…' : 'Plan routes'}
      </button>
    </form>
  )
}
