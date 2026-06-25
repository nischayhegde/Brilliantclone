import { describe, it, expect } from 'vitest'
import { validateComposed } from './validateComposed'
import type { DataCatalog } from './types'
import { CANDLES } from '../../data/candles'

const key = Object.keys(CANDLES)[0]
// Literal catalog (buildCatalog is async/manifest-backed; the validator only needs the allow-lists).
const cat: DataCatalog = {
  track: 'charts', candlesKeys: [key], ohlcAssets: ['data/ohlc/SPY__1d.json'], chainAssets: [],
  rubricIds: ['charts-v1'], nudgeIds: ['sizing', 'no-stop'],
}
const good = {
  id: 'llm-1', track: 'charts', tier: 1, title: 'A pullback to a level',
  brief: 'Price has returned to a prior area of interest. Decide whether the setup is worth taking.',
  dataRef: { candlesKey: key, splitIndex: 5, revealToIndex: Math.min(CANDLES[key].length, 20) },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
  rubricId: 'charts-v1', nudges: [{ id: 'sizing' }], coachContextKeys: ['outcome'], source: 'llm',
}

describe('validateComposed', () => {
  it('accepts a spec that references only catalog keys and has no numbers in the brief', () => {
    const r = validateComposed(good, cat)
    expect(r.ok).toBe(true)
    expect(r.spec?.id).toBe('llm-1')
  })
  it('rejects a candlesKey not in the catalog allow-list', () => {
    const r = validateComposed({ ...good, dataRef: { ...good.dataRef, candlesKey: 'TOTALLY_FAKE' } }, cat)
    expect(r.ok).toBe(false)
  })
  it('rejects a brief that states a specific price (LLM may not invent numbers)', () => {
    const r = validateComposed({ ...good, brief: 'Buy the breakout above $182.50 for a move to $200.' }, cat)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/number/i)
  })
  it('rejects a disallowed-claim brief via the base validator', () => {
    const r = validateComposed({ ...good, brief: 'This will definitely rip higher — guaranteed.' }, cat)
    expect(r.ok).toBe(false)
  })
})
