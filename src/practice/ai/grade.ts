import type { Candle } from '../../data/candles'
import type { Decision, Feeling, ProcessScore, ScenarioOutcome, ScenarioSpec } from '../types'
import type { ProcessSignals } from '../genui/types'
import type { CandleSummary, GradeRequest, RubricDimRef } from '../genui/gradePrompt'
import { getRubric } from '../rubrics'
import { curatedDebrief } from '../debrief'

/** The server callable response (mirrors functions `gradeRun`). */
export type GradeApiResponse = { score: ProcessScore; feedback: string } | { fallback: true }

/** Injectable grade transport — `getGradeFn()` (the httpsCallable wrapper) or a test fake. */
export type GradeTransport = (req: GradeRequest) => Promise<GradeApiResponse>

export interface GradeRunInput {
  spec: ScenarioSpec
  decision: Decision
  /** The deterministic outcome (exact P&L + real facts) from the engine resolver. */
  outcome: ScenarioOutcome
  /** Compact REAL candle-slice summary the grader may cite. */
  candleSummary: CandleSummary
  /** Process signals (extra widget answers) gathered by WidgetHost. */
  signals?: ProcessSignals
  journal?: { rationale: string; feeling: Feeling }
}

export interface GradeRunResult {
  score: ProcessScore
  feedback: string
  source: 'llm' | 'deterministic'
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Build a compact, number-bearing summary of a REAL candle slice. These numbers are the
 * ONLY price context handed to the grader, and they become the citation whitelist. Safe on
 * empty/degenerate slices.
 */
export function summarizeCandles(candles: Candle[]): CandleSummary {
  if (!candles.length) return { bars: 0, startClose: 0, endClose: 0, high: 0, low: 0, netChange: 0, pctChange: 0 }
  const startClose = candles[0].c
  const endClose = candles[candles.length - 1].c
  let high = -Infinity
  let low = Infinity
  for (const c of candles) {
    if (c.h > high) high = c.h
    if (c.l < low) low = c.l
  }
  const netChange = endClose - startClose
  return {
    bars: candles.length,
    startClose: round2(startClose),
    endClose: round2(endClose),
    high: round2(high),
    low: round2(low),
    netChange: round2(netChange),
    pctChange: startClose ? round2((netChange / startClose) * 100) : 0,
  }
}

/** Derive the grade-guard rubric references (id/label/weight + deterministic guardrail score). */
function rubricDimRefs(score: ProcessScore): RubricDimRef[] {
  return score.dimensions.map((d) => ({ id: d.id, label: d.label, weight: d.weight, deterministic: d.score }))
}

/**
 * Hybrid process grading. The deterministic rubric is ALWAYS computed first — it is the
 * score of record's guardrail and the offline fallback. When a grade transport is available
 * it calls the SERVER `gradeRun` (GPT-5.5 process score + written feedback, already clamped,
 * sanitized, and held to the process-not-P&L bound vs the deterministic rubric). Any failure
 * or a fallback signal returns the deterministic rubric + curated debrief — the app grades
 * flawlessly with AI disabled.
 */
export async function gradeRunHybrid(
  input: GradeRunInput,
  transport: GradeTransport | null,
): Promise<GradeRunResult> {
  const { spec, decision, outcome, candleSummary, signals, journal } = input
  const deterministic = getRubric(spec.rubricId)(spec, decision, outcome)

  const fallback: GradeRunResult = {
    score: deterministic,
    feedback: curatedDebrief(spec, decision, outcome, deterministic, journal),
    source: 'deterministic',
  }
  if (!transport) return fallback

  const req: GradeRequest = {
    track: spec.track,
    passScore: spec.objective.passScore,
    decision,
    outcomeFacts: { pnl: outcome.pnl, ...outcome.facts },
    candleSummary,
    signals: signals ?? {},
    rubricDims: rubricDimRefs(deterministic),
  }

  try {
    const res = await transport(req)
    if ('score' in res && res.score) return { score: res.score, feedback: res.feedback, source: 'llm' }
  } catch {
    // fall through to the deterministic guardrail
  }
  return fallback
}
