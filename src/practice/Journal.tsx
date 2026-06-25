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
    <div className="flex w-full max-w-xl flex-col items-center gap-3" onKeyDown={onKeyDown}>
      <label htmlFor="journal-rationale" className="text-lg font-semibold">
        Before you see the result — log it.
      </label>
      <input
        id="journal-rationale"
        ref={inputRef}
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="One line: why did you take (or skip) this?"
        className="w-full rounded-xl border-2 border-hairline px-4 py-3 text-base focus:border-ink focus:outline-none"
      />
      <div role="radiogroup" aria-label="How did you feel?" className="flex flex-wrap justify-center gap-2">
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
              className={`rounded-full border-2 px-4 py-2 text-sm font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 ${
                selected ? 'border-ink bg-ink text-white' : 'border-hairline text-ink hover:border-ink/40'
              }`}
            >
              {FEELING_LABEL[f]}
            </button>
          )
        })}
      </div>
      <Button disabled={!ready} onClick={submit}>
        Log &amp; see result
      </Button>
    </div>
  )
}
