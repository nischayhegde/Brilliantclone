import { describe, it, expect } from 'vitest'
import { sanityValidateLayout } from './genui'
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
