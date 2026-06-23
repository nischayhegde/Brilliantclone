/**
 * Pure option math — ONE source of truth shared by every Lesson 4 scene and by the
 * quiz grading (via the values baked into index.ts). No Phaser, no side effects.
 *
 * Conventions (held EXACTLY correct everywhere):
 *   call intrinsic = max(S − K, 0)      put intrinsic = max(K − S, 0)
 *   long-call breakeven  = K + premium  long-put breakeven  = K − premium
 *   (short legs mirror the long across the x-axis; same breakeven price)
 *   per-contract P&L = (payoff − cost) × 100
 *
 * Premiums / deltas fed in are ILLUSTRATIVE example numbers; the formulas built on
 * them are exact.
 */

export type OptType = 'call' | 'put'
export type Side = 'long' | 'short'

export interface Position {
  type: OptType
  side: Side
  K: number
  premium: number
}

/** Intrinsic value per share at price S (always ≥ 0). */
export function intrinsic(type: OptType, S: number, K: number): number {
  return type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0)
}

/**
 * Profit/loss PER SHARE at expiry for a position at underlying price S.
 * long  = intrinsic − premium ; short = premium − intrinsic.
 */
export function pnlPerShare(pos: Position, S: number): number {
  const value = intrinsic(pos.type, S, pos.K)
  return pos.side === 'long' ? value - pos.premium : pos.premium - value
}

/** Per-contract P&L = per-share × 100. */
export function pnlPerContract(pos: Position, S: number): number {
  return pnlPerShare(pos, S) * 100
}

/**
 * Breakeven UNDERLYING price (same for long and its mirror short):
 * call → K + premium, put → K − premium.
 */
export function breakeven(type: OptType, K: number, premium: number): number {
  return type === 'call' ? K + premium : K - premium
}

/** Max loss per CONTRACT (positive dollar number), or Infinity if unbounded. */
export function maxLoss(pos: Position): number {
  if (pos.side === 'long') return pos.premium * 100 // can decline to exercise
  // short call: stock can rise without bound → unlimited loss
  if (pos.type === 'call') return Infinity
  // short put: worst case S = 0 → loss = (K − premium) × 100
  return (pos.K - pos.premium) * 100
}

/** Max gain per CONTRACT (positive dollar number), or Infinity if unbounded. */
export function maxGain(pos: Position): number {
  if (pos.side === 'short') return pos.premium * 100 // keep the premium
  // long call: unbounded upside
  if (pos.type === 'call') return Infinity
  // long put: best case S = 0 → (K − premium) × 100
  return (pos.K - pos.premium) * 100
}

/** Moneyness tag from spot vs strike (ATM within `tol`). */
export function moneyness(type: OptType, S: number, K: number, tol = 0.5): 'ITM' | 'ATM' | 'OTM' {
  if (Math.abs(S - K) <= tol) return 'ATM'
  const inMoney = type === 'call' ? S > K : S < K
  return inMoney ? 'ITM' : 'OTM'
}

/**
 * Long-call % return at expiry for a single contract bought at `premium`:
 *   ( max(S − K, 0) − premium ) / premium.  (−100% when it expires worthless.)
 */
export function leverageReturn(K: number, premium: number, S: number): number {
  const value = Math.max(S - K, 0)
  return (value - premium) / premium
}
