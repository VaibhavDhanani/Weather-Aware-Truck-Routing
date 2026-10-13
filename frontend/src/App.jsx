import { lazy, Suspense } from 'react'
import { PLAN_PATH } from './constants'
import LandingPage from './pages/LandingPage'

// The planner brings in MapLibre (~1 MB), so it is only downloaded when /plan is opened.
const PlanPage = lazy(() => import('./pages/PlanPage'))

// Two pages linked with plain <a href>, so the URL path is all the routing needed.
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '')

  if (path === PLAN_PATH) {
    return (
      <Suspense fallback={<p className="grid h-full place-items-center text-muted">Loading planner…</p>}>
        <PlanPage />
      </Suspense>
    )
  }
  return <LandingPage />
}
