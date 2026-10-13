import { useEffect, useState } from 'react'
import { formatTime } from '../lib/format'

export default function ForecastSlider({ hour, maxHour, forecastTime, onChange, showHeatmap, onToggleHeatmap }) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => onChange((h) => (h >= maxHour ? 0 : h + 1)), 700)
    return () => clearInterval(id)
  }, [playing, maxHour, onChange])

  return (
    <div className="forecast">
      <div className="forecast-head">
        <button
          type="button"
          className="icon-button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause forecast animation' : 'Play forecast animation'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="forecast-time">
          <strong>{formatTime(forecastTime)}</strong>
          <span>{hour === 0 ? 'Now' : `+${hour}h`}</span>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showHeatmap} onChange={(e) => onToggleHeatmap(e.target.checked)} />
          Weather heatmap
        </label>
      </div>
      <input
        type="range"
        min={0}
        max={maxHour}
        step={1}
        value={hour}
        onChange={(e) => {
          setPlaying(false)
          onChange(Number(e.target.value))
        }}
        aria-label="Forecast hour"
      />
      <div className="forecast-ticks">
        {[0, 12, 24, 36, 48].map((h) => (
          <span key={h}>{h}h</span>
        ))}
      </div>
    </div>
  )
}
