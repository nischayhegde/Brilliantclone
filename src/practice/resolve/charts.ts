import type { Candle } from '../../data/candles'
import type { ChartsDecision, DataRef, ScenarioOutcome } from '../types'

export interface Frictions {
  /** Per-share commission applied on entry and exit. */
  feePerShare: number
  /** Half-spread as a fraction of price, applied against the learner on each side. */
  spreadFrac: number
}
export const DEFAULT_FRICTIONS: Frictions = { feePerShare: 0.005, spreadFrac: 0.0005 }

/** Deterministic replay of the hidden candles into a graded outcome. Honest fills. */
export function resolveChartTrade(
  candles: Candle[],
  decision: ChartsDecision,
  ref: DataRef,
  frictions: Frictions = DEFAULT_FRICTIONS,
): ScenarioOutcome {
  const split = ref.splitIndex ?? Math.floor(candles.length * 0.6)
  const end = Math.min(ref.revealToIndex ?? candles.length, candles.length)
  const netMove = candles[end - 1].c - candles[split].c

  if (!decision.took) {
    return { pnl: 0, facts: { took: false, hit: 'none', netMove } }
  }

  const long = decision.direction !== 'short'
  const shares = decision.shares ?? 100
  const rawEntry = decision.entry ?? candles[split].c
  // Spread costs the learner: buy a touch higher, sell a touch lower.
  const entry = long ? rawEntry * (1 + frictions.spreadFrac) : rawEntry * (1 - frictions.spreadFrac)
  const tp = decision.target
  const sl = decision.stop

  let exit = candles[end - 1].c
  let hit: 'tp' | 'sl' | 'end' = 'end'
  let exitIndex = end - 1

  for (let i = split + 1; i < end; i++) {
    const c = candles[i]
    // Stop first (conservative). Gap THROUGH the level fills at the open, not the level.
    if (sl !== undefined) {
      if (long && c.l <= sl) {
        exit = Math.min(sl, c.o) // gap down → open is worse than the level
        hit = 'sl'; exitIndex = i; break
      }
      if (!long && c.h >= sl) {
        exit = Math.max(sl, c.o)
        hit = 'sl'; exitIndex = i; break
      }
    }
    if (tp !== undefined) {
      if (long && c.h >= tp) {
        exit = Math.max(tp, c.o) // gap up in your favour → fill at the better open
        hit = 'tp'; exitIndex = i; break
      }
      if (!long && c.l <= tp) {
        exit = Math.min(tp, c.o)
        hit = 'tp'; exitIndex = i; break
      }
    }
  }
  // Honour an early managed exit if it precedes the natural exit.
  if (decision.managedExitIndex !== undefined && decision.managedExitIndex < exitIndex) {
    exitIndex = decision.managedExitIndex
    exit = candles[exitIndex].c
    hit = 'end'
  }

  const exitFilled = long ? exit * (1 - frictions.spreadFrac) : exit * (1 + frictions.spreadFrac)
  const perShare = long ? exitFilled - entry : entry - exitFilled
  const pnl = Math.round((perShare * shares - frictions.feePerShare * shares * 2) * 100) / 100

  return { pnl, facts: { took: true, hit, exit: Math.round(exit * 100) / 100, exitIndex, netMove } }
}
