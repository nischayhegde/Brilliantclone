import { describe, it, expect } from 'vitest'
import { makeChartScale, priceRange, DEFAULT_CHART_PAD } from './chartScale'
import type { Candle } from '../../../data/candles'

const candles: Candle[] = [
  { t: 1, o: 10, h: 12, l: 9, c: 11 },
  { t: 2, o: 11, h: 14, l: 10, c: 13 },
  { t: 3, o: 13, h: 15, l: 8, c: 9 },
]

describe('priceRange', () => {
  it('pads the [low,high] envelope of the candle slice', () => {
    const r = priceRange(candles, 0.08)
    // lo=8, hi=15, pad=(15-8)*0.08=0.56
    expect(r.min).toBeCloseTo(7.44, 5)
    expect(r.max).toBeCloseTo(15.56, 5)
  })

  it('handles a degenerate (flat) slice without NaN', () => {
    const flat: Candle[] = [{ t: 1, o: 5, h: 5, l: 5, c: 5 }]
    const r = priceRange(flat)
    expect(r.min).toBeLessThan(5)
    expect(r.max).toBeGreaterThan(5)
  })

  it('handles an empty slice', () => {
    const r = priceRange([])
    expect(Number.isFinite(r.min)).toBe(true)
    expect(Number.isFinite(r.max)).toBe(true)
    expect(r.min).toBeLessThan(r.max)
  })
})

describe('makeChartScale', () => {
  const s = makeChartScale(candles, { width: 480, height: 280 })

  it('maps pmin to the plot bottom and pmax to the plot top', () => {
    expect(s.yFor(s.pmin)).toBeCloseTo(s.plot.b, 5)
    expect(s.yFor(s.pmax)).toBeCloseTo(s.plot.t, 5)
  })

  it('priceFor is the inverse of yFor', () => {
    const mid = (s.pmin + s.pmax) / 2
    expect(s.priceFor(s.yFor(mid))).toBeCloseTo(mid, 5)
  })

  it('priceFor clamps y outside the plot to the price extremes', () => {
    expect(s.priceFor(s.plot.b + 999)).toBeCloseTo(s.pmin, 5)
    expect(s.priceFor(s.plot.t - 999)).toBeCloseTo(s.pmax, 5)
  })

  it('places candle centers left-to-right inside the plot', () => {
    expect(s.xFor(0)).toBeGreaterThan(s.plot.l)
    expect(s.xFor(0)).toBeLessThan(s.xFor(1))
    expect(s.xFor(1)).toBeLessThan(s.xFor(2))
    expect(s.xFor(2)).toBeLessThan(s.plot.r)
  })

  it('indexFor inverts xFor and clamps to the candle range', () => {
    expect(s.indexFor(s.xFor(1))).toBe(1)
    expect(s.indexFor(-100)).toBe(0)
    expect(s.indexFor(99999)).toBe(candles.length - 1)
  })

  it('uses the default pad and a sane body width', () => {
    expect(s.plot.l).toBe(DEFAULT_CHART_PAD.left)
    expect(s.bodyW).toBeGreaterThan(0)
    expect(s.bodyW).toBeLessThanOrEqual(11)
  })
})
