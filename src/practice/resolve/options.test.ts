import { describe, it, expect } from 'vitest'
import { resolveOptionsPosition, combinedExpiryMaxLoss, underlyingCloseOn } from './options'
import type { Candle } from '../../data/candles'
import type { OptionsDecision } from '../types'

// Daily candles incl. the expiry date 2021-03-19 (UTC midnight unix = 1616112000).
const day = (iso: string, c: number): Candle => ({ t: Date.parse(iso + 'T00:00:00Z') / 1000, o: c, h: c, l: c, c })
const underlying: Candle[] = [day('2021-02-17', 186), day('2021-03-05', 190), day('2021-03-19', 200)]

describe('underlyingCloseOn', () => {
  it('finds the close on the matching date', () => {
    expect(underlyingCloseOn(underlying, '2021-03-19')).toBe(200)
    expect(underlyingCloseOn(underlying, '2099-01-01')).toBeUndefined()
  })
})

describe('resolveOptionsPosition (hold to expiry, exact)', () => {
  it('books exact intrinsic P&L for a long call held to expiry', () => {
    const d: OptionsDecision = {
      legs: [{ type: 'call', side: 'long', K: 185, expiry: '2021-03-19', premium: 7.93, contracts: 1 }],
      managed: 'hold',
    }
    const out = resolveOptionsPosition(underlying, '2021-02-17', d)
    // (max(200-185,0) - 7.93) * 100 = (15 - 7.93)*100 = 707
    expect(out.pnl).toBeCloseTo(707, 2)
    expect(out.facts.modelEstimate).toBe(false)
  })

  it('a short put kept (expires worthless) books +premium', () => {
    const d: OptionsDecision = {
      legs: [{ type: 'put', side: 'short', K: 180, expiry: '2021-03-19', premium: 4.33, contracts: 2 }],
      managed: 'hold',
    }
    const out = resolveOptionsPosition(underlying, '2021-02-17', d)
    // S=200 > K=180 → put worthless → keep premium 4.33*100*2 = 866
    expect(out.pnl).toBeCloseTo(866, 2)
  })
})

describe('combinedExpiryMaxLoss', () => {
  it('is finite for a vertical spread', () => {
    const legs = [
      { type: 'call' as const, side: 'long' as const, K: 100, premium: 5 },
      { type: 'call' as const, side: 'short' as const, K: 110, premium: 2 },
    ]
    expect(Number.isFinite(combinedExpiryMaxLoss(legs))).toBe(true)
  })
  it('is Infinity for a naked short call', () => {
    const legs = [{ type: 'call' as const, side: 'short' as const, K: 100, premium: 5 }]
    expect(combinedExpiryMaxLoss(legs)).toBe(Infinity)
  })
})
