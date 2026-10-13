import { RISK_LEVELS } from '../lib/risk'

export default function Legend() {
  return (
    <div className="legend">
      <div className="legend-title">Checkpoint risk</div>
      {RISK_LEVELS.map((l) => (
        <div key={l.key} className="legend-row">
          <span className="risk-dot" style={{ background: l.color }} />
          {l.label}
        </div>
      ))}
      <div className="legend-title">Weather heatmap</div>
      <div className="legend-gradient" />
      <div className="legend-scale">
        <span>Calm</span>
        <span>Severe</span>
      </div>
    </div>
  )
}
