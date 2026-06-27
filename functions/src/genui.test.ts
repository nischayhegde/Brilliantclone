import { describe, it, expect, vi } from 'vitest'
import { runCompose, runGrade, sanityValidateLayout, type CallModelFn } from './genui'
import type { ComposeRequest } from './shared/practice/genui/composePrompt'
import type { GradeRequest } from './shared/practice/genui/gradePrompt'
import type { LayoutCatalog } from './shared/practice/genui/types'

// This suite is the PROOF that the functions toolchain compiles + runs the isomorphic
// genui core copied from the root app (src/shared/**). If the cross-package import or
// the cycle fix regressed, importing `./genui` here would fail to resolve/compile.
const catalog: LayoutCatalog = { candlesKeys: ['AAPL__1d'], ohlcAssets: [], chainAssets: [] }

describe('sanityValidateLayout (isomorphic genui import)', () => {
  it('accepts a clean, number-free layout', () => {
    const layout = [
      { id: 'intro', kind: 'narrative', config: { body: 'A clean teaching setup with no invented numbers.' } },
      { id: 'chart', kind: 'candle-chart', config: { dataRef: { candlesKey: 'AAPL__1d' }, showVolume: false } },
    ]
    const res = sanityValidateLayout(layout, catalog)
    expect(res.ok).toBe(true)
    expect(res.errors).toEqual([])
  })

  it('rejects an unknown widget kind', () => {
    const res = sanityValidateLayout([{ id: 'x', kind: 'bogus', config: {} }], catalog)
    expect(res.ok).toBe(false)
    expect(res.errors.length).toBeGreaterThan(0)
  })

  it('rejects copy that invents a number (numeric-claim lint via the leaf module)', () => {
    const res = sanityValidateLayout(
      [{ id: 'n', kind: 'narrative', config: { body: 'Price will hit 250 soon.' } }],
      catalog,
    )
    expect(res.ok).toBe(false)
  })

  it('enforces widget/track fitness when a track is given', () => {
    const layout = [{ id: 'd', kind: 'direction-choice', config: { allowed: ['long', 'short'] } }]
    // direction-choice is a charts-only widget; invalid for options.
    expect(sanityValidateLayout(layout, catalog, 'options').ok).toBe(false)
    expect(sanityValidateLayout(layout, catalog, 'charts').ok).toBe(true)
  })
})

// --- WS-D: server-side compose + grade orchestrators (mocked model; no network) -----

const composeReq: ComposeRequest = {
  track: 'charts',
  tier: 1,
  accountBalance: 10000,
  catalog: { candlesKeys: ['AAPL__1d'], ohlcAssets: [], chainAssets: [], rubricIds: ['charts-v1'], nudgeIds: ['sizing', 'no-stop'] },
}
const composedDraft = {
  title: 'Take it or skip it', brief: 'Real price action up to a decision point.',
  layout: [
    { id: 'chart', kind: 'candle-chart', config: { showVolume: false } },
    { id: 'dir', kind: 'direction-choice', config: { allowed: ['long', 'short', 'skip'] } },
    { id: 'levels', kind: 'price-lines', config: { require: ['entry', 'stop', 'target'] } },
    { id: 'size', kind: 'size-slider', config: { min: 1, max: 1000, unit: 'shares' } },
  ],
  rubricId: 'charts-v1', nudgeIds: ['sizing'],
}
const mockModel = (json: unknown[], text = ''): CallModelFn => {
  let i = 0
  return vi.fn(async () => {
    const j = json[Math.min(i++, json.length - 1)]
    return { text, json: j }
  })
}

describe('runCompose (server-side compose, mocked model)', () => {
  it('assembles a validated spec with server-owned constraints from a clean model draft', async () => {
    const res = await runCompose(composeReq, mockModel([composedDraft]), { rng: () => 0 })
    expect('spec' in res).toBe(true)
    if ('spec' in res) {
      expect(res.spec.source).toBe('llm')
      expect(res.spec.constraints).toEqual({ accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.2 })
      expect(res.spec.dataRef.candlesKey).toBe('AAPL__1d')
      expect(res.spec.layout?.length).toBeGreaterThan(0)
    }
  })

  it('does NOT send temperature to the model (reasoning model)', async () => {
    const model = mockModel([composedDraft])
    await runCompose(composeReq, model, { rng: () => 0 })
    const params = (model as unknown as { mock: { calls: [Record<string, unknown>][] } }).mock.calls[0][0]
    expect('temperature' in params).toBe(false)
    expect(params.jsonSchema).toBeDefined()
  })

  it('retries once then falls back when the model output never validates', async () => {
    const bad = { title: 'x', brief: 'A clean brief.', layout: [{ id: 'q', kind: 'quote-ladder', config: {} }] }
    const res = await runCompose(composeReq, mockModel([bad, bad]), { rng: () => 0 })
    expect(res).toEqual({ fallback: true })
  })

  it('falls back when the model throws (offline)', async () => {
    const throwing: CallModelFn = vi.fn(async () => { throw new Error('offline') })
    expect(await runCompose(composeReq, throwing)).toEqual({ fallback: true })
  })
})

const gradeReq: GradeRequest = {
  track: 'charts',
  passScore: 70,
  decision: { took: true, direction: 'long', entry: 100, stop: 95, target: 115, shares: 50 },
  outcomeFacts: { pnl: -240, hit: 'sl', exit: 95, entryRef: 100 },
  candleSummary: { bars: 40, startClose: 100, endClose: 92, high: 108, low: 90, netChange: -8, pctChange: -8 },
  signals: { confidence: 80 },
  rubricDims: [
    { id: 'read', label: 'Correct read', weight: 2, deterministic: 0.8 },
    { id: 'sizing', label: 'Position sizing', weight: 2, deterministic: 0.8 },
  ],
}

describe('runGrade (server-side grade, mocked model)', () => {
  it('returns a clamped/sanitized process score + feedback from a clean model grade', async () => {
    const grade = { dimensions: [{ id: 'read', score: 0.8, note: 'Coherent plan.' }, { id: 'sizing', score: 0.7, note: 'Sized well.' }], feedback: 'Good process on a $240 loss.' }
    const res = await runGrade(gradeReq, mockModel([grade]))
    expect('score' in res).toBe(true)
    if ('score' in res) {
      expect(res.score.total).toBeGreaterThan(0)
      expect(res.feedback).toMatch(/good process/i)
    }
  })

  it('falls back when the grade is P&L-contaminated (loss tanked below process merit)', async () => {
    const grade = { dimensions: [{ id: 'read', score: 0.05, note: '' }, { id: 'sizing', score: 0.05, note: '' }], feedback: 'Bad.' }
    const res = await runGrade({ ...gradeReq, outcomeFacts: { ...gradeReq.outcomeFacts, pnl: -900 } }, mockModel([grade]))
    expect(res).toEqual({ fallback: true })
  })

  it('falls back when the model throws (offline)', async () => {
    const throwing: CallModelFn = vi.fn(async () => { throw new Error('offline') })
    expect(await runGrade(gradeReq, throwing)).toEqual({ fallback: true })
  })
})
