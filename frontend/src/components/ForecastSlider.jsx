import { useEffect, useState } from 'react'
import { FORECAST_PLAY_INTERVAL_MS, FORECAST_TICK_HOURS } from '../constants'
import { formatTime } from '../utils/formatUtils'

export default function ForecastSlider({ hour, maxHour, forecastTime, onChange, showHeatmap, onToggleHeatmap }) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => onChange((h) => (h >= maxHour ? 0 : h + 1)), FORECAST_PLAY_INTERVAL_MS)
    return () => clearInterval(id)
  }, [playing, maxHour, onChange])

  return (
    <div className="absolute bottom-7 left-1/2 w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-[10px] bg-white/96 px-3.5 pt-2.5 pb-2 shadow-float">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="grid size-[30px] cursor-pointer place-items-center rounded-full border border-line bg-surface text-[11px]"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause forecast animation' : 'Play forecast animation'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="mr-auto flex items-baseline gap-2">
          <strong>{formatTime(forecastTime)}</strong>
          <span className="text-xs text-muted">{hour === 0 ? 'Now' : `+${hour}h`}</span>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input type="checkbox" checked={showHeatmap} onChange={(e) => onToggleHeatmap(e.target.checked)} />
          Weather heatmap
        </label>
      </div>
      <input
        className="mt-2 w-full accent-accent"
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
      <div className="flex justify-between text-[11px] text-muted">
        {FORECAST_TICK_HOURS.map((h) => (
          <span key={h}>{h}h</span>
        ))}
      </div>
    </div>
  )
}
