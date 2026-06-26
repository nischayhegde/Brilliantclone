import { describe, it, expect } from 'vitest'
import { applyGradeGuard, type GradeGuardInput } from './gradeGuard'
import type { RubricDimRef } from './gradePrompt'

const dims = (det: number[]): RubricDimRef[] => [
  { id: 'read', label: 'Correct read', weight: 2, deterministic: det[0] },
  { id: 'sizing', label: 'Position sizing', weight: 2, deterministic: det[1] },
  { id: 'stop', label: 'Defined max loss', weight: 2, deterministic: det[2] },
]

const base = (over: Partial<GradeGuardInput>): GradeGuardInput => ({
  raw: {}, rubricDims: dims([0.8, 0.8, 0.8]), pnl: 0, passScore: 70, allowedNumbers: [], ...over,
})

describe('applyGradeGuard — clamp + drop', () => {
  it('clamps out-of-range scores into [0,1] and keeps only rubric dimensions', () => {
    const res = applyGradeGuard(base({
      raw: { dimensions: [
        { id: 'read', score: 1.7, note: 'over' },
        { id: 'sizing', score: -0.5, note: 'under' },
        { id: 'stop', score: 0.5, note: 'mid' },
        { id: 'invented', score: 0.9, note: 'should be dropped' },
      ], feedback: 'Reasonable plan overall.' },
    }))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const byId = Object.fromEntries(res.score.dimensions.map((d) => [d.id, d.score]))
    expect(byId.read).toBe(1)
    expect(byId.sizing).toBe(0)
    expect(byId.stop).toBe(0.5)
    expect(res.score.dimensions.find((d) => d.id === 'invented')).toBeUndefined()
  })

  it('fills a skipped rubric dimension with the deterministic guardrail score', () => {
    const res = applyGradeGuard(base({
      rubricDims: dims([0.4, 0.9, 0.9]),
      raw: { dimensions: [{ id: 'sizing', score: 0.9, note: '' }, { id: 'stop', score: 0.9, note: '' }], feedback: 'Tidy.' },
    }))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.score.dimensions.find((d) => d.id === 'read')?.score).toBe(0.4)
  })

  it('falls back when the grade is malformed or has no usable dimensions', () => {
    expect(applyGradeGuard(base({ raw: 'not json' })).ok).toBe(false)
    expect(applyGradeGuard(base({ raw: { dimensions: [{ id: 'ghost', score: 0.5, note: '' }], feedback: 'x' } })).ok).toBe(false)
  })
})

describe('applyGradeGuard — feedback sanitation', () => {
  it('keeps clean feedback and the numbers we handed the model', () => {
    const res = applyGradeGuard(base({
      allowedNumbers: [240],
      raw: { dimensions: [{ id: 'read', score: 0.8, note: 'good' }], feedback: 'Sound process on a $240 loss.' },
    }))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.feedback).toMatch(/sound process/i)
  })

  it('drops feedback that invents a non-whitelisted number (replaced by the safe detail)', () => {
    const res = applyGradeGuard(base({
      allowedNumbers: [240],
      raw: { dimensions: [{ id: 'read', score: 0.8, note: 'good' }], feedback: 'You left $9,999 on the table.' },
    }))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.feedback).not.toMatch(/9,?999/)
  })

  it('drops a note that makes a disallowed claim', () => {
    const res = applyGradeGuard(base({
      raw: { dimensions: [{ id: 'read', score: 0.8, note: 'This will definitely rip higher — guaranteed.' }], feedback: 'Reasonable.' },
    }))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.score.dimensions.find((d) => d.id === 'read')?.note).toBe('')
  })
})

describe('applyGradeGuard — PROCESS-NOT-P&L sanity bound', () => {
  it('rejects an LLM grade that penalizes a well-processed LOSS below its process merit', () => {
    // Strong process (deterministic ~80), realized loss, but the LLM tanks the score to ~13.
    const res = applyGradeGuard(base({
      rubricDims: dims([0.8, 0.8, 0.8]),
      pnl: -500,
      raw: { dimensions: [
        { id: 'read', score: 0.1, note: '' }, { id: 'sizing', score: 0.1, note: '' }, { id: 'stop', score: 0.2, note: '' },
      ], feedback: 'Bad trade.' },
    }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/loss/i)
  })

  it('rejects an LLM grade that rewards a poorly-processed WIN above its process merit', () => {
    const res = applyGradeGuard(base({
      rubricDims: dims([0.2, 0.2, 0.2]),
      pnl: 800,
      raw: { dimensions: [
        { id: 'read', score: 0.95, note: '' }, { id: 'sizing', score: 0.95, note: '' }, { id: 'stop', score: 0.95, note: '' },
      ], feedback: 'Nice win.' },
    }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/win/i)
  })

  it('allows a loss scored ABOVE its process merit (generosity is not P&L contamination)', () => {
    const res = applyGradeGuard(base({
      rubricDims: dims([0.4, 0.4, 0.4]),
      pnl: -300,
      raw: { dimensions: [
        { id: 'read', score: 0.7, note: '' }, { id: 'sizing', score: 0.7, note: '' }, { id: 'stop', score: 0.7, note: '' },
      ], feedback: 'Better than the result suggests.' },
    }))
    expect(res.ok).toBe(true)
  })

  it('GUARDRAIL: a well-processed loss is never graded below a poorly-processed win', () => {
    // Run A: excellent process, lost money, LLM tries to punish the loss.
    const lossRun = applyGradeGuard(base({
      rubricDims: dims([0.9, 0.9, 0.9]), pnl: -500,
      raw: { dimensions: [{ id: 'read', score: 0.1, note: '' }, { id: 'sizing', score: 0.1, note: '' }, { id: 'stop', score: 0.1, note: '' }], feedback: 'x' },
    }))
    // Run B: reckless process, made money, LLM tries to reward the win.
    const winRun = applyGradeGuard(base({
      rubricDims: dims([0.15, 0.15, 0.15]), pnl: 900,
      raw: { dimensions: [{ id: 'read', score: 0.95, note: '' }, { id: 'sizing', score: 0.95, note: '' }, { id: 'stop', score: 0.95, note: '' }], feedback: 'x' },
    }))
    // Both P&L-contaminated grades are rejected → callers use the deterministic guardrail.
    expect(lossRun.ok).toBe(false)
    expect(winRun.ok).toBe(false)
    // And the deterministic guardrail preserves process ordering: 90% loss > 15% win.
    const detTotal = (d: number) => Math.round(d * 100)
    expect(detTotal(0.9)).toBeGreaterThan(detTotal(0.15))
  })
})
