import { describe, it, expect } from 'vitest'
import { optionsRubricV1 } from './options'
import type { ScenarioSpec, OptionsDecision, ScenarioOutcome } from '../types'

const spec = (over: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id: 'o', track: 'options', tier: 1, title: 't', brief: 'b',
  dataRef: { chainAsset: 'data/options/DIS__2021-02-17.json', decisionDate: '2021-02-17' },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 5, requireDefinedRisk: true },
  rubricId: 'options-v1', nudges: [], coachContextKeys: [], source: 'curated', ...over,
})
const out = (pnl: number): ScenarioOutcome => ({ pnl, facts: { modelEstimate: false } })

describe('optionsRubricV1', () => {
  it('rewards a defined-risk vertical sized within budget with sane strikes/DTE', () => {
    const d: OptionsDecision = {
      legs: [
        { type: 'put', side: 'short', K: 180, expiry: '2021-03-19', premium: 4.33, contracts: 1, deltaAtEntry: -0.34, dteAtEntry: 30 },
        { type: 'put', side: 'long', K: 175, expiry: '2021-03-19', premium: 2.93, contracts: 1, dteAtEntry: 30 },
      ],
      managed: 'closed-early',
    }
    const r = optionsRubricV1(spec(), d, out(120))
    expect(r.total).toBeGreaterThanOrEqual(80)
    expect(r.dimensions.find((x) => x.id === 'defined-risk')!.score).toBe(1)
  })

  it('punishes an undefined-risk naked short call', () => {
    const d: OptionsDecision = {
      legs: [{ type: 'call', side: 'short', K: 200, expiry: '2021-03-19', premium: 3, contracts: 1, deltaAtEntry: 0.3, dteAtEntry: 30 }],
      managed: 'hold',
    }
    const r = optionsRubricV1(spec(), d, out(300))
    expect(r.dimensions.find((x) => x.id === 'defined-risk')!.score).toBe(0)
    expect(r.total).toBeLessThan(60)
  })

  it('dings strike/expiry sanity for a 0DTE far-OTM lotto', () => {
    const d: OptionsDecision = {
      legs: [{ type: 'call', side: 'long', K: 240, expiry: '2021-03-05', premium: 0.08, contracts: 50, deltaAtEntry: 0.01, dteAtEntry: 2 }],
      managed: 'hold',
    }
    const r = optionsRubricV1(spec(), d, out(-400))
    expect(r.dimensions.find((x) => x.id === 'strike-expiry')!.score).toBeLessThan(0.5)
  })

  it('the thesis dimension is process-only: identical whether the trade won or lost', () => {
    const d: OptionsDecision = {
      legs: [
        { type: 'put', side: 'short', K: 180, expiry: '2021-03-19', premium: 4.33, contracts: 1, deltaAtEntry: -0.34, dteAtEntry: 30 },
        { type: 'put', side: 'long', K: 175, expiry: '2021-03-19', premium: 2.93, contracts: 1, dteAtEntry: 30 },
      ],
      managed: 'hold',
    }
    const thesisOf = (pnl: number) => optionsRubricV1(spec(), d, out(pnl)).dimensions.find((x) => x.id === 'thesis')!.score
    expect(thesisOf(500)).toBe(thesisOf(-500))
  })

  it('INVARIANT: a well-processed LOSING trade scores >= a poorly-processed WINNING trade', () => {
    const wellLost: OptionsDecision = {
      legs: [
        { type: 'put', side: 'short', K: 180, expiry: '2021-03-19', premium: 4.33, contracts: 1, deltaAtEntry: -0.34, dteAtEntry: 30 },
        { type: 'put', side: 'long', K: 175, expiry: '2021-03-19', premium: 2.93, contracts: 1, dteAtEntry: 30 },
      ],
      managed: 'closed-early',
    }
    const lossScore = optionsRubricV1(spec(), wellLost, out(-200))
    const recklessWon: OptionsDecision = {
      legs: [{ type: 'call', side: 'short', K: 200, expiry: '2021-03-19', premium: 3, contracts: 1, deltaAtEntry: 0.3, dteAtEntry: 30 }],
      managed: 'hold',
    }
    const winScore = optionsRubricV1(spec(), recklessWon, out(300))
    expect(lossScore.total).toBeGreaterThanOrEqual(winScore.total)
  })
})
