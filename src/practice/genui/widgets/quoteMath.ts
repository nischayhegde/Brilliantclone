/**
 * Pure market-making quote math for the `quote-ladder` widget. The arithmetic
 * (bid/ask from mid ± width, spread, spread %) is exact; the mid is the last real
 * close. NO React/DOM imports.
 */

export interface Quote {
  bid: number
  ask: number
  spread: number
  /** Spread as a fraction of mid (0 when mid ≤ 0). */
  spreadPct: number
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Two-sided quote from a mid and half-spreads below/above it. */
export function quoteFromMid(mid: number, bidWidth: number, askWidth: number): Quote {
  const bid = round4(mid - bidWidth)
  const ask = round4(mid + askWidth)
  const spread = round4(ask - bid)
  return { bid, ask, spread, spreadPct: mid > 0 ? spread / mid : 0 }
}

/** Stepped price levels away from the mid for the ladder readout. */
export function ladderLevels(mid: number, width: number, levels: number, side: 'bid' | 'ask'): number[] {
  const out: number[] = []
  for (let k = 1; k <= levels; k++) {
    out.push(round4(side === 'bid' ? mid - width * k : mid + width * k))
  }
  return out
}
