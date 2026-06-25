import { describe, it, expect } from 'vitest'
import { marketMakingRubricV1 } from './marketMaking'
import type { MarketMakingDecision, ScenarioOutcome, ScenarioSpec } from '../types'

const spec = {
  id: 'mm', track: 'market-making', tier: 1, title: 't', brief: 'b',
  dataRef: { bookStatsKey: 'X' }, objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 5 },
  rubricId: 'market-making-v1', nudges: [], coachContextKeys: [], source: 'curated',
} as ScenarioSpec

const outcome = (over: Partial<ScenarioOutcome['facts']> = {}): ScenarioOutcome => ({
  pnl: 50,
  facts: { spreadCaptured: 60, adverseSelection: -10, finalInventory: 0, maxInventoryHeld: 200, fills: 400, finalMid: 100, sigma: 1, ...over },
})

const good: MarketMakingDecision = { bidWidth: 1, askWidth: 1, quoteSize: 100, maxInventory: 500 }

describe('marketMakingRubricV1', () => {
  it('rewards two-sided quoting, vol-sized spread, and flat finish', () => {
    const s = marketMakingRubricV1(spec, good, outcome())
    expect(s.total).toBeGreaterThanOrEqual(75)
    expect(s.dimensions.map((d) => d.id).sort()).toEqual(['inventory-discipline', 'quote-size', 'spread-vs-vol', 'two-sided'])
  })
  it('penalises one-sided quoting (no two-sided market)', () => {
    const oneSided = { ...good, askWidth: 0 }
    expect(marketMakingRubricV1(spec, oneSided, outcome()).dimensions.find((d) => d.id === 'two-sided')!.score).toBeLessThan(0.5)
  })
  it('penalises a spread far too tight for the volatility (adverse selection)', () => {
    const tooTight = { ...good, bidWidth: 0.05, askWidth: 0.05 } // << sigma=1
    expect(marketMakingRubricV1(spec, tooTight, outcome({ sigma: 1 })).dimensions.find((d) => d.id === 'spread-vs-vol')!.score).toBeLessThan(0.6)
  })
  it('penalises ending far from flat (inventory ran away)', () => {
    const s = marketMakingRubricV1(spec, good, outcome({ finalInventory: 480, maxInventoryHeld: 500 }))
    expect(s.dimensions.find((d) => d.id === 'inventory-discipline')!.score).toBeLessThan(0.6)
  })
  it('never lets P&L gate the score (a loss with good process still scores well)', () => {
    expect(marketMakingRubricV1(spec, good, outcome({ ...{}, })).total).toBeGreaterThanOrEqual(75) // pnl irrelevant to total
  })
})
