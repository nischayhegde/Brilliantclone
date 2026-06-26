import { describe, it, expect, vi } from 'vitest'
import { composeScenario, type ComposeApiResponse, type ComposeTransport } from './composer'
import type { DataCatalog } from './types'
import type { ScenarioSpec } from '../types'
import { CANDLES } from '../../data/candles'

const key = Object.keys(CANDLES)[0]
const catalog: DataCatalog = {
  track: 'charts', candlesKeys: [key], ohlcAssets: [], chainAssets: [],
  rubricIds: ['charts-v1'], nudgeIds: ['sizing'],
}
const req = { track: 'charts' as const, tier: 1, accountBalance: 10000, catalog }

// A server-validated LLM spec WITH a layout (the server always assembles one).
const llmSpec: ScenarioSpec = {
  id: 'llm-ok', track: 'charts', tier: 1, title: 'A test setup', brief: 'A clean teaching setup.',
  dataRef: { candlesKey: key }, objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
  rubricId: 'charts-v1', nudges: [{ id: 'sizing' }], coachContextKeys: ['outcome'], source: 'llm',
  layout: [{ id: 'chart', kind: 'candle-chart', config: {} }],
}

const transport = (res: ComposeApiResponse): ComposeTransport => vi.fn().mockResolvedValue(res)

describe('composeScenario (server-callable transport)', () => {
  it('returns the server-composed LLM spec when the callable returns a spec', async () => {
    const res = await composeScenario(req, transport({ spec: llmSpec }))
    expect(res.source).toBe('llm')
    expect(res.spec.id).toBe('llm-ok')
    expect(res.spec.layout).toBeDefined()
  })

  it('guarantees a layout on an LLM spec that somehow lacks one (defaultLayoutFor)', async () => {
    const { layout: _omit, ...noLayout } = llmSpec
    const res = await composeScenario(req, transport({ spec: noLayout as ScenarioSpec }))
    expect(res.source).toBe('llm')
    expect(res.spec.layout?.length).toBeGreaterThan(0)
  })

  it('re-validates the server layout and falls back to curated on an out-of-registry kind (IMP-1)', async () => {
    const badSpec = { ...llmSpec, id: 'llm-bad', layout: [{ id: 'evil', kind: 'teleporter', config: {} }] } as unknown as ScenarioSpec
    const res = await composeScenario(req, transport({ spec: badSpec }))
    expect(res.source).toBe('curated')
    expect(res.spec.id).not.toBe('llm-bad')
    expect(res.spec.layout?.length).toBeGreaterThan(0)
  })

  it('re-validates the server layout and falls back to curated when a widget is invalid for the track (IMP-1)', async () => {
    // quote-ladder is a market-making widget; invalid on the charts track.
    const badSpec = { ...llmSpec, id: 'llm-mm', layout: [{ id: 'q', kind: 'quote-ladder', config: { levels: 1 } }] } as ScenarioSpec
    const res = await composeScenario(req, transport({ spec: badSpec }))
    expect(res.source).toBe('curated')
    expect(res.spec.id).not.toBe('llm-mm')
  })

  it('falls back to a curated spec (with a layout) when the server signals fallback', async () => {
    const res = await composeScenario(req, transport({ fallback: true }))
    expect(res.source).toBe('curated')
    expect(res.spec.track).toBe('charts')
    expect(res.spec.layout?.length).toBeGreaterThan(0)
  })

  it('falls back to curated when the callable throws (offline/rate-limited)', async () => {
    const throwing: ComposeTransport = vi.fn().mockRejectedValue(new Error('offline'))
    const res = await composeScenario(req, throwing)
    expect(res.source).toBe('curated')
    expect(res.spec.layout?.length).toBeGreaterThan(0)
  })

  it('uses curated content directly when no transport is configured (AI disabled)', async () => {
    const res = await composeScenario(req, null)
    expect(res.source).toBe('curated')
    expect(res.spec.layout?.length).toBeGreaterThan(0)
  })
})
