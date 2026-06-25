import { useEffect, useRef } from 'react'
import type { WidgetProps } from '../WidgetHost'
import { WidgetCard, WidgetPrompt } from './ui'

/** 0–100 confidence slider. Process signal. */
export default function Confidence({ widget, value, onChange }: WidgetProps) {
  if (widget.kind !== 'confidence') return null
  const confidence = value?.kind === 'confidence' ? value.confidence : 50
  const committed = useRef(false)

  useEffect(() => {
    if (!committed.current && value?.kind !== 'confidence') {
      committed.current = true
      onChange({ kind: 'confidence', confidence: 50 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <WidgetCard label="Confidence">
      <WidgetPrompt>{widget.config.prompt ?? 'How confident are you?'}</WidgetPrompt>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={confidence}
          aria-label="Confidence"
          onChange={(e) => onChange({ kind: 'confidence', confidence: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer accent-ink"
        />
        <output className="min-w-[3rem] text-right text-sm font-semibold tabular-nums text-ink">
          {confidence}%
        </output>
      </div>
    </WidgetCard>
  )
}
