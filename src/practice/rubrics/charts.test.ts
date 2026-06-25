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
const out = (over: Partial<ScenarioOutcome> = {}): ScenarioOutcome => ({ pnl: 0, facts: { took: true, hit: 'tp', netMove: 5, entryRef: 100 }, ...over })

describe('chartsRubricV1', () => {
  it('scores a sound, well-sized, stopped, good-R:R, coherent-plan trade highly', () => {
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

  it('the read dimension is process-only: identical regardless of the realized move/P&L', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 99, target: 103, shares: 100 }
    const winRead = chartsRubricV1(spec(), d, out({ pnl: 600, facts: { took: true, hit: 'tp', netMove: 9, entryRef: 100 } }))
      .dimensions.find((x) => x.id === 'read')!.score
    const lossRead = chartsRubricV1(spec(), d, out({ pnl: -250, facts: { took: true, hit: 'sl', netMove: -9, entryRef: 100 } }))
      .dimensions.find((x) => x.id === 'read')!.score
    expect(winRead).toBe(lossRead)
  })

  it('grades a SKIP on process only — identical regardless of the realized move', () => {
    const d: ChartsDecision = { took: false }
    const calm = chartsRubricV1(spec(), d, out({ pnl: 0, facts: { took: false, hit: 'none', netMove: 0.3, entryRef: 100 } }))
    const ripped = chartsRubricV1(spec(), d, out({ pnl: 0, facts: { took: false, hit: 'none', netMove: 50, entryRef: 100 } }))
    const read = (r: typeof calm) => r.dimensions.find((x) => x.id === 'read')!.score
    expect(read(calm)).toBe(read(ripped))
  })

  it('INVARIANT: a well-processed LOSING trade scores >= a poorly-processed WINNING trade', () => {
    const wellLost: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 99, target: 103, shares: 100 }
    const lossScore = chartsRubricV1(spec(), wellLost, out({ pnl: -150, facts: { took: true, hit: 'sl', netMove: -8, entryRef: 100 } }))
    const recklessWon: ChartsDecision = { took: true, direction: 'long', entry: 100, shares: 5000 } // oversized, stopless
    const winScore = chartsRubricV1(spec(), recklessWon, out({ pnl: 5000, facts: { took: true, hit: 'end', netMove: 60, entryRef: 100 } }))
    expect(lossScore.total).toBeGreaterThanOrEqual(winScore.total)
  })

  it('reports pnl through unchanged from the outcome (display only)', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 99, target: 103, shares: 100 }
    expect(chartsRubricV1(spec(), d, out({ pnl: 123 })).pnl).toBe(123)
  })
})
