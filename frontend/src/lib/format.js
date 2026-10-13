export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export function formatMiles(mi) {
  return `${Math.round(mi).toLocaleString()} mi`
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatTime(value) {
  return timeFmt.format(value instanceof Date ? value : new Date(value))
}

/** Value for an <input type="datetime-local"> in the browser's timezone. */
export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}
