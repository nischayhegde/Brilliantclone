import { CloseIcon, ChevronLeftIcon } from './icons'

interface ProgressBarProps {
  total: number
  completedCount: number
  /** 1-based id of the module currently being played. */
  currentIndex: number
  onClose: () => void
  /** Previous-module button; omitted/disabled on the first module. */
  onBack?: () => void
  /** Makes unlocked segments clickable to jump straight to that module. */
  onJump?: (index: number) => void
  /** Highest module the learner may navigate to (defaults to total). */
  maxUnlocked?: number
}

export default function ProgressBar({
  total,
  completedCount,
  currentIndex,
  onClose,
  onBack,
  onJump,
  maxUnlocked = total,
}: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClose}
        aria-label="Exit lesson"
        className="shrink-0 rounded-full p-1 text-muted transition hover:bg-gray-100 hover:text-ink"
      >
        <CloseIcon />
      </button>
      <button
        onClick={onBack}
        disabled={!onBack}
        aria-label="Previous module"
        className="shrink-0 rounded-full p-1 text-muted transition hover:bg-gray-100 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
      >
        <ChevronLeftIcon />
      </button>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1
          const done = idx <= completedCount
          const current = idx === currentIndex
          const tone = done ? 'bg-brand-green' : current ? 'bg-brand-blue' : 'bg-gray-200'
          const base = `h-2 flex-1 rounded-full transition-colors ${tone}`
          if (onJump && idx <= maxUnlocked) {
            return (
              <button
                key={idx}
                onClick={() => onJump(idx)}
                aria-label={`Go to module ${idx}`}
                className={`${base} cursor-pointer border-0 p-0 hover:opacity-60`}
              />
            )
          }
          return <div key={idx} className={base} />
        })}
      </div>
    </div>
  )
}
