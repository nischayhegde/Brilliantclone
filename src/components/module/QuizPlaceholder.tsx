import { useState, type ReactNode } from 'react'
import type { LessonModule } from '../../data/lessonManifest'
import Button from '../ui/Button'
import PlaceholderChart from './PlaceholderChart'
import { CheckIcon, CrossIcon } from '../icons'

interface QuizPlaceholderProps {
  module: LessonModule
  onComplete: () => void
}

type Phase = 'answer' | 'revealed'

export default function QuizPlaceholder({ module, onComplete }: QuizPlaceholderProps) {
  const [choice, setChoice] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<Phase>('answer')

  const correct = module.correctAnswer ?? true
  const isRight = choice === correct

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-brand-blue">
          Quiz · {module.ticker}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">{module.patternName}</h1>
      </div>

      <PlaceholderChart
        label={`${module.patternName} — ${module.ticker}`}
        note={
          phase === 'answer'
            ? 'Half the chart is hidden — does the pattern complete?'
            : correct
              ? 'Revealed: the pattern completed as expected.'
              : 'Revealed: the pattern faked out and failed.'
        }
      />

      {phase === 'answer' ? (
        <>
          <p className="max-w-md font-semibold">
            Does the {module.patternName} pattern complete?
          </p>
          <div role="group" aria-label="Your answer" className="flex gap-3">
            <ChoiceButton selected={choice === true} onClick={() => setChoice(true)}>
              Yes
            </ChoiceButton>
            <ChoiceButton selected={choice === false} onClick={() => setChoice(false)}>
              No
            </ChoiceButton>
          </div>
          <Button disabled={choice === null} onClick={() => setPhase('revealed')}>
            Check
          </Button>
        </>
      ) : (
        <>
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-2 rounded-2xl px-4 py-3 font-bold ${
              isRight ? 'bg-brand-green-soft text-brand-green' : 'bg-red-50 text-brand-red'
            }`}
          >
            {isRight ? <CheckIcon /> : <CrossIcon />}
            {isRight ? 'Correct!' : 'Not quite.'}
          </div>
          <p className="max-w-md text-muted">
            The full lesson explains exactly why the {module.patternName}{' '}
            {correct ? 'confirmed' : 'failed'} here. (Explanation content coming soon.)
          </p>
          <Button onClick={onComplete}>Continue</Button>
        </>
      )}
    </div>
  )
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      aria-pressed={selected}
      onClick={onClick}
      className={`min-w-28 rounded-2xl border-2 px-6 py-3 font-bold transition ${
        selected
          ? 'border-brand-blue bg-brand-blue-soft text-brand-blue'
          : 'border-hairline bg-white text-ink hover:border-brand-blue/40'
      }`}
    >
      {children}
    </button>
  )
}
