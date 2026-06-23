import type { LessonModule } from '../../data/lessonManifest'
import Button from '../ui/Button'
import PlaceholderChart from './PlaceholderChart'

interface TeachPlaceholderProps {
  module: LessonModule
  onComplete: () => void
}

export default function TeachPlaceholder({ module, onComplete }: TeachPlaceholderProps) {
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-brand-blue">
          Learn · {module.ticker}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">{module.patternName}</h1>
      </div>

      <PlaceholderChart
        label={`${module.patternName} — ${module.ticker}`}
        note="Animated candlestick chart with BUY / SELL / STOP annotations — coming soon"
      />

      <p className="max-w-md text-muted">
        In the full lesson, this teach module animates the real {module.ticker} chart and walks you
        through exactly where to buy, sell, and place your stop for the {module.patternName} pattern.
      </p>

      <Button onClick={onComplete}>Got it</Button>
    </div>
  )
}
