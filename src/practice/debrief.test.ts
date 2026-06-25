import { describe, it, expect } from 'vitest'
import { curatedDebrief } from './debrief'
import type { ScenarioSpec, ProcessScore, ScenarioOutcome } from './types'

const spec = { objective: { passScore: 70 } } as ScenarioSpec
const score = (total: number): ProcessScore => ({
  total, pnl: -100, title: 't',
  dimensions: [{ id: 'stop', label: 'Defined max loss', weight: 2, score: 0, note: 'No stop.' }],
  detail: 'd',
})
const outcome: ScenarioOutcome = { pnl: -100, facts: { took: true, hit: 'sl' } }

describe('curatedDebrief', () => {
  it('praises good process on a losing trade (process over outcome)', () => {
    const text = curatedDebrief(spec, { took: true } as never, outcome, score(82))
    expect(text).toMatch(/good process/i)
  })
  it('names the weakest dimension when the score is low', () => {
    const text = curatedDebrief(spec, { took: true } as never, outcome, score(40))
    expect(text).toMatch(/Defined max loss/)
  })
  it('confronts a fomo self-attribution when present', () => {
    const text = curatedDebrief(spec, { took: true } as never, outcome, score(38), { rationale: 'chased it', feeling: 'fomo' })
    expect(text.toLowerCase()).toContain('fomo')
  })
})
