import { describe, it, expect } from 'vitest'
import { validateLayout } from './schema'
import type { LayoutCatalog } from './types'
import type { ScenarioLayout } from './types'

const catalog: LayoutCatalog = {
  candlesKeys: ['AAPL_demo'],
  ohlcAssets: ['data/ohlc/AAPL__1d.json'],
  chainAssets: ['data/options/AAPL__2021-04-16.json'],
}

const goodLayout: ScenarioLayout = [
  { id: 'chart', kind: 'candle-chart', config: { dataRef: { candlesKey: 'AAPL_demo' } } },
  { id: 'dir', kind: 'direction-choice', config: { prompt: 'Take it or skip it?', allowed: ['long', 'short', 'skip'] } },
  { id: 'lines', kind: 'price-lines', config: { require: ['entry', 'stop', 'target'], minRR: 1.5 } },
  { id: 'size', kind: 'size-slider', config: { min: 1, max: 1000, step: 1, unit: 'shares' } },
]

describe('validateLayout', () => {
  it('accepts a well-formed layout that references only catalog data', () => {
    expect(validateLayout(goodLayout, catalog)).toEqual({ ok: true, errors: [] })
  })

  it('rejects a non-array layout', () => {
    expect(validateLayout({} as unknown, catalog).ok).toBe(false)
    expect(validateLayout(null as unknown, catalog).ok).toBe(false)
  })

  it('rejects an unknown widget kind', () => {
    const r = validateLayout([{ id: 'x', kind: 'teleporter', config: {} }] as unknown as ScenarioLayout, catalog)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/kind/i)
  })

  it('rejects duplicate widget ids', () => {
    const r = validateLayout(
      [
        { id: 'dup', kind: 'narrative', config: { body: 'Frame the setup in plain language.' } },
        { id: 'dup', kind: 'confidence', config: {} },
      ],
      catalog,
    )
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/id/i)
  })

  it('rejects a missing/blank widget id', () => {
    const r = validateLayout([{ id: '', kind: 'confidence', config: {} }] as ScenarioLayout, catalog)
    expect(r.ok).toBe(false)
  })

  it('rejects a data ref not in the catalog allow-list', () => {
    const r = validateLayout(
      [{ id: 'chart', kind: 'candle-chart', config: { dataRef: { candlesKey: 'NOT_REAL' } } }],
      catalog,
    )
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/catalog/i)
  })

  it('rejects an option-leg-builder chain ref not in the catalog', () => {
    const r = validateLayout(
      [{ id: 'legs', kind: 'option-leg-builder', config: { maxLegs: 4, dataRef: { chainAsset: 'data/options/FAKE.json' } } }],
      catalog,
    )
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/catalog/i)
  })

  it('rejects widget copy that invents a specific number (numeric-claim lint)', () => {
    const r = validateLayout(
      [{ id: 'n', kind: 'narrative', config: { body: 'Buy the breakout above $182.50 for a move to $200.' } }],
      catalog,
    )
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/number/i)
  })

  it('rejects widget copy that makes a disallowed claim', () => {
    const r = validateLayout(
      [{ id: 'h', kind: 'news-headline', config: { headline: 'This stock is guaranteed to moon.' } }],
      catalog,
    )
    expect(r.ok).toBe(false)
  })

  it('lints multiple-choice option labels too', () => {
    const r = validateLayout(
      [
        {
          id: 'mc',
          kind: 'multiple-choice',
          config: {
            prompt: 'What is the dominant structure here?',
            options: [
              { id: 'a', label: 'An orderly uptrend' },
              { id: 'b', label: 'Guaranteed reversal — cannot lose' },
            ],
          },
        },
      ],
      catalog,
    )
    expect(r.ok).toBe(false)
  })

  it('rejects an invalid per-kind config (direction-choice with empty allowed set)', () => {
    const r = validateLayout([{ id: 'd', kind: 'direction-choice', config: { allowed: [] } }], catalog)
    expect(r.ok).toBe(false)
  })

  it('rejects price-lines with an invalid required line id', () => {
    const r = validateLayout(
      [{ id: 'l', kind: 'price-lines', config: { require: ['banana'] } }] as unknown as ScenarioLayout,
      catalog,
    )
    expect(r.ok).toBe(false)
  })

  it('rejects size-slider with min >= max', () => {
    const r = validateLayout([{ id: 's', kind: 'size-slider', config: { min: 100, max: 10 } }], catalog)
    expect(r.ok).toBe(false)
  })
})
