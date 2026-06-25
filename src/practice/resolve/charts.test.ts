import { describe, it, expect } from 'vitest'
import { resolveChartTrade, DEFAULT_FRICTIONS } from './charts'
import type { Candle } from '../../data/candles'
import type { ChartsDecision } from '../types'

// candles: index 0..3. Split at 1 (decide on close of idx 1 = 100). Reveal to 4.
const candles: Candle[] = [
  { t: 0, o: 98, h: 101, l: 97, c: 100 },
  { t: 1, o: 100, h: 102, l: 99, c: 100 }, // split index 1
  { t: 2, o: 101, h: 106, l: 100, c: 105 }, // hits a TP at 105
  { t: 3, o: 105, h: 107, l: 95, c: 96 }, // would hit SL 97 here
]
const ref = { splitIndex: 1, revealToIndex: 4 }

describe('resolveChartTrade', () => {
  it('fills a long take-profit before a later stop, P&L net of fees', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, target: 105, stop: 97, shares: 100 }
    const out = resolveChartTrade(candles, d, ref, { feePerShare: 0, spreadFrac: 0 })
    expect(out.facts.hit).toBe('tp')
    expect(out.facts.exit).toBe(105)
    expect(out.pnl).toBe(500) // (105-100)*100
  })

  it('honest fill: a gap THROUGH the stop fills at the bar open, not the level', () => {
    // Long, stop 97; bar idx3 opens 105 then craters; low 95 ≤ 97 → stop hit, fill at min(level, open)=97 (no gap down through at open here)
    const gap: Candle[] = [
      { t: 0, o: 98, h: 101, l: 97, c: 100 },
      { t: 1, o: 100, h: 101, l: 99, c: 100 },
      { t: 2, o: 90, h: 92, l: 88, c: 89 }, // GAPS DOWN: opens 90, already below stop 97
    ]
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, target: 110, stop: 97, shares: 100 }
    const out = resolveChartTrade(gap, d, { splitIndex: 1, revealToIndex: 3 }, { feePerShare: 0, spreadFrac: 0 })
    expect(out.facts.hit).toBe('sl')
    expect(out.facts.exit).toBe(90) // filled at the open, worse than the 97 level
    expect(out.pnl).toBe(-1000)
  })

  it('a skip yields zero P&L and records the net move for grading', () => {
    const d: ChartsDecision = { took: false }
    const out = resolveChartTrade(candles, d, ref, { feePerShare: 0, spreadFrac: 0 })
    expect(out.pnl).toBe(0)
    expect(out.facts.took).toBe(false)
    expect(out.facts.netMove).toBe(candles[3].c - candles[1].c) // -4
  })

  it('applies fees + spread against the learner by default', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, target: 105, stop: 97, shares: 100 }
    const out = resolveChartTrade(candles, d, ref, DEFAULT_FRICTIONS)
    expect(out.pnl).toBeLessThan(500) // frictions shave the gross
  })
})
