import type { WidgetProps } from '../WidgetHost'
import { fmtMoney } from '../../../lessons/order-book/scenes/book'
import { fmtPrice } from './chartScale'
import { payoffSummary } from './payoffCurve'
import { useLegs } from './context'
import PayoffSvg from './PayoffSvg'
import { WidgetCard } from './ui'

function money(n: number, unlimited: boolean, undefinedRisk: boolean): string {
  if (unlimited) return 'Unlimited'
  if (undefinedRisk) return 'Undefined'
  return fmtMoney(n)
}

/** Display-only live payoff preview of a sibling `option-leg-builder`'s legs. */
export default function PayoffGraph({ widget }: WidgetProps) {
  if (widget.kind !== 'payoff-graph') return null
  const { legs } = useLegs()
  const source = widget.config.source
  const myLegs = source ? legs[source] ?? [] : Object.values(legs).flat()

  if (myLegs.length === 0) {
    return (
      <WidgetCard label="Payoff">
        <div className="grid h-32 place-items-center rounded-xl bg-surface text-sm text-muted">
          Add option legs to preview the payoff.
        </div>
      </WidgetCard>
    )
  }

  const sum = payoffSummary(myLegs)
  return (
    <WidgetCard label="Payoff at expiry">
      <PayoffSvg legs={myLegs} ariaLabel="Option payoff diagram at expiry" />
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <dt className="text-muted">Max profit</dt>
          <dd className="font-semibold text-brand-green-text">{money(sum.maxProfit, sum.unlimitedProfit, false)}</dd>
        </div>
        <div>
          <dt className="text-muted">Max loss</dt>
          <dd className="font-semibold text-brand-red">{money(sum.maxLoss, false, sum.unlimitedLoss)}</dd>
        </div>
        <div>
          <dt className="text-muted">Breakeven{sum.breakevens.length === 1 ? '' : 's'}</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {sum.breakevens.length ? sum.breakevens.map((b) => fmtPrice(b)).join(' · ') : '—'}
          </dd>
        </div>
      </dl>
    </WidgetCard>
  )
}
