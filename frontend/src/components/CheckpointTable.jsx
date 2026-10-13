import { formatTime } from '../lib/format'
import { RISK_COLOR, riskLabel } from '../lib/risk'

export default function CheckpointTable({ route, activeCheckpoint, onSelect }) {
  return (
    <div className="checkpoints">
      <h3>
        Route {route.id} checkpoints <span>({route.checkpoints.length})</span>
      </h3>
      <div className="checkpoints-scroll">
        <table>
          <thead>
            <tr>
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
                  className={active ? 'is-active' : ''}
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
                    <span className="risk-dot" style={{ background: RISK_COLOR[c.risk.level] }} />
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
