import type { WidgetProps } from '../WidgetHost'
import { WidgetCard, WidgetPrompt, WidgetHint } from './ui'

/** LLM-composed pre-trade checklist; the learner ticks items. Process signal. */
export default function Checklist({ widget, value, onChange }: WidgetProps) {
  if (widget.kind !== 'checklist') return null
  const { items, requireAll } = widget.config
  const checked = value?.kind === 'checklist' ? value.checked : []

  const toggle = (id: string) => {
    const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]
    onChange({ kind: 'checklist', checked: next })
  }

  return (
    <WidgetCard label="Checklist">
      <WidgetPrompt>Pre-trade checklist</WidgetPrompt>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const isOn = checked.includes(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isOn}
                onClick={() => toggle(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 ${
                  isOn ? 'border-brand-green bg-brand-green-soft text-brand-green-text' : 'border-hairline bg-paper text-ink-soft hover:bg-surface'
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                    isOn ? 'border-brand-green bg-brand-green text-white' : 'border-hairline'
                  }`}
                >
                  {isOn && <span className="text-[10px] leading-none">✓</span>}
                </span>
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
      {requireAll && <WidgetHint>Tick every item before you take the trade.</WidgetHint>}
    </WidgetCard>
  )
}
