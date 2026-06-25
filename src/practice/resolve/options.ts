import type { Candle } from '../../data/candles'
import type { OptionsDecision, ScenarioOutcome } from '../types'
import { combinedPnL, legPnL, MULTIPLIER, type Leg } from '../../lessons/volatility/scenes/payoffMath'
import { bsPrice } from './bs'
import { dteDays } from '../chain'

const SECONDS_PER_DAY = 86_400

/** Underlying close on an exact ISO date (UTC), if present. */
export function underlyingCloseOn(underlying: Candle[], iso: string): number | undefined {
  const target = Date.parse(iso + 'T00:00:00Z') / 1000
  const hit = underlying.find((c) => Math.abs(c.t - target) < SECONDS_PER_DAY / 2)
  return hit?.c
}

/** Nearest underlying close on/just before an ISO date (for mid-life valuation). */
function closeNear(underlying: Candle[], iso: string): number | undefined {
  const target = Date.parse(iso + 'T00:00:00Z') / 1000
  let best: Candle | undefined
  for (const c of underlying) if (c.t <= target + SECONDS_PER_DAY && (!best || c.t > best.t)) best = c
  return best?.c
}

/** ISO date that is `frac` of the way from `from` to `exp`. */
function fracDate(from: string, exp: string, frac: number): string {
  const a = Date.parse(from + 'T00:00:00Z')
  const b = Date.parse(exp + 'T00:00:00Z')
  return new Date(a + (b - a) * frac).toISOString().slice(0, 10)
}

/**
 * Combined max loss across the expiry payoff (positive dollars), or Infinity if the
 * loss is unbounded (a naked short call). Scans a wide underlying grid.
 */
export function combinedExpiryMaxLoss(legs: Leg[], sMax = 100000): number {
  let worst = 0
  const step = Math.max(0.5, sMax / 4000)
  for (let S = 0; S <= sMax; S += step) {
    const pnl = combinedPnL(legs, S) * MULTIPLIER
    if (pnl < worst) worst = pnl
  }
  // Unbounded if the high-S tail is still steeply negative (short call).
  const tail = combinedPnL(legs, sMax) * MULTIPLIER
  const tail2 = combinedPnL(legs, sMax * 2) * MULTIPLIER
  if (tail2 < tail - 1) return Infinity
  return worst === 0 ? 0 : -worst
}

/**
 * Books P&L. Held/rolled → EXACT expiry intrinsic on real premiums (the number that
 * hits the balance). Closed-early → a Black–Scholes value at half the DTE using the
 * leg's real IV (flagged modelEstimate; the UI labels it).
 */
export function resolveOptionsPosition(
  underlying: Candle[],
  snapshotDate: string,
  decision: OptionsDecision,
  opts: { ivByLeg?: number[]; r?: number } = {},
): ScenarioOutcome {
  const r = opts.r ?? 0.01

  if (decision.managed === 'closed-early') {
    let pnl = 0
    decision.legs.forEach((leg, i) => {
      const closeDate = fracDate(snapshotDate, leg.expiry, 0.5)
      const S = closeNear(underlying, closeDate) ?? closeNear(underlying, snapshotDate) ?? 0
      const tYears = Math.max(0, dteDays(closeDate, leg.expiry)) / 365
      const sigma = opts.ivByLeg?.[i] ?? 0.3
      const cp = leg.type === 'call' ? 'C' : 'P'
      const value = bsPrice(cp, S, leg.K, tYears, sigma, r) // per share
      const perContract = (leg.side === 'long' ? value - leg.premium : leg.premium - value) * MULTIPLIER
      pnl += perContract * leg.contracts
    })
    return { pnl: Math.round(pnl * 100) / 100, facts: { modelEstimate: true, managed: 'closed-early' } }
  }

  // hold / rolled → exact expiry intrinsic at the (latest) expiry close.
  const latestExpiry = decision.legs.map((l) => l.expiry).sort().at(-1)!
  const S = underlyingCloseOn(underlying, latestExpiry) ?? closeNear(underlying, latestExpiry) ?? 0
  let pnl = 0
  for (const leg of decision.legs) {
    const l: Leg = { type: leg.type, side: leg.side, K: leg.K, premium: leg.premium }
    pnl += legPnL(l, S) * MULTIPLIER * leg.contracts
  }
  return { pnl: Math.round(pnl * 100) / 100, facts: { modelEstimate: false, sExpiry: S, managed: decision.managed ?? 'hold' } }
}
