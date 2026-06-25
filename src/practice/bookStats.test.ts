import { describe, it, expect } from 'vitest'
import { bookStatsFromCandles } from './bookStats'

const candle = (c: number) => ({ t: 0, o: c, h: c, l: c, c })

describe('bookStatsFromCandles', () => {
  it('reports a flat path with zero volatility', () => {
    const s = bookStatsFromCandles(Array.from({ length: 10 }, () => candle(100)))
    expect(s.sigma).toBe(0)
    expect(s.mid0).toBe(100)
    expect(s.finalMid).toBe(100)
    expect(s.mids.every((m) => m === 100)).toBe(true)
  })
  it('computes a positive sigma for a moving path and preserves endpoints', () => {
    const closes = [100, 101, 99, 102, 98, 103]
    const s = bookStatsFromCandles(closes.map(candle))
    expect(s.sigma).toBeGreaterThan(0)
    expect(s.mid0).toBe(100)
    expect(s.finalMid).toBe(103)
  })
  it('resamples to the requested number of steps', () => {
    const closes = Array.from({ length: 200 }, (_, i) => 100 + i)
    const s = bookStatsFromCandles(closes.map(candle), 20)
    expect(s.mids.length).toBe(20)
    expect(s.mids[0]).toBe(100)
    expect(s.finalMid).toBe(closes[closes.length - 1])
  })
})
