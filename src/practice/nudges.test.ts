import { describe, it, expect } from 'vitest'
import { NUDGES, evaluateNudges, type NudgeContext } from './nudges'

const base: NudgeContext = {
  constraints: { accountBalance: 10000, maxRiskPct: 2 },
  riskDollars: 0,
  hasStop: true,
  hasUndefinedRiskLeg: false,
  tradesInWindow: 1,
}

describe('sizing nudge', () => {
  it('fires when risk exceeds maxRiskPct of the account', () => {
    const ctx = { ...base, riskDollars: 500 } // 5% of 10k > 2%
    expect(NUDGES['sizing'].triggered(ctx)).toBe(true)
  })
  it('stays quiet within the risk budget', () => {
    const ctx = { ...base, riskDollars: 150 } // 1.5%
    expect(NUDGES['sizing'].triggered(ctx)).toBe(false)
  })
})

describe('no-stop and undefined-risk nudges', () => {
  it('no-stop fires when a trade is taken without a stop', () => {
    expect(NUDGES['no-stop'].triggered({ ...base, hasStop: false })).toBe(true)
  })
  it('undefined-risk fires on a naked short leg', () => {
    expect(NUDGES['undefined-risk'].triggered({ ...base, hasUndefinedRiskLeg: true })).toBe(true)
  })
})

describe('evaluateNudges', () => {
  it('returns only the fired ids, in catalog order, ignoring unknown ids', () => {
    const ctx = { ...base, riskDollars: 800, hasStop: false }
    expect(evaluateNudges(['no-stop', 'sizing', 'nope'], ctx)).toEqual(['sizing', 'no-stop'])
  })
})

describe('market-making nudges', () => {
  const mmBase = { constraints: { accountBalance: 10000, maxRiskPct: 5 } } as never
  it('fires spread-too-tight when half-spread is far below realized vol', () => {
    const ctx = { ...mmBase, decision: { bidWidth: 0.05, askWidth: 0.05, quoteSize: 100, maxInventory: 200 }, sigma: 1 } as never
    expect(NUDGES['spread-too-tight'].triggered(ctx)).toBe(true)
  })
  it('fires inventory-runaway when the cap notional dwarfs the account', () => {
    const ctx = { ...mmBase, decision: { bidWidth: 1, askWidth: 1, quoteSize: 100, maxInventory: 100000 }, finalMid: 100 } as never
    expect(NUDGES['inventory-runaway'].triggered(ctx)).toBe(true)
  })
  it('returns fired ids via evaluateNudges', () => {
    const ctx = { ...mmBase, decision: { bidWidth: 0.05, askWidth: 0.05, quoteSize: 100, maxInventory: 200 }, sigma: 1 } as never
    expect(evaluateNudges(['spread-too-tight'], ctx)).toContain('spread-too-tight')
  })
})
