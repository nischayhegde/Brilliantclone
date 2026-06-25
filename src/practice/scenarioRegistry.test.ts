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
})
