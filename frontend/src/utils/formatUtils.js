const timeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return hours ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins}m`
}

export function formatMiles(miles) {
  return `${Math.round(miles).toLocaleString()} mi`
}

export function formatTime(value) {
  return timeFormat.format(value instanceof Date ? value : new Date(value))
}

export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function nextFullHour() {
  const date = new Date()
  date.setHours(date.getHours() + 1, 0, 0, 0)
  return date
}
