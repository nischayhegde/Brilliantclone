import Button from '../components/ui/Button'
import { usePractice } from '../state/PracticeContext'

export default function ResetReflect() {
  const { ruinSummary, resetAndReflect, account } = usePractice()
  if (!ruinSummary) return null
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-3xl border border-hairline bg-white p-8 text-center">
      <span className="rounded-full bg-brand-red-soft px-3 py-1 text-xs font-bold text-brand-red">Account reset</span>
      <h2 className="font-display text-2xl font-bold">{ruinSummary.headline}</h2>
      {ruinSummary.causes.length > 0 && (
        <ul className="w-full space-y-1 text-left">
          {ruinSummary.causes.map((c) => (
            <li key={c.id} className="flex justify-between text-sm">
              <span className="font-semibold">{c.label}</span>
              <span className="text-muted">{c.count}× recently</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-base leading-relaxed text-ink-soft">{ruinSummary.coaching}</p>
      <p className="text-sm text-muted">
        We&rsquo;ll refill your paper account to $10,000 and step the difficulty down a notch. This is reset #{account.ruinEvents + 1}.
        Your skill rating is kept.
      </p>
      <Button onClick={resetAndReflect}>Reset &amp; keep practicing</Button>
    </div>
  )
}
