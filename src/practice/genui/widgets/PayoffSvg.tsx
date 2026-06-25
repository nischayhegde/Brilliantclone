/** Deterministic option payoff diagram (shared by `payoff-graph` + the inline preview in
 * `option-leg-builder`). All P&L is sampled from `payoffCurve` (which reuses the lesson's
 * exact `payoffMath`); this component only maps it to SVG coordinates. */
import { payoffSamples, priceDomain } from './payoffCurve'
import type { OptionLegDecision } from '../../types'

const W = 360
const H = 180
const PADX = 10
const PADY = 14

export default function PayoffSvg({ legs, ariaLabel = 'Payoff diagram' }: { legs: OptionLegDecision[]; ariaLabel?: string }) {
  const dom = priceDomain(legs)
  const samples = payoffSamples(legs, dom.min, dom.max, 81)
  const pnls = samples.map((s) => s.pnl)
  let lo = Math.min(...pnls)
  let hi = Math.max(...pnls)
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) {
    lo = -1
    hi = 1
  }
  const range = hi - lo || 1
  const xFor = (S: number) => PADX + ((S - dom.min) / (dom.max - dom.min || 1)) * (W - 2 * PADX)
  const yFor = (p: number) => PADY + ((hi - p) / range) * (H - 2 * PADY)
  const yZero = Math.max(PADY, Math.min(H - PADY, yFor(0)))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="w-full rounded-xl bg-surface">
      {/* zero P&L baseline */}
      <line x1={PADX} x2={W - PADX} y1={yZero} y2={yZero} stroke="var(--color-ink)" strokeOpacity={0.3} strokeDasharray="3 3" />
      {/* strike ticks */}
      {legs.map((l, i) => (
        <line key={i} x1={xFor(l.K)} x2={xFor(l.K)} y1={PADY} y2={H - PADY} stroke="var(--color-hairline)" />
      ))}
      {/* payoff curve, segment-colored by P&L sign */}
      {samples.slice(1).map((s, i) => {
        const a = samples[i]
        const up = (a.pnl + s.pnl) / 2 >= 0
        return (
          <line
            key={i}
            x1={xFor(a.S)}
            y1={yFor(a.pnl)}
            x2={xFor(s.S)}
            y2={yFor(s.pnl)}
            stroke={up ? 'var(--color-brand-green)' : 'var(--color-brand-red)'}
            strokeWidth={2}
          />
        )
      })}
    </svg>
  )
}
