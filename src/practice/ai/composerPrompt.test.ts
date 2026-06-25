import { describe, it, expect } from 'vitest'
import { buildComposerPrompt, parseComposerJson, sampleRefs } from './composerPrompt'
import type { DataCatalog } from './types'

const catalog: DataCatalog = {
  track: 'charts',
  candlesKeys: ['NVDA_DEMO'],
  ohlcAssets: Array.from({ length: 200 }, (_, i) => `data/ohlc/T${i}__1d.json`),
  chainAssets: [],
  rubricIds: ['charts-v1'],
  nudgeIds: ['sizing', 'no-stop'],
}
const req = { track: 'charts' as const, tier: 2, accountBalance: 10000, catalog }

describe('sampleRefs', () => {
  it('returns at most n refs and respects an injected rng', () => {
    const out = sampleRefs(catalog.ohlcAssets, 5, () => 0) // rng=0 → deterministic pick
    expect(out.length).toBe(5)
  })
  it('returns everything when there are fewer refs than n', () => {
    expect(sampleRefs(['a', 'b'], 40).sort()).toEqual(['a', 'b'])
  })
})

describe('buildComposerPrompt', () => {
  it('states the guardrails and enumerates rubrics/nudges + a bounded ref sample', () => {
    const p = buildComposerPrompt(req, { rng: () => 0 })
    expect(p).toMatch(/never (predict|invent)/i)
    expect(p).toMatch(/charts-v1/)
    expect(p).toMatch(/sizing/)
    expect(p).toMatch(/tier 2/i)
    expect(p.toLowerCase()).toContain('only')
    expect(p.toLowerCase()).toContain('json')
  })
  it('caps the number of refs listed even when the catalog is huge', () => {
    const listed = buildComposerPrompt(req, { rng: () => 0 }).split('\n').filter((l) => l.trim().startsWith('- data/ohlc/'))
    expect(listed.length).toBeLessThanOrEqual(40)
  })
  it('varies the ref sample across calls (different rng → different refs)', () => {
    const a = buildComposerPrompt(req, { rng: () => 0.1 })
    const b = buildComposerPrompt(req, { rng: () => 0.9 })
    expect(a).not.toBe(b)
  })
})

describe('parseComposerJson', () => {
  it('extracts a JSON object even with prose/code fences around it', () => {
    const text = 'Sure!\n```json\n{"id":"x","track":"charts"}\n```\nDone.'
    expect(parseComposerJson(text)).toEqual({ id: 'x', track: 'charts' })
  })
  it('throws when there is no JSON object', () => {
    expect(() => parseComposerJson('no json here')).toThrow()
  })
})
