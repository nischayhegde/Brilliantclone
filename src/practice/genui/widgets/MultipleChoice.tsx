import type { WidgetProps } from '../WidgetHost'
import { WidgetCard, WidgetPrompt } from './ui'

/** LLM-authored question + options about the setup. Process signal. */
export default function MultipleChoice({ widget, value, onChange }: WidgetProps) {
  if (widget.kind !== 'multiple-choice') return null
  const { prompt, options, multiSelect } = widget.config
  const selected = value?.kind === 'multiple-choice' ? value.selected : []

  const toggle = (id: string) => {
    let next: string[]
    if (multiSelect) {
      next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    } else {
      next = [id]
    }
    onChange({ kind: 'multiple-choice', selected: next })
  }

  const role = multiSelect ? 'group' : 'radiogroup'
  return (
    <WidgetCard label="Question">
      <WidgetPrompt>{prompt}</WidgetPrompt>
      <div role={role} aria-label={prompt} className="flex flex-col gap-2">
        {options.map((opt) => {
          const isSel = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              role={multiSelect ? 'checkbox' : 'radio'}
              aria-checked={isSel}
              onClick={() => toggle(opt.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 ${
                isSel ? 'border-ink bg-surface text-ink' : 'border-hairline bg-paper text-ink-soft hover:bg-surface'
              }`}
            >
              <span
                aria-hidden
                className={`grid h-4 w-4 shrink-0 place-items-center border ${multiSelect ? 'rounded' : 'rounded-full'} ${
                  isSel ? 'border-ink bg-ink' : 'border-hairline'
                }`}
              >
                {isSel && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              {opt.label}
            </button>
          )
        })}
      </div>
    </WidgetCard>
  )
}
