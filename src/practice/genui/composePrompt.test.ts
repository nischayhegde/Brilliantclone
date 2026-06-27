import { describe, it, expect } from 'vitest'
import {
  assembleComposedSpec,
  buildComposeInput,
  buildComposeInstructions,
  composeJsonSchema,
  decisionDateFromAsset,
  parseComposedLayout,
  pickDataRef,
  sampleRefs,
  serverConstraints,
  widgetKindsForTrack,
  type ComposeCatalog,
  type ComposeRequest,
} from './composePrompt'

const chartsCatalog: ComposeCatalog = {
  candlesKeys: ['NVDA_DEMO', 'AMD_DEMO'],
  ohlcAssets: Array.from({ length: 200 }, (_, i) => `data/ohlc/T${i}__1d.json`),
  chainAssets: [],
  rubricIds: ['charts-v1', 'options-v1'],
  nudgeIds: ['sizing', 'no-stop'],
}
const chartsReq: ComposeRequest = { track: 'charts', tier: 2, accountBalance: 10000, catalog: chartsCatalog }

const optionsCatalog: ComposeCatalog = {
  candlesKeys: [],
  ohlcAssets: [],
  chainAssets: ['data/options/AAPL__2021-04-16.json', 'data/options/MSFT__2023-02-17.json'],
  rubricIds: ['options-v1'],
  nudgeIds: ['undefined-risk', 'sizing'],
}

const goodLayout = [
  { id: 'intro', kind: 'narrative', config: { body: 'A clean teaching setup with no invented numbers.' } },
  { id: 'chart', kind: 'candle-chart', config: { showVolume: false } },
  { id: 'dir', kind: 'direction-choice', config: { allowed: ['long', 'short', 'skip'] } },
  { id: 'levels', kind: 'price-lines', config: { require: ['entry', 'stop', 'target'] } },
  { id: 'size', kind: 'size-slider', config: { min: 1, max: 1000, unit: 'shares' } },
]

describe('sampleRefs', () => {
  it('returns at most n refs and respects an injected rng', () => {
    expect(sampleRefs(chartsCatalog.ohlcAssets, 5, () => 0).length).toBe(5)
  })
  it('returns everything when there are fewer refs than n', () => {
    expect(sampleRefs(['a', 'b'], 40).sort()).toEqual(['a', 'b'])
  })
})

describe('widgetKindsForTrack', () => {
  it('lists only track-valid kinds (charts gets direction-choice, not quote-ladder)', () => {
    const charts = widgetKindsForTrack('charts')
    expect(charts).toContain('direction-choice')
    expect(charts).not.toContain('quote-ladder')
    expect(widgetKindsForTrack('options')).toContain('option-leg-builder')
    expect(widgetKindsForTrack('market-making')).toContain('quote-ladder')
  })
})

describe('buildComposeInstructions', () => {
  it('states the hard integrity rules and is request-independent', () => {
    const ins = buildComposeInstructions()
    expect(ins.toLowerCase()).toMatch(/never (predict|invent)/)
    expect(ins.toLowerCase()).toContain('json')
    expect(ins.toLowerCase()).toContain('widget')
  })
})

describe('buildComposeInput', () => {
  it('includes tier, the rubric/nudge allow-lists, allowed kinds, and a bounded ref sample', () => {
    const p = buildComposeInput(chartsReq, { rng: () => 0 })
    expect(p).toMatch(/tier 2/)
    expect(p).toContain('charts-v1')
    expect(p).toContain('sizing')
    expect(p).toContain('direction-choice')
    expect(p).not.toContain('quote-ladder') // charts input omits MM-only kinds
    const listed = p.split('\n').filter((l) => l.trim().startsWith('- data/ohlc/'))
    expect(listed.length).toBeLessThanOrEqual(40)
  })
  it('offers chain assets (not candles) for options', () => {
    const p = buildComposeInput({ track: 'options', tier: 1, accountBalance: 10000, catalog: optionsCatalog })
    expect(p).toContain('data/options/AAPL__2021-04-16.json')
    expect(p).toContain('option-leg-builder')
  })
})

describe('composeJsonSchema', () => {
  it('requires title/brief/layout and describes a widget array', () => {
    const s = composeJsonSchema()
    expect(s.required).toEqual(expect.arrayContaining(['title', 'brief', 'layout']))
    expect(s.type).toBe('object')
  })
})

describe('parseComposedLayout', () => {
  it('normalizes a JSON string into a draft', () => {
    const draft = parseComposedLayout(JSON.stringify({ title: 't', brief: 'b', layout: goodLayout, rubricId: 'charts-v1', nudgeIds: ['sizing', 7] }))
    expect(draft.title).toBe('t')
    expect(draft.layout.length).toBe(goodLayout.length)
    expect(draft.nudgeIds).toEqual(['sizing']) // non-strings dropped
  })
  it('throws on missing structural essentials', () => {
    expect(() => parseComposedLayout({ title: 't', brief: 'b' })).toThrow()
    expect(() => parseComposedLayout('not json')).toThrow()
  })
})

