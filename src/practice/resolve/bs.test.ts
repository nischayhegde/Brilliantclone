import { describe, it, expect } from 'vitest'
import { bsPrice, normCdf } from './bs'

describe('normCdf', () => {
  it('is ~0.5 at 0 and monotone', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 3)
    expect(normCdf(1.96)).toBeCloseTo(0.975, 2)
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 2)
  })
})

describe('bsPrice', () => {
  it('an ATM call with real-ish IV is positive and below spot', () => {
    const p = bsPrice('C', 100, 100, 30 / 365, 0.3, 0.01)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(100)
  })
  it('at expiry (t→0) collapses to intrinsic', () => {
    expect(bsPrice('C', 110, 100, 0, 0.3, 0.01)).toBeCloseTo(10, 6)
    expect(bsPrice('P', 90, 100, 0, 0.3, 0.01)).toBeCloseTo(10, 6)
    expect(bsPrice('C', 90, 100, 0, 0.3, 0.01)).toBeCloseTo(0, 6)
  })
  it('put-call parity holds approximately', () => {
    const c = bsPrice('C', 100, 100, 0.5, 0.25, 0.02)
    const p = bsPrice('P', 100, 100, 0.5, 0.25, 0.02)
    // C - P = S - K e^{-rT}
    expect(c - p).toBeCloseTo(100 - 100 * Math.exp(-0.02 * 0.5), 4)
  })
})
