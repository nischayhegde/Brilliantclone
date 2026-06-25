import { describe, it, expect, vi } from 'vitest'
import { PracticeAnalytics, evScenarioStarted, evCompleted } from './analytics'

describe('analytics event builders', () => {
  it('builds a typed scenario_started event', () => {
    expect(evScenarioStarted({ specId: 's', track: 'charts', tier: 2, source: 'llm' }))
      .toEqual({ type: 'scenario_started', specId: 's', track: 'charts', tier: 2, source: 'llm' })
  })
  it('builds a scenario_completed event with score + pnl', () => {
    const e = evCompleted({ specId: 's', track: 'charts', tier: 1, score: 80, pnl: -50, nudgesFired: ['sizing'] })
    expect(e.type).toBe('scenario_completed')
    expect(e.score).toBe(80)
  })
})

describe('PracticeAnalytics.emit', () => {
  it('stamps a timestamp and forwards to the sink', async () => {
    const sink = vi.fn()
    const a = new PracticeAnalytics({ sink, now: () => 123 })
    await a.emit(evScenarioStarted({ specId: 's', track: 'charts', tier: 1, source: 'curated' }))
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ type: 'scenario_started', ts: 123 }))
  })
  it('never throws when the sink fails (analytics must not break practice)', async () => {
    const a = new PracticeAnalytics({ sink: () => { throw new Error('offline') } })
    await expect(a.emit(evScenarioStarted({ specId: 's', track: 'charts', tier: 1, source: 'curated' }))).resolves.toBeUndefined()
  })
})
