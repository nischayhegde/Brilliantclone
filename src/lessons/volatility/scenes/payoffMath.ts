/**
 * Pure option-payoff math for Lesson 5 (Straddles & Strangles).
 *
 * Every number drawn, every live readout, and every quiz answer in this lesson is
 * derived from these functions so the animation, the readouts, and the grading can
 * NEVER diverge. All figures are ILLUSTRATIVE simulations (clean round anchors), but
 * the math itself is exactly correct and would hold for any real option chain.
 *
 *   Long call payoff at expiry:  max(S − K, 0) − callPremium
 *   Long put  payoff at expiry:  max(K − S, 0) − putPremium
 *   Short = mirror (negate the long payoff).
 *
 * Per US-equity convention each contract is ×100 shares, so a premium of 7 = $700.
 */

export type LegType = 'call' | 'put'
export type Side = 'long' | 'short'

export interface Leg {
  type: LegType
  side: Side
  /** Strike price. */
  K: number
  /** Premium per share (always a positive cost; `side` decides paid vs collected). */
  premium: number
}

/** Contract multiplier for US equity options. */
export const MULTIPLIER = 100

/** Intrinsic value of a single long leg at expiry price S (premium NOT subtracted). */
export function legIntrinsic(type: LegType, K: number, S: number): number {
  return type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0)
}

/** Full P&L of a single leg at expiry price S, including premium and side. */
export function legPnL(leg: Leg, S: number): number {
  const intrinsic = legIntrinsic(leg.type, leg.K, S)
  // Long: pay the premium, receive intrinsic. Short: collect the premium, owe intrinsic.
  return leg.side === 'long' ? intrinsic - leg.premium : leg.premium - intrinsic
}

/** Combined P&L of a list of legs at expiry price S. */
export function combinedPnL(legs: Leg[], S: number): number {
  return legs.reduce((sum, leg) => sum + legPnL(leg, S), 0)
}

/** Total premium across all legs (per share). Long pays it; short collects it. */
export function totalPremium(legs: Leg[]): number {
  return legs.reduce((sum, leg) => sum + leg.premium, 0)
}

/** True if EVERY leg is short (a short straddle/strangle). */
export function isShort(legs: Leg[]): boolean {
  return legs.length > 0 && legs.every((l) => l.side === 'short')
}

// --- Structure builders ----------------------------------------------------

export function straddle(K: number, callPremium: number, putPremium: number, side: Side = 'long'): Leg[] {
  return [
    { type: 'call', side, K, premium: callPremium },
    { type: 'put', side, K, premium: putPremium },
  ]
}

export function strangle(
  Kp: number,
  Kc: number,
  putPremium: number,
  callPremium: number,
  side: Side = 'long',
): Leg[] {
  return [
    { type: 'put', side, K: Kp, premium: putPremium },
    { type: 'call', side, K: Kc, premium: callPremium },
  ]
}

// --- Breakevens ------------------------------------------------------------

/**
 * Breakeven prices (where combined P&L crosses zero) for a long/short straddle or
 * strangle. Returns [lower, upper], the lower floored at 0 (a stock can't go negative).
 *
 *   Straddle (single strike K):  K − total / K + total
 *   Strangle (Kp < Kc):          Kp − total / Kc + total
 */
export function breakevens(legs: Leg[]): { lower: number; upper: number } {
  const total = totalPremium(legs)
  const calls = legs.filter((l) => l.type === 'call')
  const puts = legs.filter((l) => l.type === 'put')
  const Kc = calls.length ? Math.min(...calls.map((l) => l.K)) : Infinity
  const Kp = puts.length ? Math.max(...puts.map((l) => l.K)) : -Infinity
  return {
    lower: Math.max(0, Kp - total),
    upper: Kc + total,
  }
}

/** The smaller of the two breakeven distances from a reference spot (default 100). */
export function nearestBreakevenMove(legs: Leg[], spot = 100): number {
  const be = breakevens(legs)
  return Math.min(Math.abs(be.upper - spot), Math.abs(spot - be.lower))
}

/**
 * Did expiry price S clear a breakeven (i.e., land in profit) for a LONG structure?
 * For a long straddle/strangle, profit is OUTSIDE the breakevens.
 */
export function clearedBreakeven(legs: Leg[], S: number): boolean {
  const be = breakevens(legs)
  return S < be.lower || S > be.upper
}

/** Round to 2 decimals, dropping a trailing .00 → integer-ish display. */
export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r) ? r.toString() : r.toFixed(2)
}

/** Signed P&L string, e.g. "+5" / "−3". */
export function fmtSigned(n: number): string {
  const r = Math.round(n * 100) / 100
  if (r > 0) return '+' + fmt(r)
  if (r < 0) return '−' + fmt(-r)
  return '0'
}

/** Dollar figure (×100), signed, e.g. "+$500" / "−$300". */
export function fmtDollars(n: number): string {
  const d = Math.round(n * MULTIPLIER)
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  return `${sign}$${Math.abs(d)}`
}
