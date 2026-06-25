import { describe, it, expect } from 'vitest'
import { chartsRubricV1 } from './charts'
import type { ScenarioSpec, ChartsDecision, ScenarioOutcome } from '../types'

const spec = (over: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id: 's', track: 'charts', tier: 1, title: 't', brief: 'b',
  dataRef: { candlesKey: 'x', splitIndex: 1, revealToIndex: 4 },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 2 },
  rubricId: 'charts-v1', nudges: [], coachContextKeys: [], source: 'curated', ...over,
})
const out = (over: Partial<ScenarioOutcome> = {}): ScenarioOutcome => ({ pnl: 0, facts: { took: true, hit: 'tp', netMove: 5 }, ...over })

describe('chartsRubricV1', () => {
  it('scores a sound, well-sized, stopped, good-R:R, correct-read trade highly', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 99, target: 103, shares: 100 }
    const r = chartsRubricV1(spec(), d, out({ pnl: 300 }))
    expect(r.total).toBeGreaterThanOrEqual(85)
  })

  it('scores a PROFITABLE but oversized, stopless trade LOW (process, not P&L)', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, shares: 5000 } // no stop, 50% risk-ish
    const r = chartsRubricV1(spec(), d, out({ pnl: 4000 }))
    expect(r.total).toBeLessThan(50)
    expect(r.dimensions.find((x) => x.id === 'stop')!.score).toBe(0)
  })

  it('rewards a disciplined SKIP when the move was small/whipsaw', () => {
    const d: ChartsDecision = { took: false }
    const r = chartsRubricV1(spec(), d, out({ took: false, pnl: 0, facts: { took: false, hit: 'none', netMove: 0.3 } }))
    expect(r.dimensions.find((x) => x.id === 'read')!.score).toBeGreaterThan(0.7)
  })

  it('reports pnl through unchanged from the outcome', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 99, target: 103, shares: 100 }
    expect(chartsRubricV1(spec(), d, out({ pnl: 123 })).pnl).toBe(123)
  })
})
