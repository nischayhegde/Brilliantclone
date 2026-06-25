import { describe, it, expect, vi } from 'vitest'
import { composeScenario } from './composer'
import type { DataCatalog, ModelClient } from './types'
import { CANDLES } from '../../data/candles'

const key = Object.keys(CANDLES)[0]
// Literal catalog (buildCatalog is async/manifest-backed; composeScenario receives the catalog ready-made).
const catalog: DataCatalog = {
  track: 'charts', candlesKeys: [key], ohlcAssets: [], chainAssets: [],
  rubricIds: ['charts-v1'], nudgeIds: ['sizing'],
}
const req = { track: 'charts' as const, tier: 1, accountBalance: 10000, catalog }
const validJson = JSON.stringify({
  id: 'llm-ok', track: 'charts', tier: 1, title: 'A test setup', brief: 'A clean teaching setup with no numbers.',
  dataRef: { candlesKey: key, splitIndex: 3, revealToIndex: Math.min(CANDLES[key].length, 15) },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
  rubricId: 'charts-v1', nudges: [{ id: 'sizing' }], coachContextKeys: ['outcome'], source: 'llm',
})

const mock = (replies: string[]): ModelClient => {
  let i = 0
  return { generate: vi.fn().mockImplementation(async () => replies[Math.min(i++, replies.length - 1)]) }
}

describe('composeScenario', () => {
  it('returns the LLM spec when it validates on the first attempt', async () => {
    const res = await composeScenario(req, mock([validJson]))
    expect(res.source).toBe('llm')
    expect(res.spec.id).toBe('llm-ok')
    expect(res.attempts).toBe(1)
  })

  it('retries once on an invalid reply, then succeeds', async () => {
    const res = await composeScenario(req, mock(['garbage', validJson]))
    expect(res.source).toBe('llm')
    expect(res.attempts).toBe(2)
  })

  it('falls back to a curated scenario after two failures', async () => {
    const res = await composeScenario(req, mock(['nope', 'still nope']))
    expect(res.source).toBe('curated')
    expect(res.spec.track).toBe('charts')
  })

  it('falls back to curated when the model throws (offline)', async () => {
    const throwing: ModelClient = { generate: vi.fn().mockRejectedValue(new Error('offline')) }
    const res = await composeScenario(req, throwing)
    expect(res.source).toBe('curated')
  })
})
