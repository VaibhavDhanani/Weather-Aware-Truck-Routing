const timeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })

/** 135 → "2h 15m", 40 → "40m". */
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return hours ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins}m`
}

/** 1234.6 → "1,235 mi". */
export function formatMiles(miles) {
  return `${Math.round(miles).toLocaleString()} mi`
}

/** A Date or ISO string → "Tue 3:00 PM" in the browser's timezone. */
export function formatTime(value) {
  return timeFormat.format(value instanceof Date ? value : new Date(value))
}

/** Value for an <input type="datetime-local"> in the browser's timezone. */
export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** The start of the next hour from now. */
export function nextFullHour() {
  const date = new Date()
  date.setHours(date.getHours() + 1, 0, 0, 0)
  return date
}
