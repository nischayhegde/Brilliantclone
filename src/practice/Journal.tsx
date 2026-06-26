import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Button from '../components/ui/Button'
import { FEELING_LABEL } from './copy'
import type { Feeling } from './types'

const FEELINGS: Feeling[] = ['confident', 'anxious', 'fomo', 'revenge', 'calm']

export default function Journal({ onSubmit }: { onSubmit: (e: { rationale: string; feeling: Feeling }) => void }) {
  const [rationale, setRationale] = useState('')
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const ready = rationale.trim().length > 0 && feeling !== null

  // Land focus on the rationale field so the keyboard flow starts here.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = () => {
    if (ready) onSubmit({ rationale: rationale.trim(), feeling: feeling! })
  }

  // Ctrl/Cmd+Enter submits from anywhere in the journal.
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  // Roving selection: arrows move + select within the feeling radiogroup, and focus
  // follows the selection so keyboard users always see where they are.
  const select = (idx: number) => {
    const next = (idx + FEELINGS.length) % FEELINGS.length
    setFeeling(FEELINGS[next])
    btnRefs.current[next]?.focus()
  }
  const onRadioKeyDown = (e: KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      select(idx + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      select(idx - 1)
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      select(idx)
    }
  }

  return (
    <div
      className="flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-hairline bg-paper p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
      onKeyDown={onKeyDown}
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-bold text-ink">Lock in your reasoning</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Commit before the outcome is revealed — this is how you learn to separate good process from luck.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="journal-rationale" className="text-sm font-semibold text-ink">
          Why did you take (or skip) this?
        </label>
        <input
          id="journal-rationale"
          ref={inputRef}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="One line — your edge, your risk, your reason."
          className="w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-base text-ink placeholder:text-muted transition focus:border-ink focus:bg-paper focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/30"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span id="journal-feeling-label" className="text-sm font-semibold text-ink">
          How are you feeling about it?
        </span>
        <div role="radiogroup" aria-labelledby="journal-feeling-label" className="flex flex-wrap gap-2">
          {FEELINGS.map((f, idx) => {
            const selected = feeling === f
            return (
              <button
                key={f}
                ref={(el) => { btnRefs.current[idx] = el }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected || (feeling === null && idx === 0) ? 0 : -1}
                onClick={() => setFeeling(f)}
                onKeyDown={(e) => onRadioKeyDown(e, idx)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 ${
                  selected ? 'border-ink bg-ink text-white' : 'border-hairline text-ink hover:border-ink/40 hover:bg-surface'
                }`}
              >
                {FEELING_LABEL[f]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-muted">Tip: ⌘/Ctrl + Enter to submit.</span>
        <Button disabled={!ready} onClick={submit}>
          Log &amp; see result
        </Button>
      </div>
    </div>
  )
}
