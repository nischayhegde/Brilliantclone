import Card from './ui/Card'
import Button from './ui/Button'
import { ChartGlyph, RestartIcon } from './icons'
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

  return (
    <Card className="flex h-full flex-col p-0">
      <div className="flex flex-1 flex-col gap-3 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-blue">
            Level {lesson.level}
          </span>
          {isComplete && (
            <span className="rounded-full bg-brand-green-soft px-2 py-0.5 text-xs font-bold text-brand-green">
              Done
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-soft">
            <ChartGlyph className="h-7 w-7 text-brand-blue" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold leading-tight">{lesson.title}</h3>
            <p className="text-sm font-semibold text-muted">{lesson.subtitle}</p>
          </div>
        </div>

        <p className="text-sm text-muted">{lesson.blurb}</p>

        <div className="mt-auto w-full pt-2">
          <div className="mb-1 flex justify-between text-xs font-semibold text-muted">
            <span>
              {completedCount} / {total} modules
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-5 pb-5">
        <Button className="flex-1" onClick={onStart}>
          {label}
        </Button>
        {started && onRestart && (
          <button
            onClick={onRestart}
            aria-label={`Restart ${lesson.title}`}
            title="Restart lesson"
            className="inline-flex items-center gap-1 rounded-2xl border border-hairline px-3 py-3 text-xs font-semibold text-muted transition hover:border-brand-red/40 hover:text-brand-red"
          >
            <RestartIcon />
          </button>
        )}
      </div>
    </Card>
  )
}
