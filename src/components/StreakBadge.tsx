import { FlameIcon } from './icons'

export default function StreakBadge({ count }: { count: number }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-sm font-bold text-ink"
      title="Best streak — most modules completed in one sitting"
    >
      <FlameIcon className={count > 0 ? 'text-brand-amber' : 'text-hairline'} />
      <span>{count}</span>
    </div>
  )
}
