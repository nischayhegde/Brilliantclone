import { describe, it, expect } from 'vitest'
import { SCENARIOS, allTracks, getScenario, scenariosFor } from './scenarioRegistry'
import { validateSpec } from './validator'
import { validateLayout, layoutFitsTrack } from './genui/schema'
import { WIDGET_REGISTRY, WIDGET_KINDS } from './genui/registry'
import { CANDLES } from '../data/candles'
import type { LayoutCatalog, WidgetKind } from './genui/types'
import type { Track } from './types'

/** Mirror validateSpec's per-spec catalog: every bundled candle key + the spec's own assets. */
function catalogFor(spec: (typeof SCENARIOS)[number]): LayoutCatalog {
  return {
    candlesKeys: Object.keys(CANDLES),
    ohlcAssets: spec.dataRef.ohlcAsset ? [spec.dataRef.ohlcAsset] : [],
    chainAssets: spec.dataRef.chainAsset ? [spec.dataRef.chainAsset] : [],
  }
}

/** The widget kinds a track REQUIRES for a complete decision (registry-driven). */
function requiredKindsFor(track: Track): WidgetKind[] {
  return WIDGET_KINDS.filter((k) => WIDGET_REGISTRY[k].required && WIDGET_REGISTRY[k].tracks.includes(track))
}

describe('scenario registry', () => {
  it('has at least one curated scenario', () => {
    expect(SCENARIOS.length).toBeGreaterThan(0)
  })

  it('every curated spec passes the validator (build-time trust contract)', () => {
    for (const s of SCENARIOS) {
      const r = validateSpec(s)
      expect(r.ok, `${s.id}: ${r.errors.join('; ')}`).toBe(true)
    }
  })

  it('ids are unique', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
  })

  it('getScenario finds by id and returns undefined otherwise', () => {
    expect(getScenario(SCENARIOS[0].id)?.id).toBe(SCENARIOS[0].id)
    expect(getScenario('nope')).toBeUndefined()
  })

  it('scenariosFor filters by track and optional tier', () => {
    const first = SCENARIOS[0]
    const byTrack = scenariosFor(first.track)
    expect(byTrack.every((s) => s.track === first.track)).toBe(true)
    const byTier = scenariosFor(first.track, first.tier)
    expect(byTier.every((s) => s.tier === first.tier)).toBe(true)
  })

  it('charts + options cover tiers 1..3 so adaptive difficulty has targets', () => {
    for (const track of ['charts', 'options'] as const)
      for (const tier of [1, 2, 3]) expect(scenariosFor(track, tier).length, `${track} t${tier}`).toBeGreaterThan(0)
  })

  it('market-making covers tiers 1..3', () => {
    for (const t of [1, 2, 3]) expect(scenariosFor('market-making', t).length).toBeGreaterThan(0)
  })
})

describe('curated layout showcase (the offline / cold-start surface)', () => {
  it('every curated spec carries a non-empty interactive layout', () => {
    for (const s of SCENARIOS) {
      expect(s.layout, `${s.id} is missing a curated layout`).toBeTruthy()
      expect((s.layout ?? []).length, `${s.id} layout is empty`).toBeGreaterThan(0)
    }
  })

  it('every curated layout passes validateLayout against its data catalog', () => {
    for (const s of SCENARIOS) {
      const v = validateLayout(s.layout, catalogFor(s))
      expect(v.ok, `${s.id}: ${v.errors.join('; ')}`).toBe(true)
    }
  })

  it('every curated layout fits its track (only track-valid widgets)', () => {
    for (const s of SCENARIOS) {
      const errors = layoutFitsTrack(s.layout, s.track)
      expect(errors, `${s.id}: ${errors.join('; ')}`).toEqual([])
    }
  })

  it('every curated layout includes the widgets its track requires for a complete decision', () => {
    for (const s of SCENARIOS) {
      const kinds = new Set((s.layout ?? []).map((w) => w.kind))
      for (const required of requiredKindsFor(s.track))
        expect(kinds.has(required), `${s.id} (${s.track}) is missing required widget ${required}`).toBe(true)
    }
  })

  it('each track showcases a VARIED, well-composed mix of widgets across its curated specs', () => {
    for (const track of allTracks) {
      const specs = scenariosFor(track)
      expect(specs.length, `${track} has no curated specs`).toBeGreaterThan(0)
      const union = new Set<WidgetKind>()
      for (const s of specs) for (const w of s.layout ?? []) union.add(w.kind)
      // A rich composition: framing narrative + the required interactive widgets + extras.
      expect(union.has('narrative'), `${track} layouts should open with a narrative`).toBe(true)
      expect(union.size, `${track} layouts are not varied enough (${[...union].join(', ')})`).toBeGreaterThanOrEqual(5)
    }
  })
})
