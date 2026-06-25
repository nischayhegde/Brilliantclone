import { describe, it, expect } from 'vitest'
import { validateSpec } from './validator'
import type { ScenarioSpec } from './types'

const candlesKey = Object.keys(
  // a known bundled key; pick the first available at test time
  (await import('../data/candles')).CANDLES,
)[0]

const valid: ScenarioSpec = {
  id: 'charts-tier1-0001',
  track: 'charts',
  tier: 1,
  title: 'A clean breakout retest',
  brief: 'Price has pushed to a level and pulled back. Decide whether to take it.',
  dataRef: { candlesKey, splitIndex: 30, revealToIndex: 50 },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
  rubricId: 'noop',
  nudges: [{ id: 'sizing' }, { id: 'no-stop' }],
  coachContextKeys: ['outcome', 'exit'],
  source: 'curated',
}

describe('validateSpec', () => {
  it('accepts a well-formed spec referencing real bundled data', () => {
    expect(validateSpec(valid)).toEqual({ ok: true, errors: [] })
  })

  it('rejects an unknown candlesKey', () => {
    const r = validateSpec({ ...valid, dataRef: { ...valid.dataRef, candlesKey: 'NOT_A_KEY' } })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/candlesKey/)
  })

  it('rejects an out-of-range splitIndex', () => {
    const r = validateSpec({ ...valid, dataRef: { ...valid.dataRef, splitIndex: 999999 } })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/splitIndex/)
  })

  it('rejects an unknown rubricId', () => {
    expect(validateSpec({ ...valid, rubricId: 'ghost' }).ok).toBe(false)
  })

  it('rejects an unknown nudge id', () => {
    expect(validateSpec({ ...valid, nudges: [{ id: 'made-up' }] }).ok).toBe(false)
  })

  it('rejects a brief that makes a disallowed claim (prediction/advice/guarantee)', () => {
    expect(validateSpec({ ...valid, brief: 'This stock will definitely go up — buy now.' }).ok).toBe(false)
    expect(validateSpec({ ...valid, brief: 'Guaranteed profit if you follow this advice.' }).ok).toBe(false)
  })

  it('requires a corpus asset ref to look like a data/ path', () => {
    const r = validateSpec({ ...valid, dataRef: { ohlcAsset: 'http://evil/x', splitIndex: 1, revealToIndex: 2 } })
    expect(r.ok).toBe(false)
  })
})
