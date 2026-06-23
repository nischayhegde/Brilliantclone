import Card from './ui/Card'
import Button from './ui/Button'
import { ChartGlyph } from './icons'
import { LESSON_TITLE } from '../data/lessonManifest'
import { TOTAL_MODULES } from '../domain/progress'

interface LessonCardProps {
  completedCount: number
  isComplete: boolean
  onStart: () => void
}

export default function LessonCard({ completedCount, isComplete, onStart }: LessonCardProps) {
  const started = completedCount > 0
  const label = isComplete ? 'Review lesson' : started ? 'Resume' : 'Start'
  const pct = Math.round((completedCount / TOTAL_MODULES) * 100)

  return (
    <Card className="p-0">
      <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
        <span className="rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-blue">
          Recommended
        </span>
        <h2 className="max-w-md text-2xl font-extrabold leading-tight">{LESSON_TITLE}</h2>
        <p className="text-sm font-bold uppercase tracking-wide text-brand-blue">Level 1</p>

        <div className="my-2 flex h-28 w-44 items-center justify-center rounded-2xl bg-brand-blue-soft">
          <ChartGlyph className="text-brand-blue" />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-1 flex justify-between text-xs font-semibold text-muted">
            <span>
              {completedCount} / {TOTAL_MODULES} modules
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-brand-green transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      <div className="px-6 pb-6">
        <Button className="w-full" onClick={onStart}>
          {label}
        </Button>
      </div>
    </Card>
  )
}
