import { describe, it, expect, vi } from 'vitest'
import { gradeRunHybrid, summarizeCandles, type GradeApiResponse, type GradeTransport } from './grade'
import type { Candle } from '../../data/candles'
import type { ChartsDecision, ProcessScore, ScenarioOutcome, ScenarioSpec } from '../types'

const spec: ScenarioSpec = {
  id: 'g1', track: 'charts', tier: 1, title: 'Take it or skip it', brief: 'A clean setup.',
  dataRef: { candlesKey: 'k' }, objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
  rubricId: 'charts-v1', nudges: [], coachContextKeys: ['outcome'], source: 'llm',
}
const decision: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 95, target: 115, shares: 20 }
const outcome: ScenarioOutcome = { pnl: -100, facts: { took: true, hit: 'sl', exit: 95, netMove: -8, entryRef: 100 } }

const candles: Candle[] = [
  { t: 0, o: 100, h: 106, l: 99, c: 100 },
  { t: 1, o: 100, h: 108, l: 96, c: 104 },
  { t: 2, o: 104, h: 105, l: 90, c: 92 },
]

const transport = (res: GradeApiResponse): GradeTransport => vi.fn().mockResolvedValue(res)

describe('summarizeCandles', () => {
  it('summarizes a real slice into compact numeric facts', () => {
    const s = summarizeCandles(candles)
    expect(s.bars).toBe(3)
    expect(s.startClose).toBe(100)
    expect(s.endClose).toBe(92)
    expect(s.high).toBe(108)
    expect(s.low).toBe(90)
    expect(s.netChange).toBe(-8)
    expect(s.pctChange).toBe(-8)
  })
  it('is safe on an empty slice', () => {
    expect(summarizeCandles([])).toEqual({ bars: 0, startClose: 0, endClose: 0, high: 0, low: 0, netChange: 0, pctChange: 0 })
  })
})

describe('gradeRunHybrid', () => {
  const cs = summarizeCandles(candles)

  it('returns the server LLM score + feedback when gradeRun succeeds', async () => {
    const score: ProcessScore = { total: 84, dimensions: [{ id: 'read', label: 'Correct read', weight: 2, score: 0.9, note: 'ok' }], pnl: -100, title: 'Solid process', detail: 'd' }
    const res = await gradeRunHybrid({ spec, decision, outcome, candleSummary: cs }, transport({ score, feedback: 'Good process on the loss.' }))
    expect(res.source).toBe('llm')
    expect(res.score.total).toBe(84)
    expect(res.feedback).toMatch(/good process/i)
  })

  it('builds the grade request from the deterministic rubric (dimensions + facts + candle summary)', async () => {
    const fn = vi.fn().mockResolvedValue({ fallback: true } as GradeApiResponse)
    await gradeRunHybrid({ spec, decision, outcome, candleSummary: cs, signals: { confidence: 70 } }, fn)
    const req = fn.mock.calls[0][0]
    expect(req.track).toBe('charts')
    expect(req.passScore).toBe(70)
    expect(req.outcomeFacts.pnl).toBe(-100)
    expect(req.candleSummary).toEqual(cs)
    expect(req.signals).toEqual({ confidence: 70 })
    expect(req.rubricDims.length).toBeGreaterThan(0)
    expect(req.rubricDims[0]).toHaveProperty('deterministic')
  })

  it('falls back to the deterministic rubric + curated debrief when the server signals fallback', async () => {
    const res = await gradeRunHybrid({ spec, decision, outcome, candleSummary: cs }, transport({ fallback: true }))
    expect(res.source).toBe('deterministic')
    expect(res.score.dimensions.length).toBeGreaterThan(0)
    expect(res.feedback.length).toBeGreaterThan(0)
  })

  it('falls back to deterministic when the call throws (offline)', async () => {
    const throwing: GradeTransport = vi.fn().mockRejectedValue(new Error('offline'))
    const res = await gradeRunHybrid({ spec, decision, outcome, candleSummary: cs }, throwing)
    expect(res.source).toBe('deterministic')
  })

  it('grades deterministically with no transport (AI disabled)', async () => {
    const res = await gradeRunHybrid({ spec, decision, outcome, candleSummary: cs }, null)
    expect(res.source).toBe('deterministic')
    expect(res.score.pnl).toBe(-100)
  })
})
