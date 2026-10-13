import { formatTime } from '../utils/formatUtils'
import { riskColor, riskLabel } from '../utils/riskUtils'
import RiskDot from './RiskDot'

export default function CheckpointTable({ route, activeCheckpoint, onSelect }) {
  return (
    <div>
      <h3 className="mb-1.5 font-bold">
        Route {route.id} checkpoints <span className="font-normal text-muted">({route.checkpoints.length})</span>
      </h3>
      <div className="max-h-80 overflow-y-auto rounded-[10px] border border-line">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr className="*:sticky *:top-0 *:bg-[#f3f5f7] *:px-2 *:py-1.5 *:text-left *:font-semibold *:text-muted">
              <th>Mile</th>
              <th>ETA</th>
              <th>Weather</th>
              <th>Wind</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((c) => {
              const active = activeCheckpoint?.routeId === route.id && activeCheckpoint.index === c.index
              return (
                <tr
                  key={c.index}
                  className={
                    'cursor-pointer *:border-t *:border-line *:px-2 *:py-[5px] *:whitespace-nowrap ' +
                    (active ? 'bg-accent-soft' : 'hover:bg-[#f7f9fb]')
                  }
                  onClick={() => onSelect({ routeId: route.id, index: c.index, lon: c.lon, lat: c.lat, fly: true })}
                >
                  <td>{c.mile}</td>
                  <td title={c.inForecastWindow ? undefined : 'Beyond the available forecast; weather shown is the last forecast hour'}>
                    {formatTime(c.eta)}
                    {!c.inForecastWindow && '*'}
                  </td>
                  <td>
                    {c.weather.condition}, {c.weather.tempF}°
                  </td>
                  <td>{c.weather.windMph}</td>
                  <td>
                    <RiskDot color={riskColor(c.risk.level)} />
                    {riskLabel(c.risk.level)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
