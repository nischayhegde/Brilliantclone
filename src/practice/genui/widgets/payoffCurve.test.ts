import { describe, it, expect } from 'vitest'
import { combinedDollars, payoffSamples, priceDomain, payoffSummary } from './payoffCurve'
import type { OptionLegDecision } from '../../types'

const longCall: OptionLegDecision = { type: 'call', side: 'long', K: 100, expiry: '2021-03-19', premium: 5, contracts: 1 }
const shortCall: OptionLegDecision = { ...longCall, side: 'short' }
const longStraddle: OptionLegDecision[] = [
  { type: 'call', side: 'long', K: 100, expiry: 'x', premium: 5, contracts: 1 },
  { type: 'put', side: 'long', K: 100, expiry: 'x', premium: 4, contracts: 1 },
]

describe('combinedDollars', () => {
  it('scales per-share P&L by contracts and the 100 multiplier', () => {
    // long call: (max(110-100,0)-5)*1*100 = 500
    expect(combinedDollars([longCall], 110)).toBe(500)
    // below strike: -premium*100 = -500
    expect(combinedDollars([longCall], 100)).toBe(-500)
  })

  it('mirrors for a short leg', () => {
    expect(combinedDollars([shortCall], 110)).toBe(-500)
  })
})

describe('payoffSamples', () => {
  it('returns n samples across the domain', () => {
    const s = payoffSamples([longCall], 80, 120, 5)
    expect(s).toHaveLength(5)
    expect(s[0].S).toBeCloseTo(80, 5)
    expect(s[4].S).toBeCloseTo(120, 5)
  })
})

describe('priceDomain', () => {
  it('brackets the strikes with padding', () => {
    const d = priceDomain(longStraddle)
    expect(d.min).toBeLessThan(100)
    expect(d.max).toBeGreaterThan(100)
    expect(d.min).toBeGreaterThanOrEqual(0)
  })
})

describe('payoffSummary', () => {
  it('flags unlimited profit + defined risk for a long call', () => {
    const sum = payoffSummary([longCall])
    expect(sum.definedRisk).toBe(true)
    expect(sum.unlimitedProfit).toBe(true)
    expect(sum.unlimitedLoss).toBe(false)
    expect(sum.maxLoss).toBeCloseTo(-500, 0)
  })

  it('flags unlimited loss for a naked short call', () => {
    const sum = payoffSummary([shortCall])
    expect(sum.definedRisk).toBe(false)
    expect(sum.unlimitedLoss).toBe(true)
  })

  it('reports two breakevens for a long straddle', () => {
    const sum = payoffSummary(longStraddle)
    // total premium 9 -> breakevens at 91 and 109
    expect(sum.breakevens.length).toBe(2)
    expect(Math.min(...sum.breakevens)).toBeCloseTo(91, 0)
    expect(Math.max(...sum.breakevens)).toBeCloseTo(109, 0)
  })
})
