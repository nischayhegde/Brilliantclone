import { describe, it, expect } from 'vitest'
import { SCENARIOS, getScenario, scenariosFor } from './scenarioRegistry'
import { validateSpec } from './validator'

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
