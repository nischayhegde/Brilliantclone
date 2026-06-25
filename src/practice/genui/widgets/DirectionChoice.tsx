import type { WidgetProps } from '../WidgetHost'
import type { Direction } from '../types'
import { WidgetCard, WidgetPrompt } from './ui'

const LABELS: Record<Direction, string> = { long: 'Long', short: 'Short', skip: 'Skip / Stay out' }
const ACTIVE: Record<Direction, string> = {
  long: 'bg-brand-green text-white border-brand-green',
  short: 'bg-brand-red text-white border-brand-red',
  skip: 'bg-ink text-white border-ink',
}

/** Long / short / skip choice (configurable allowed set). → Decision.direction. */
export default function DirectionChoice({ widget, value, onChange }: WidgetProps) {
  if (widget.kind !== 'direction-choice') return null
  const allowed = widget.config.allowed
  const current = value?.kind === 'direction-choice' ? value.direction : undefined

  return (
    <WidgetCard label="Direction">
      <WidgetPrompt>{widget.config.prompt ?? 'Your call on this setup'}</WidgetPrompt>
      <div role="radiogroup" aria-label="Trade direction" className="flex flex-wrap gap-2">
        {allowed.map((d) => {
          const selected = current === d
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ kind: 'direction-choice', direction: d })}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 ${
                selected ? ACTIVE[d] : 'border-hairline bg-paper text-ink hover:bg-surface'
              }`}
            >
              {LABELS[d]}
            </button>
          )
        })}
      </div>
    </WidgetCard>
  )
}
