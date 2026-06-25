import { describe, it, expect } from 'vitest'
import { summarizeRuin } from './reflect'
import type { PracticeRun } from './types'

const run = (over: Partial<PracticeRun>): PracticeRun => ({
  specId: 's', track: 'charts', tier: 1, decision: { took: true } as never,
  nudgesFired: [], score: 40, breakdown: [], pnl: -500,
  journal: { rationale: 'x', feeling: 'calm' }, createdAt: Date.now(), ...over,
})

describe('summarizeRuin', () => {
  it('flags oversizing when the sizing dimension was repeatedly weak', () => {
    const runs = [
      run({ breakdown: [{ id: 'sizing', label: 'Position sizing', weight: 2, score: 0.1, note: '' }] }),
      run({ breakdown: [{ id: 'sizing', label: 'Position sizing', weight: 2, score: 0.2, note: '' }] }),
    ]
    const s = summarizeRuin(runs)
    expect(s.causes.find((c) => c.id === 'oversizing')?.count).toBe(2)
    expect(s.headline.length).toBeGreaterThan(0)
  })
  it('flags missing stops / undefined risk', () => {
    const runs = [run({ breakdown: [{ id: 'stop', label: 'Defined max loss', weight: 2, score: 0, note: '' }] })]
    expect(summarizeRuin(runs).causes.some((c) => c.id === 'no-stops')).toBe(true)
  })
  it('flags revenge/fomo trading from the journal', () => {
    const runs = [run({ journal: { rationale: 'chased', feeling: 'revenge' } })]
    expect(summarizeRuin(runs).causes.some((c) => c.id === 'tilt')).toBe(true)
  })
  it('returns a calm generic headline when no clear pattern exists', () => {
    expect(summarizeRuin([]).causes).toHaveLength(0)
    expect(summarizeRuin([]).coaching.length).toBeGreaterThan(0)
  })
})
