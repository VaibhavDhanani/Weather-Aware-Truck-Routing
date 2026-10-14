import { RECOMMENDATION_LEVELS, RISK_LEVELS } from '../constants'
import { formatDuration, formatMiles, formatTime } from '../utils/formatUtils'
import { riskColor, riskLabel } from '../utils/riskUtils'
import { routeColor } from '../utils/routeUtils'

const TAG = 'rounded-full px-[7px] py-px text-[11px] font-semibold'
const STAT_LABEL = 'block text-[11px] text-muted'

export default function RouteList({ plan, selectedRouteId, onSelect }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2.5 rounded-[10px] bg-good-soft px-3 py-2.5">
        <span className="text-lg leading-[1.1] text-star">★</span>
        <div>
          <strong>Recommended: Route {plan.recommendedRouteId}</strong>
          <p className="text-[13px] text-muted">{plan.recommendationReason}</p>
        </div>
      </div>

      {plan.routes.map((route) => (
        <RouteCard
          key={route.id}
          route={route}
          plan={plan}
          selected={route.id === selectedRouteId}
          onSelect={() => onSelect(route.id)}
        />
      ))}
    </div>
  )
}

function RouteCard({ route, plan, selected, onSelect }) {
  return (
    <button
      type="button"
      className={
        'flex cursor-pointer flex-col gap-2.5 rounded-[10px] border border-l-4 border-l-(--route-color) bg-surface p-3 text-left ' +
        (selected ? 'border-(--route-color) shadow-[0_0_0_1px_var(--route-color)]' : 'border-line hover:border-(--route-color)')
      }
      style={{ '--route-color': routeColor(route.id) }}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="grid size-[22px] place-items-center rounded-md bg-(--route-color) text-xs font-bold text-white">
          {route.id}
        </span>
        <span className="mr-auto font-semibold">{route.name}</span>
        {route.id === plan.recommendedRouteId && <span className={`${TAG} bg-good-soft text-good`}>Recommended</span>}
        {route.id === plan.fastestRouteId && <span className={`${TAG} bg-subtle text-muted`}>Fastest</span>}
        {route.id === plan.safestRouteId && <span className={`${TAG} bg-subtle text-muted`}>Safest</span>}
      </div>

      <div className="grid grid-cols-3 gap-1.5 tabular-nums">
        <Stat label="Drive time" value={formatDuration(route.durationMinutes)} />
        <Stat label="Distance" value={formatMiles(route.distanceMiles)} />
        <Stat label="Arrive" value={formatTime(route.arrival)} />
      </div>

      <RiskMeter route={route} />

      <p className="text-[13px] text-muted">{route.summary}</p>
    </button>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <span className={STAT_LABEL}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RiskMeter({ route }) {
  const miles = route.milesByLevel
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className={STAT_LABEL}>Worst weather on route</span>
        <strong style={{ color: riskColor(route.riskLevel) }}>{riskLabel(route.riskLevel)}</strong>
      </div>

      <div className="flex h-1.5 overflow-hidden rounded-full bg-subtle" title="Miles at each risk level">
        {RISK_LEVELS.filter((level) => miles[level.key]).map((level) => (
          <div
            key={level.key}
            className="h-full"
            style={{ width: `${(miles[level.key] / route.distanceMiles) * 100}%`, background: level.color }}
          />
        ))}
      </div>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted tabular-nums">
        {RECOMMENDATION_LEVELS.map((level) => (
          <span key={level} className={miles[level] ? 'font-semibold text-ink' : ''}>
            {riskLabel(level)} {miles[level]} mi
          </span>
        ))}
        <span>Avg risk {route.riskScore}</span>
      </div>
    </div>
  )
}