describe('serverConstraints', () => {
  it('builds track-owned grading constraints from the trusted balance', () => {
    expect(serverConstraints('charts', 25000)).toEqual({ accountBalance: 25000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.2 })
    expect(serverConstraints('options', 25000)).toEqual({ accountBalance: 25000, maxRiskPct: 5, requireDefinedRisk: true })
  })
})

describe('decisionDateFromAsset / pickDataRef', () => {
  it('parses the snapshot date from a chain asset path', () => {
    expect(decisionDateFromAsset('data/options/AAPL__2021-04-16.json')).toBe('2021-04-16')
    expect(decisionDateFromAsset('data/ohlc/AAPL__1d.json')).toBeUndefined()
  })
  it('picks a charts candle ref and an options chain ref with a derived date', () => {
    const charts = pickDataRef('charts', chartsCatalog, () => 0)
    expect(charts.candlesKey).toBe('NVDA_DEMO')
    const opt = pickDataRef('options', optionsCatalog, () => 0)
    expect(opt.chainAsset).toBe('data/options/AAPL__2021-04-16.json')
    expect(opt.decisionDate).toBe('2021-04-16')
  })
})

describe('assembleComposedSpec', () => {
  it('builds a trusted spec with server-owned constraints/dataRef and a validated layout', () => {
    const draft = parseComposedLayout({ title: 'Take it or skip it', brief: 'Real price action up to a decision point.', layout: goodLayout, rubricId: 'charts-v1', nudgeIds: ['sizing'] })
    const res = assembleComposedSpec(chartsReq, draft, { rng: () => 0, id: 'fixed-id' })
    expect(res.ok).toBe(true)
    expect(res.spec?.id).toBe('fixed-id')
    expect(res.spec?.source).toBe('llm')
    expect(res.spec?.constraints).toEqual({ accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.2 })
    expect(res.spec?.dataRef.candlesKey).toBe('NVDA_DEMO')
    expect(res.spec?.layout).toBeDefined()
  })

  it('overrides model-supplied constraints/source/id (I1/I3) and ignores out-of-catalog rubric/nudge', () => {
    const draft = parseComposedLayout({
      title: 'A setup', brief: 'A clean teaching brief.', layout: goodLayout,
      rubricId: 'bogus-rubric', nudgeIds: ['not-a-nudge'],
    })
    const res = assembleComposedSpec(chartsReq, draft, { rng: () => 0 })
    expect(res.ok).toBe(true)
    expect(res.spec?.rubricId).toBe('charts-v1') // bogus rubric replaced with the track default
    expect(res.spec?.nudges).toEqual([{ id: 'sizing' }, { id: 'no-stop' }]) // defaults (in catalog)
  })

  it('rejects a brief that invents a number', () => {
    const draft = parseComposedLayout({ title: 'ok', brief: 'Buy the breakout above $182.50.', layout: goodLayout })
    const res = assembleComposedSpec(chartsReq, draft)
    expect(res.ok).toBe(false)
    expect(res.errors.join(' ')).toMatch(/number/i)
  })

  it('rejects a layout with a track-invalid widget', () => {
    const draft = parseComposedLayout({ title: 'ok', brief: 'A clean brief.', layout: [{ id: 'q', kind: 'quote-ladder', config: {} }] })
    const res = assembleComposedSpec(chartsReq, draft)
    expect(res.ok).toBe(false)
    expect(res.errors.join(' ')).toMatch(/not valid for track/i)
  })

  it('prepends a narrative widget when the model supplies narrative text but no narrative widget', () => {
    const layoutNoNarr = goodLayout.filter((w) => w.kind !== 'narrative')
    const draft = parseComposedLayout({ title: 'ok', brief: 'A clean brief.', narrative: 'Here is the framing for the lesson.', layout: layoutNoNarr })
    const res = assembleComposedSpec(chartsReq, draft, { rng: () => 0 })
    expect(res.ok).toBe(true)
    expect(res.spec?.layout?.[0].kind).toBe('narrative')
  })

  it('derives the options decisionDate server-side even if the model omits it', () => {
    const optLayout = [
      { id: 'chart', kind: 'candle-chart', config: {} },
      { id: 'legs', kind: 'option-leg-builder', config: { maxLegs: 4, requireDefinedRisk: true } },
    ]
    const draft = parseComposedLayout({ title: 'Build a defined-risk position', brief: 'Express a capped-loss view.', layout: optLayout, dataRef: { chainAsset: 'data/options/MSFT__2023-02-17.json' } })
    const res = assembleComposedSpec({ track: 'options', tier: 1, accountBalance: 10000, catalog: optionsCatalog }, draft, { rng: () => 0 })
    expect(res.ok).toBe(true)
    expect(res.spec?.dataRef.chainAsset).toBe('data/options/MSFT__2023-02-17.json')
    expect(res.spec?.dataRef.decisionDate).toBe('2023-02-17')
  })
})
