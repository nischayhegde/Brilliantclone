import { describe, it, expect } from 'vitest'
import { defaultLayoutFor } from './defaultLayout'
import { validateLayout } from './schema'
import { WIDGET_REGISTRY } from './registry'
import type { LayoutCatalog } from './types'
import { allTracks } from '../scenarioRegistry'

// The default layout is a curated shim, so it must validate with an empty catalog
// (it references no real data by key — the candle-chart binds to the spec's dataRef).
const emptyCatalog: LayoutCatalog = { candlesKeys: [], ohlcAssets: [], chainAssets: [] }

describe('defaultLayoutFor', () => {
  for (const track of allTracks) {
    it(`returns a non-empty, schema-valid layout for ${track}`, () => {
      const layout = defaultLayoutFor(track)
      expect(layout.length).toBeGreaterThan(0)
      expect(validateLayout(layout, emptyCatalog)).toEqual({ ok: true, errors: [] })
    })

    it(`only uses widgets registered as valid for ${track}`, () => {
      for (const w of defaultLayoutFor(track)) {
        expect(WIDGET_REGISTRY[w.kind].tracks).toContain(track)
      }
    })

    it(`has unique widget ids for ${track}`, () => {
      const ids = defaultLayoutFor(track).map((w) => w.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  }

  it('charts default includes a direction choice and price lines', () => {
    const kinds = defaultLayoutFor('charts').map((w) => w.kind)
    expect(kinds).toContain('direction-choice')
    expect(kinds).toContain('price-lines')
  })

  it('options default includes an option-leg-builder', () => {
    expect(defaultLayoutFor('options').map((w) => w.kind)).toContain('option-leg-builder')
  })

  it('market-making default includes a quote-ladder', () => {
    expect(defaultLayoutFor('market-making').map((w) => w.kind)).toContain('quote-ladder')
  })
})
