import { describe, it, expect } from 'vitest'
import {
  buildGradeInput,
  buildGradeInstructions,
  gradeAllowedNumbers,
  gradeJsonSchema,
  parseLlmGrade,
  type GradeRequest,
} from './gradePrompt'
import type { ChartsDecision } from '../types'

const decision: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 95, target: 115, shares: 50 }
const req: GradeRequest = {
  track: 'charts',
  passScore: 70,
  decision,
  outcomeFacts: { pnl: -240, hit: 'sl', exit: 95, entryRef: 100 },
  candleSummary: { bars: 40, startClose: 100, endClose: 92, high: 108, low: 90, netChange: -8, pctChange: -8 },
  signals: { confidence: 80, checklist: ['trend', 'risk'] },
  rubricDims: [
    { id: 'read', label: 'Correct read', weight: 2, deterministic: 0.8 },
    { id: 'sizing', label: 'Position sizing', weight: 2, deterministic: 0.9 },
  ],
}

describe('buildGradeInstructions', () => {
  it('mandates process-over-outcome and whitelisted numbers', () => {
    const ins = buildGradeInstructions().toLowerCase()
    expect(ins).toContain('process')
    expect(ins).toMatch(/losing trade scores high/)
    expect(ins).toMatch(/never let realized profit or loss/)
    expect(ins).toContain('json')
  })
})

describe('buildGradeInput', () => {
  it('lists the dimension ids/labels but NEVER the deterministic scores', () => {
    const p = buildGradeInput(req)
    expect(p).toContain('read: Correct read')
    expect(p).toContain('sizing: Position sizing')
    // The deterministic guardrail scores must not leak to the model.
    expect(p).not.toContain('0.8')
    expect(p).not.toContain('0.9')
  })
  it('includes the decision, candle summary, facts and signals', () => {
    const p = buildGradeInput(req)
    expect(p).toMatch(/long trade/)
    expect(p).toContain('bars: 40')
    expect(p).toContain('pnl: -240')
    expect(p).toContain('confidence: 80')
  })
})

describe('gradeJsonSchema', () => {
  it('constrains dimension ids to an enum and requires feedback', () => {
    const s = gradeJsonSchema(['read', 'sizing']) as Record<string, unknown>
    expect(s.required).toEqual(expect.arrayContaining(['dimensions', 'feedback']))
    const dims = (s.properties as Record<string, { items: { properties: { id: { enum: string[] } } } }>).dimensions
    expect(dims.items.properties.id.enum).toEqual(['read', 'sizing'])
  })
})

describe('parseLlmGrade', () => {
  it('normalizes dimensions + feedback from a JSON string', () => {
    const g = parseLlmGrade(JSON.stringify({ dimensions: [{ id: 'read', score: 0.7, note: 'ok' }], feedback: 'Good plan.' }))
    expect(g.dimensions[0]).toEqual({ id: 'read', score: 0.7, note: 'ok' })
    expect(g.feedback).toBe('Good plan.')
  })
  it('throws on malformed grade output', () => {
    expect(() => parseLlmGrade({ feedback: 'x' })).toThrow()
    expect(() => parseLlmGrade('nope')).toThrow()
  })
})

describe('gradeAllowedNumbers', () => {
  it('collects numbers from the candle summary, facts and decision inputs', () => {
    const allowed = gradeAllowedNumbers(req)
    expect(allowed).toEqual(expect.arrayContaining([40, 100, 92, 108, 90, 8, 240, 95, 115, 50]))
  })
})
