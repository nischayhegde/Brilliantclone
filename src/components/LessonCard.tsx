import Card from './ui/Card'
import Button from './ui/Button'
import { ChartGlyph, RestartIcon, CheckIcon } from './icons'
import type { LessonSpec } from '../engine/types'
import type { LessonStats } from '../state/LessonProgressContext'

interface LessonCardProps {
  lesson: LessonSpec
  stats: LessonStats
  onStart: () => void
  /** Shown when the lesson has progress; clears it back to module 1. */
  onRestart?: () => void
}

export default function LessonCard({ lesson, stats, onStart, onRestart }: LessonCardProps) {
  const { completedCount, total, isComplete } = stats
  const started = completedCount > 0
  const label = isComplete ? 'Review' : started ? 'Resume' : 'Start'
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const num = String(lesson.index).padStart(2, '0')

  return (
    <Card className="group flex h-full flex-col overflow-hidden p-0 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-[0_2px_4px_rgba(28,25,23,0.05),0_18px_40px_-20px_rgba(28,25,23,0.22)]">
      <div className="flex items-center justify-between border-b border-hairline bg-surface px-5 py-3.5">
        <span className="font-display text-2xl font-bold leading-none text-ink/85">{num}</span>
        {isComplete ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-green-soft px-2.5 py-1 text-xs font-bold text-brand-green-text">
            <CheckIcon className="h-3.5 w-3.5" /> Done
          </span>
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-amber-soft text-brand-amber-dark transition group-hover:scale-105">
            <ChartGlyph className="h-6 w-6" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 pt-4 pb-3">
        <div>
          <h3 className="font-display text-xl font-bold leading-tight">{lesson.title}</h3>
          <p className="text-sm font-semibold text-muted">{lesson.subtitle}</p>
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">{lesson.blurb}</p>

        <div className="mt-auto w-full pt-3">
          <div className="mb-1.5 flex justify-between text-xs font-semibold text-muted">
            <span>
              {completedCount} / {total} modules
            </span>
            <span className={isComplete ? 'text-brand-green-text' : started ? 'text-brand-amber-dark' : ''}>
              {pct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete ? 'bg-brand-green' : 'bg-brand-amber'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 pb-5">
        <Button className="flex-1" variant={isComplete ? 'secondary' : 'primary'} onClick={onStart}>
          {label}
        </Button>
        {started && onRestart && (
          <button
            onClick={onRestart}
            aria-label={`Restart ${lesson.title}`}
            title="Restart lesson"
            className="inline-flex items-center justify-center rounded-xl border border-hairline p-3 text-muted transition hover:border-brand-red/40 hover:text-brand-red"
          >
            <RestartIcon />
          </button>
        )}
      </div>
    </Card>
  )
}
