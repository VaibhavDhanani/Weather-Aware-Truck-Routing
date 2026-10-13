import { RISK_LEVELS } from '../constants'
import RiskDot from './RiskDot'

const TITLE = 'mb-1 font-bold not-first:mt-2.5'

export default function Legend() {
  return (
    <div className="absolute top-3 left-3 hidden w-[150px] rounded-[10px] bg-white/95 px-3 py-2.5 text-xs shadow-float desk:block">
      <div className={TITLE}>Checkpoint risk</div>
      {RISK_LEVELS.map((l) => (
        <div key={l.key} className="flex items-center">
          <RiskDot color={l.color} />
          {l.label}
        </div>
      ))}
      <div className={TITLE}>Weather heatmap</div>
      <div className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(47,158,91,0.35),#d4a106,#e8590c,#c92a2a)]" />
      <div className="flex justify-between text-[11px] text-muted">
        <span>Calm</span>
        <span>Severe</span>
      </div>
    </div>
  )
}
