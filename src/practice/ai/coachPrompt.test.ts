import { describe, it, expect } from 'vitest'
import { buildCoachPrompt, sanitizeCoachText } from './coachPrompt'
import type { CoachRequest } from './types'

const req: CoachRequest = {
  spec: { objective: { passScore: 70 } } as never,
  decision: { took: true } as never,
  outcome: { pnl: -120, facts: { exit: 98 } },
  score: { total: 82, pnl: -120, dimensions: [], title: 't', detail: 'd' },
  nudgesFired: ['no-stop'],
  journal: { rationale: 'looked clean', feeling: 'confident' },
  allowedFacts: { pnl: -120, exit: 98, score: 82 },
}

describe('buildCoachPrompt', () => {
  it('includes the score, fired nudges, journal, and the whitelist instruction', () => {
    const p = buildCoachPrompt(req)
    expect(p).toMatch(/82/)
    expect(p).toMatch(/no-stop/)
    expect(p.toLowerCase()).toContain('only')
    expect(p.toLowerCase()).toContain('process')
  })
})

describe('sanitizeCoachText', () => {
  it('accepts prose that cites only whitelisted numbers', () => {
    expect(sanitizeCoachText('Good process despite the −$120 result; your exit at 98 was fine.', req).ok).toBe(true)
  })
  it('rejects an out-of-whitelist dollar number', () => {
    expect(sanitizeCoachText('You could have made $5,000 by holding to 130.', req).ok).toBe(false)
  })
  it('rejects a BARE (non-$) numeral outside the whitelist', () => {
    const r = sanitizeCoachText('A cleaner exit was waiting near 250 before the reversal.', req)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/number 250/)
  })
  it('rejects a PERCENTAGE outside the whitelist', () => {
    const r = sanitizeCoachText('That single trade put 73% of your account at risk.', req)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/percentage 73/)
  })
  it('allows the score scaffolding and whitelisted per-dimension percentages', () => {
    const withDims: CoachRequest = {
      ...req,
      score: { total: 82, pnl: -120, title: 't', detail: 'd', dimensions: [{ id: 'sizing', label: 'Sizing', weight: 2, score: 0.8, note: '' }] },
    }
    expect(sanitizeCoachText('You scored 82/100; sizing was the bright spot at 80%.', withDims).ok).toBe(true)
  })
  it('does not over-reject ordinary non-quantitative prose', () => {
    expect(sanitizeCoachText('Calm, disciplined process. Repeat the plan and let the edge play out.', req).ok).toBe(true)
  })
  it('rejects a prediction/advice claim', () => {
    expect(sanitizeCoachText('Next time buy now — it will definitely rebound.', req).ok).toBe(false)
  })
})
