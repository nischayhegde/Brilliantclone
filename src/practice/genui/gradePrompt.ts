/**
 * Isomorphic GRADE builders — the single source of truth both the Vite client and the
 * Cloud Functions runtime use to have GPT-5.5 grade PROCESS (not P&L) and write feedback.
 *
 * PURE / ISOMORPHIC: imports only the shared `../types` + sibling genui types. NO
 * React/DOM/Phaser/firebase, so `copy-shared.mjs` mirrors it and the server grades with
 * the SAME prompt + whitelist the client trusts.
 *
 * The model receives ONLY: a compact decision summary, the deterministic outcome facts, a
 * compact REAL candle-slice summary, the process signals, and the rubric's dimension
 * ids/labels. It NEVER receives the deterministic dimension scores (so it judges process
 * independently) and may cite ONLY the numbers we hand it (enforced by the grade guard).
 */
import type { Decision, Track } from '../types'
import type { ProcessSignals } from './types'

/** A compact, number-bearing summary of the REAL candle slice the scenario is built on. */
export interface CandleSummary {
  bars: number
  startClose: number
  endClose: number
  high: number
  low: number
  /** endClose - startClose (signed, rounded). */
  netChange: number
  /** Percentage move start→end (signed, rounded). */
  pctChange: number
}

/** One rubric dimension reference: id + label for the model; `deterministic` for the guard ONLY. */
export interface RubricDimRef {
  id: string
  label: string
  weight: number
  /** Deterministic rubric's 0..1 guardrail score — used by `applyGradeGuard`, never shown to the model. */
  deterministic: number
}

export interface GradeRequest {
  track: Track
  passScore: number
  decision: Decision
  /** Deterministic outcome facts (includes pnl); whitelisted numbers the model may cite. */
  outcomeFacts: Record<string, number | string | boolean>
  candleSummary: CandleSummary
  signals: ProcessSignals
  rubricDims: RubricDimRef[]
}

/** The system/developer message: process-over-outcome + cite-only-whitelisted-facts. Stable. */
export function buildGradeInstructions(): string {
  return [
    'You are a calm, plain-spoken trading coach grading a single practice decision. You grade PROCESS, not outcome.',
    'HARD RULES — you NEVER break these:',
    '- Grade the QUALITY OF THE PROCESS (read, sizing, risk definition, plan coherence, management). A well-reasoned losing trade scores HIGH; a reckless winning trade scores LOW.',
    '- NEVER let realized profit or loss drive a score. The P&L sign is NOT a target.',
    '- You may ONLY cite numbers that appear in the FACTS / candle-summary / decision blocks. Introduce NO other number.',
    '- NEVER predict prices, recommend trades, or give financial advice.',
    '- Score EACH listed rubric dimension from 0 to 1, with a one-sentence note. Then write 2–4 sentences of warm, direct feedback (one analogy max, no hype).',
    'Return STRICT JSON matching the provided schema — no markdown, no commentary.',
  ].join('\n')
}

function describeDecision(track: Track, decision: Decision): string {
  const d = decision as unknown as Record<string, unknown>
  if (track === 'charts') {
    if (!d.took) return 'Decision: sat out (no trade taken).'
    const parts = [`took a ${d.direction ?? 'long'} trade`]
    if (d.entry != null) parts.push(`entry ${d.entry}`)
    if (d.stop != null) parts.push(`stop ${d.stop}`)
    if (d.target != null) parts.push(`target ${d.target}`)
    if (d.shares != null) parts.push(`size ${d.shares}`)
    return `Decision: ${parts.join(', ')}.`
  }
  if (track === 'options') {
    const legs = Array.isArray(d.legs) ? (d.legs as Record<string, unknown>[]) : []
    const desc = legs.map((l) => `${l.side} ${l.type} K=${l.K} x${l.contracts}`).join('; ')
    return `Decision: ${legs.length} option leg(s) [${desc}]; managed: ${d.managed ?? 'hold'}.`
  }
  return `Decision: quote bidWidth ${d.bidWidth}, askWidth ${d.askWidth}, size ${d.quoteSize}, inventory cap ${d.maxInventory}.`
}

