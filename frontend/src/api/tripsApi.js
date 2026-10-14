import { PLAN_TRIP_URL } from '../constants'

const BACKEND_DOWN = 'Could not reach the trip-planning server'

export async function planTrip(params) {
  let response
  try {
    response = await fetch(PLAN_TRIP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch {
    throw new Error(BACKEND_DOWN)
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const proxyCouldNotConnect = response.status === 502 || response.status === 504
    throw new Error(body.detail ?? (proxyCouldNotConnect ? BACKEND_DOWN : `Trip planning failed (${response.status})`))
  }
  console.log(body)
  return body
}
