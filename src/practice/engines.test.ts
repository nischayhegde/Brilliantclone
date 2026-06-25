import { describe, it, expect } from 'vitest'
import { getEngine, ENGINES } from './engines'

describe('track engines', () => {
  it('exposes an engine per track with a sceneKind + resolve', () => {
    for (const track of ['charts', 'options', 'market-making'] as const) {
      const e = getEngine(track)
      expect(typeof e.sceneKind).toBe('string')
      expect(typeof e.resolve).toBe('function')
      expect(typeof e.loadData).toBe('function')
    }
  })
  it('charts engine targets chart-trade; options engine targets options-build', () => {
    expect(ENGINES.charts.sceneKind).toBe('chart-trade')
    expect(ENGINES.options.sceneKind).toBe('options-build')
  })
})

describe('marketMakingEngine', () => {
  // Note: this repo's TrackEngine exposes `sceneKind` (not `track`) and `resolve(spec, data, decision)`.
  it('is registered for the market-making track', () => {
    expect(getEngine('market-making').sceneKind).toBe('market-make')
  })
  it('builds scene params from loaded book stats and resolves a decision', async () => {
    const eng = getEngine('market-making')
    const spec = {
      id: 'mm1', track: 'market-making', tier: 1, title: 't', brief: 'b',
      dataRef: { candlesKey: Object.keys((await import('../data/candles')).CANDLES)[0] },
      objective: { kind: 'process', passScore: 70 }, constraints: { accountBalance: 10000, maxRiskPct: 5 },
      rubricId: 'market-making-v1', nudges: [], coachContextKeys: [], source: 'curated',
    } as never
    const data = await eng.loadData(spec)
    const params = eng.sceneParams(spec, data)
    expect(params.sceneKey).toBeTruthy()
    const outcome = eng.resolve(spec, data, { bidWidth: 0.5, askWidth: 0.5, quoteSize: 100, maxInventory: 500 } as never)
    expect(typeof outcome.pnl).toBe('number')
    expect(outcome.facts.sigma).toBeDefined()
  })
})
