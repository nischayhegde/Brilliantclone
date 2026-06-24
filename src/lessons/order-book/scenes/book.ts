/**
 * Shared order-book types + pure math for Lesson 2 scenes.
 *
 * Every ladder in this lesson is a DETERMINISTIC ILLUSTRATIVE SIMULATION (see
 * planning/Lesson2Spec.md §4) — the numbers are fixed, clean, and the arithmetic
 * (spread, mid, size-weighted average fill, slippage, round-trip cost, spread %)
 * is exactly correct. These helpers are the single source of that math so a scene
 * and its caption can never drift apart.
 */

export interface Level {
  price: number
  size: number
}

export interface Fill {
  price: number
  shares: number
}

export interface WalkResult {
  fills: Fill[]
  /** Shares actually filled (may be < requested if depth runs out). */
  filled: number
  /** Size-weighted average fill price (NaN if nothing filled). */
  avgFill: number
  /** Best-ask price the order started at. */
  touch: number
  /** avgFill - touch (per share). */
  slippagePerShare: number
  /** (avgFill - touch) * filled. */
  slippageTotal: number
  /** Requested size left unfilled because depth ran out. */
  unfilled: number
}

/** Walk a market BUY of `size` up the ask side. Pure, exact. */
export function walkBuy(asks: Level[], size: number): WalkResult {
  const fills: Fill[] = []
  let remaining = Math.max(0, Math.round(size))
  let notional = 0
  let filled = 0
  const touch = asks[0]?.price ?? NaN
  for (const lvl of asks) {
    if (remaining <= 0) break
    const take = Math.min(remaining, lvl.size)
    if (take <= 0) continue
    fills.push({ price: lvl.price, shares: take })
    notional += lvl.price * take
    filled += take
    remaining -= take
  }
  const avgFill = filled > 0 ? notional / filled : NaN
  return {
    fills,
    filled,
    avgFill,
    touch,
    slippagePerShare: filled > 0 ? avgFill - touch : 0,
    slippageTotal: filled > 0 ? (avgFill - touch) * filled : 0,
    unfilled: remaining,
  }
}

/** Format a price with enough precision to show sub-penny mids (e.g. 400.005). */
export function fmtPrice(p: number, dp = 2): string {
  if (!isFinite(p)) return '—'
  return p.toFixed(dp)
}

/** Money with thousands separators, e.g. 1090 -> "$1,090". */
export function fmtMoney(n: number, dp = 0): string {
  const sign = n < 0 ? '-' : ''
  const v = Math.abs(n)
  return sign + '$' + v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

/** Integer share count with separators, e.g. 1500 -> "1,500". */
export function fmtShares(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
