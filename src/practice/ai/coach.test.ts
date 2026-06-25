import { describe, it, expect, vi } from 'vitest'
import { coachDebrief } from './coach'
import type { CoachRequest, ModelClient } from './types'

const req: CoachRequest = {
  spec: { objective: { passScore: 70 } } as never,
  decision: { took: true } as never,
  outcome: { pnl: -120, facts: {} },
  score: { total: 82, pnl: -120, dimensions: [{ id: 'stop', label: 'Defined max loss', weight: 2, score: 1, note: 'ok' }], title: 't', detail: 'd' },
  nudgesFired: [], journal: undefined, allowedFacts: { pnl: -120 },
}

describe('coachDebrief', () => {
  it('uses clean LLM prose when it passes the post-filter', async () => {
    const model: ModelClient = { generate: vi.fn().mockResolvedValue('Good process on a −$120 result. Repeat it.') }
    const r = await coachDebrief(req, model)
    expect(r.source).toBe('llm')
    expect(r.text).toMatch(/good process/i)
  })
  it('falls back to curated prose when the LLM cites a forbidden number', async () => {
    const model: ModelClient = { generate: vi.fn().mockResolvedValue('You left $9,999 on the table.') }
    const r = await coachDebrief(req, model)
    expect(r.source).toBe('curated')
  })
  it('falls back to curated when the model throws', async () => {
    const model: ModelClient = { generate: vi.fn().mockRejectedValue(new Error('offline')) }
    expect((await coachDebrief(req, model)).source).toBe('curated')
  })
})
