import { CloseIcon } from './icons'

interface ProgressBarProps {
  total: number
  completedCount: number
  /** 1-based id of the module currently being played. */
  currentIndex: number
  onClose: () => void
}

export default function ProgressBar({
  total,
  completedCount,
  currentIndex,
  onClose,
}: ProgressBarProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClose}
        aria-label="Exit lesson"
        className="shrink-0 rounded-full p-1 text-muted transition hover:bg-gray-100 hover:text-ink"
      >
        <CloseIcon />
      </button>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1
          const done = idx <= completedCount
          const current = idx === currentIndex
          return (
            <div
              key={idx}
              className={`h-2 flex-1 rounded-full transition-colors ${
                done ? 'bg-brand-green' : current ? 'bg-brand-blue' : 'bg-gray-200'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