function factsBlock(facts: Record<string, number | string | boolean>): string {
  const entries = Object.entries(facts)
  if (!entries.length) return '  (none)'
  return entries.map(([k, v]) => `  ${k}: ${v}`).join('\n')
}

function signalsBlock(signals: ProcessSignals): string {
  const entries = Object.entries(signals)
  if (!entries.length) return '  (none)'
  return entries.map(([k, v]) => `  ${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`).join('\n')
}

/**
 * The per-request user message. Lists the dimension ids/labels to score (NOT their
 * deterministic scores), the decision, the real candle summary, the outcome facts, and
 * the process signals.
 */
export function buildGradeInput(req: GradeRequest): string {
  const { track, passScore, decision, outcomeFacts, candleSummary, signals, rubricDims } = req
  const cs = candleSummary
  return [
    `Track: ${track}. Pass mark: ${passScore}/100 (telemetry only; never let it bias the grade).`,
    describeDecision(track, decision),
    'REAL candle slice (the only price context; numbers you may cite):',
    `  bars: ${cs.bars}, start: ${cs.startClose}, end: ${cs.endClose}, high: ${cs.high}, low: ${cs.low}, net: ${cs.netChange}, change%: ${cs.pctChange}`,
    'FACTS (deterministic outcome; numbers you may cite):',
    factsBlock(outcomeFacts),
    'PROCESS SIGNALS (extra widget answers; context, not math):',
    signalsBlock(signals),
    'Score EACH of these rubric dimensions from 0 to 1 (use the exact ids):',
    rubricDims.map((d) => `  - ${d.id}: ${d.label}`).join('\n'),
    'Then write the 2–4 sentence feedback.',
  ].join('\n')
}

/** JSON-schema name for the grade structured-output request. */
export const GRADE_SCHEMA_NAME = 'ProcessGrade'

/** Structured-output JSON schema: per-dimension {id∈enum, score, note} + feedback. Strict. */
export function gradeJsonSchema(dimIds: string[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      dimensions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', enum: dimIds },
            score: { type: 'number' },
            note: { type: 'string' },
          },
          required: ['id', 'score', 'note'],
        },
      },
      feedback: { type: 'string' },
    },
    required: ['dimensions', 'feedback'],
  }
}

/** The model's grade after structured output. */
export interface LlmGrade {
  dimensions: { id: string; score: number; note: string }[]
  feedback: string
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Normalize raw grade JSON (object or string) into an `LlmGrade`. Throws on the essentials. */
export function parseLlmGrade(json: unknown): LlmGrade {
  const raw: unknown = typeof json === 'string' ? JSON.parse(json) : json
  if (!isObject(raw)) throw new Error('grade value is not an object')
  if (!Array.isArray(raw.dimensions)) throw new Error('grade.dimensions must be an array')
  if (typeof raw.feedback !== 'string') throw new Error('grade.feedback must be a string')
  const dimensions = raw.dimensions
    .filter(isObject)
    .map((d) => ({ id: String(d.id), score: Number(d.score), note: typeof d.note === 'string' ? d.note : '' }))
  return { dimensions, feedback: raw.feedback }
}

/**
 * The whitelist of numbers the grader may cite: every number in the candle summary, the
 * outcome facts, and the (learner-chosen, real) decision inputs. Shared by the prompt and
 * the guard so they never disagree about what counts as "a number we handed the model".
 */
export function gradeAllowedNumbers(req: GradeRequest): number[] {
  const out: number[] = []
  const add = (v: unknown): void => {
    if (typeof v === 'number' && Number.isFinite(v)) out.push(Math.abs(v))
  }
  const cs = req.candleSummary
  ;[cs.bars, cs.startClose, cs.endClose, cs.high, cs.low, cs.netChange, cs.pctChange].forEach(add)
  for (const v of Object.values(req.outcomeFacts)) add(v)
  const d = req.decision as unknown as Record<string, unknown>
  ;[d.entry, d.stop, d.target, d.shares, d.bidWidth, d.askWidth, d.quoteSize, d.maxInventory].forEach(add)
  if (Array.isArray(d.legs)) {
    for (const leg of d.legs as Record<string, unknown>[]) [leg.K, leg.premium, leg.contracts].forEach(add)
  }
  return out
}
