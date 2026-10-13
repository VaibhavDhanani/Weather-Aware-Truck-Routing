import { formatDuration, formatMiles, formatTime } from '../lib/format'
import { RISK_COLOR, RISK_LEVELS, riskLabel } from '../lib/risk'
import { routeColor } from '../lib/routeColors'

export default function RouteList({ plan, selectedRouteId, onSelect }) {
  return (
    <div className="route-list">
      <div className="recommendation">
        <span className="recommendation-star">★</span>
        <div>
          <strong>Recommended: Route {plan.recommendedRouteId}</strong>
          <p>{plan.recommendationReason}</p>
        </div>
      </div>

      {plan.routes.map((r) => (
        <button
          key={r.id}
          type="button"
          className={`route-card${r.id === selectedRouteId ? ' is-selected' : ''}`}
          style={{ '--route-color': routeColor(r.id) }}
          onClick={() => onSelect(r.id)}
        >
          <div className="route-card-head">
            <span className="route-badge">{r.id}</span>
            <span className="route-card-name">{r.name}</span>
            {r.id === plan.recommendedRouteId && <span className="tag tag-rec">Recommended</span>}
            {r.id === plan.fastestRouteId && <span className="tag">Fastest</span>}
            {r.id === plan.safestRouteId && <span className="tag">Safest</span>}
          </div>

          <div className="route-card-stats">
            <div>
              <span>Drive time</span>
              <strong>{formatDuration(r.durationMinutes)}</strong>
            </div>
            <div>
              <span>Distance</span>
              <strong>{formatMiles(r.distanceMiles)}</strong>
            </div>
            <div>
              <span>Arrive</span>
              <strong>{formatTime(r.arrival)}</strong>
            </div>
          </div>

          <div className="risk-meter">
            <div className="risk-meter-label">
              <span>Worst weather on route</span>
              <strong style={{ color: RISK_COLOR[r.riskLevel] }}>{riskLabel(r.riskLevel)}</strong>
            </div>
            {/* Share of the route's miles at each risk level */}
            <div className="risk-meter-track" title="Miles at each risk level">
              {RISK_LEVELS.map((l) =>
                r.milesByLevel[l.key] ? (
                  <div
                    key={l.key}
                    style={{ width: `${(r.milesByLevel[l.key] / r.distanceMiles) * 100}%`, background: l.color }}
                  />
                ) : null,
              )}
            </div>
            <div className="risk-meter-miles">
              {['no_travel', 'severe', 'high'].map((level) => (
                <span key={level} className={r.milesByLevel[level] ? 'is-flagged' : ''}>
                  {riskLabel(level)} {r.milesByLevel[level]} mi
                </span>
              ))}
              <span>Avg risk {r.riskScore}</span>
            </div>
          </div>

          <p className="route-card-summary">{r.summary}</p>
        </button>
      ))}
    </div>
  )
}
