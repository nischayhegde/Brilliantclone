import { describe, it, expect } from 'vitest'
import {
  initialAccount,
  accountReducer,
  tierFor,
  isRuined,
  STARTING_BALANCE,
  RUIN_FLOOR,
  type PracticeAccount,
} from './account'

const apply = (a: PracticeAccount, track: 'charts' | 'options' | 'market-making', score: number, pnl: number) =>
  accountReducer(a, { type: 'APPLY_RESULT', track, score, pnl })

describe('initialAccount', () => {
  it('starts at $10,000, tier 1, zero skill, no ruin events', () => {
    const a = initialAccount()
    expect(a.balance).toBe(STARTING_BALANCE)
    expect(a.balance).toBe(10000)
    expect(a.tier).toEqual({ charts: 1, 'market-making': 1, options: 1 })
    expect(a.skill).toEqual({ charts: 0, 'market-making': 0, options: 0 })
    expect(a.ruinEvents).toBe(0)
  })
})

describe('accountReducer APPLY_RESULT', () => {
  it('adds P&L to the balance (P&L can be negative)', () => {
    let a = apply(initialAccount(), 'charts', 80, 250)
    expect(a.balance).toBe(10250)
    a = apply(a, 'charts', 40, -400)
    expect(a.balance).toBe(9850)
  })

  it('moves the per-track skill toward the latest score (EMA), leaving other tracks untouched', () => {
    const a = apply(initialAccount(), 'charts', 100, 0)
    // EMA from 0 toward 100 with alpha 0.3 → 30
    expect(a.skill.charts).toBeCloseTo(30, 5)
    expect(a.skill.options).toBe(0)
  })

  it('raises the per-track tier as rolling skill crosses thresholds', () => {
    let a = initialAccount()
    for (let i = 0; i < 12; i++) a = apply(a, 'charts', 100, 0) // skill → ~100
    expect(a.skill.charts).toBeGreaterThan(70)
    expect(a.tier.charts).toBeGreaterThan(1)
    expect(a.tier.options).toBe(1) // independent per track
  })

  it('is immutable: returns a new object, never mutates input', () => {
    const a0 = initialAccount()
    const a1 = apply(a0, 'charts', 50, 100)
    expect(a1).not.toBe(a0)
    expect(a0.balance).toBe(10000)
  })
})

describe('tierFor', () => {
  it('maps rolling skill to a tier monotonically', () => {
    expect(tierFor(0)).toBe(1)
    expect(tierFor(100)).toBeGreaterThanOrEqual(tierFor(50))
    expect(tierFor(50)).toBeGreaterThanOrEqual(tierFor(0))
  })
})

describe('isRuined', () => {
  it('is true only at or below the $1,000 floor', () => {
    expect(isRuined({ ...initialAccount(), balance: RUIN_FLOOR })).toBe(true)
    expect(isRuined({ ...initialAccount(), balance: RUIN_FLOOR + 1 })).toBe(false)
  })
})
