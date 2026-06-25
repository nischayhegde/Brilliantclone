import { useEffect, useRef } from 'react'
import type { WidgetProps } from '../WidgetHost'
import { WidgetCard, WidgetPrompt } from './ui'

/** Position-size slider (config bounds + unit). → Decision.shares. */
export default function SizeSlider({ widget, value, onChange }: WidgetProps) {
  if (widget.kind !== 'size-slider') return null
  const { min, max, step, unit } = widget.config
  const stepN = step ?? Math.max(1, Math.round((max - min) / 100))
  const fallback = Math.round((min + max) / 2)
  const size = value?.kind === 'size-slider' ? value.size : fallback
  const committed = useRef(false)

  useEffect(() => {
    if (!committed.current && value?.kind !== 'size-slider') {
      committed.current = true
      onChange({ kind: 'size-slider', size: fallback })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unitLabel = unit ?? 'shares'
  return (
    <WidgetCard label="Position size">
      <WidgetPrompt>Position size</WidgetPrompt>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={stepN}
          value={size}
          aria-label="Position size"
          onChange={(e) => onChange({ kind: 'size-slider', size: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer accent-ink"
        />
        <output className="min-w-[5.5rem] text-right text-sm font-semibold tabular-nums text-ink">
          {size.toLocaleString('en-US')} {unitLabel}
        </output>
      </div>
    </WidgetCard>
  )
}
