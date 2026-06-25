import { describe, it, expect } from 'vitest'
import { summarizePractice } from './summary'
import type { PracticeRun } from './types'

const run = (track: PracticeRun['track'], score: number, ts: number): PracticeRun => ({
  specId: 's', track, tier: 1, decision: {} as never, nudgesFired: [], score, breakdown: [], pnl: 0,
  journal: { rationale: '', feeling: 'calm' }, createdAt: ts,
})

describe('summarizePractice', () => {
  it('counts runs and averages process score per track', () => {
    const s = summarizePractice([run('charts', 80, 2), run('charts', 60, 1), run('options', 90, 3)])
    expect(s.totalRuns).toBe(3)
    expect(s.avgScoreByTrack.charts).toBe(70)
    expect(s.avgScoreByTrack.options).toBe(90)
    expect(s.bestScore).toBe(90)
    expect(s.lastPlayedTs).toBe(3)
  })
  it('handles an empty history', () => {
    const s = summarizePractice([])
    expect(s.totalRuns).toBe(0)
    expect(s.bestScore).toBe(0)
  })
})
