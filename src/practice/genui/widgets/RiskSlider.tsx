import { useEffect, useRef } from 'react'
import type { WidgetProps } from '../WidgetHost'
import { WidgetCard, WidgetPrompt } from './ui'

/** Intended %-risk-per-trade slider. Process signal (the engine converts %→shares). */
export default function RiskSlider({ widget, value, onChange }: WidgetProps) {
  if (widget.kind !== 'risk-slider') return null
  const { minPct, maxPct, step } = widget.config
  const stepN = step ?? 0.25
  const fallback = Math.round(((minPct + maxPct) / 2) / stepN) * stepN
  const riskPct = value?.kind === 'risk-slider' ? value.riskPct : fallback
  const committed = useRef(false)

  useEffect(() => {
    if (!committed.current && value?.kind !== 'risk-slider') {
      committed.current = true
      onChange({ kind: 'risk-slider', riskPct: fallback })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <WidgetCard label="Risk per trade">
      <WidgetPrompt>Risk per trade</WidgetPrompt>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={minPct}
          max={maxPct}
          step={stepN}
          value={riskPct}
          aria-label="Risk percent"
          onChange={(e) => onChange({ kind: 'risk-slider', riskPct: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer accent-brand-amber"
        />
        <output className="min-w-[3.5rem] text-right text-sm font-semibold tabular-nums text-ink">
          {riskPct}%
        </output>
      </div>
    </WidgetCard>
  )
}
