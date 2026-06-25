import { useState } from 'react'
import Button from '../components/ui/Button'
import type { Feeling } from './types'

const FEELINGS: Feeling[] = ['confident', 'anxious', 'fomo', 'revenge', 'calm']

export default function Journal({ onSubmit }: { onSubmit: (e: { rationale: string; feeling: Feeling }) => void }) {
  const [rationale, setRationale] = useState('')
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const ready = rationale.trim().length > 0 && feeling !== null

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <p className="text-lg font-semibold">Before you see the result — log it.</p>
      <input
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="One line: why did you take (or skip) this?"
        className="w-full rounded-xl border-2 border-hairline px-4 py-3 text-base focus:border-ink focus:outline-none"
      />
      <div role="group" aria-label="How did you feel?" className="flex flex-wrap justify-center gap-2">
        {FEELINGS.map((f) => (
          <button
            key={f}
            aria-pressed={feeling === f}
            onClick={() => setFeeling(f)}
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold capitalize ${
              feeling === f ? 'border-ink bg-ink text-white' : 'border-hairline text-ink hover:border-ink/40'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <Button disabled={!ready} onClick={() => ready && onSubmit({ rationale: rationale.trim(), feeling: feeling! })}>
        Log &amp; see result
      </Button>
    </div>
  )
}
