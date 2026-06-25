import { describe, it, expect } from 'vitest'
import {
  initialAccount,
  accountReducer,
  tierFor,
  nextTier,
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

describe('nextTier hysteresis', () => {
  it('raises a tier as soon as skill crosses the next threshold', () => {
    // TIER_THRESHOLDS = [0,35,55,72,88]; at skill 56 tier should be 3.
    expect(nextTier(2, 56)).toBe(3)
  })
  it('does NOT drop a tier until skill falls a full hysteresis band below the current floor', () => {
    // At tier 3 (floor 55): skill 53 is within HYSTERESIS(6) of 55 → stay at 3.
    expect(nextTier(3, 53)).toBe(3)
    // skill 48 (< 55-6=49) → drop to 2.
    expect(nextTier(3, 48)).toBe(2)
  })
  it('never drops below tier 1', () => {
    expect(nextTier(1, -100)).toBe(1)
  })
})

describe('accountReducer APPLY_RESULT uses hysteresis tiers', () => {
  it('keeps a hard-won tier through a single mediocre score (no thrash)', () => {
    let a = initialAccount()
    for (let i = 0; i < 20; i++) a = accountReducer(a, { type: 'APPLY_RESULT', track: 'charts', score: 95, pnl: 0 })
    const tierBefore = a.tier.charts
    a = accountReducer(a, { type: 'APPLY_RESULT', track: 'charts', score: 60, pnl: 0 })
    expect(a.tier.charts).toBe(tierBefore) // one dip doesn't demote
  })
})

describe('accountReducer RESET_AND_REFLECT', () => {
  it('refills to $10k, drops every track tier by one (min 1), and counts a ruin event', () => {
    let a = initialAccount()
    a = { ...a, balance: 800, tier: { charts: 3, options: 2, 'market-making': 1 } }
    const r = accountReducer(a, { type: 'RESET_AND_REFLECT' })
    expect(r.balance).toBe(10000)
    expect(r.tier).toEqual({ charts: 2, options: 1, 'market-making': 1 })
    expect(r.ruinEvents).toBe(1)
  })
  it('preserves rolling skill (the competence signal survives a blowup)', () => {
    let a = initialAccount()
    a = { ...a, balance: 500, skill: { charts: 70, options: 40, 'market-making': 0 } }
    const r = accountReducer(a, { type: 'RESET_AND_REFLECT' })
    expect(r.skill.charts).toBe(70)
  })
})
