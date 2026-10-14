import { lazy, Suspense } from 'react'
import { PLAN_PATH } from './constants'
import LandingPage from './pages/LandingPage'

// Lazy so MapLibre (~1 MB) only downloads when /plan is opened.
const PlanPage = lazy(() => import('./pages/PlanPage'))

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
