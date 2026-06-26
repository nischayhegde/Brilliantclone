/**
 * Isomorphic GRADE GUARD — the server- and client-side gate that makes the LLM grade
 * trustworthy. PURE / ISOMORPHIC: imports only `../types` + the copy-lint leaf, so it is
 * mirrored into the functions runtime and applied identically on both sides.
 *
 * It does four things to the model's grade:
 *   1. clamps every dimension score into [0, 1];
 *   2. drops dimensions the model invented (keeps only the rubric's dimension ids), and
 *      fills any rubric dimension the model skipped with the deterministic guardrail score;
 *   3. sanitizes the feedback prose — disallowed claims and out-of-whitelist numbers;
 *   4. enforces the PROCESS-NOT-P&L sanity bound against the deterministic rubric: the
 *      realized P&L sign may never drag the score below (a loss) or above (a win) what the
 *      deterministic process score justifies, beyond a tolerance. When the model violates
 *      basic sanity (malformed, no usable dimensions, or P&L-contaminated), the guard signals
 *      a fall-back to the deterministic rubric — the guardrail of record.
 */
import type { DimensionScore, ProcessScore } from '../types'
import { hasDisallowedClaim, numbersWithinWhitelist } from './copyLint'
import type { LlmGrade, RubricDimRef } from './gradePrompt'

/** Default deviation (0..100) the LLM total may move in the P&L-aligned direction before we distrust it. */
export const DEFAULT_PNL_TOLERANCE = 25

export interface GradeGuardInput {
  /** Raw model output — already-parsed JSON, an `LlmGrade`, or a JSON string. */
  raw: unknown
  /** The rubric's dimensions (id/label/weight + the deterministic guardrail score). Server-owned. */
  rubricDims: RubricDimRef[]
  /** Realized dollars (display only). Its SIGN is what the sanity bound protects against. */
  pnl: number
  /** Pass mark for the title; never biases the score. */
  passScore: number
  /** Numbers the feedback may cite (from `gradeAllowedNumbers`). */
  allowedNumbers?: number[]
  /** P&L-aligned deviation tolerance (default 25). */
  tolerance?: number
}

export type GradeGuardResult =
  | { ok: true; score: ProcessScore; feedback: string }
  | { ok: false; reason: string }

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/** Weighted average of 0..1 dimension scores, scaled to a 0..100 integer. */
function weightedTotal(dims: { weight: number; score: number }[]): number {
  const wsum = dims.reduce((s, d) => s + d.weight, 0)
  if (wsum === 0) return 0
  const num = dims.reduce((s, d) => s + d.weight * d.score, 0)
  return Math.round((num / wsum) * 100)
}

function asLlmGrade(raw: unknown): LlmGrade | undefined {
  const v: unknown = typeof raw === 'string' ? safeParse(raw) : raw
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  if (!Array.isArray(o.dimensions)) return undefined
  const feedback = typeof o.feedback === 'string' ? o.feedback : ''
  const dimensions = o.dimensions
    .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null && !Array.isArray(d))
    .map((d) => ({ id: String(d.id), score: Number(d.score), note: typeof d.note === 'string' ? d.note : '' }))
  return { dimensions, feedback }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}

/** Sanitize one prose string: blank it if it makes a disallowed claim or cites a non-whitelisted number. */
function sanitizeProse(text: string, allowed: number[]): string {
  if (!text) return ''
  if (hasDisallowedClaim(text)) return ''
  if (!numbersWithinWhitelist(text, allowed)) return ''
  return text
}

/**
 * Apply the guard. Returns either a trusted `{ score, feedback }` (LLM-sourced, sanitized)
 * or `{ ok: false, reason }` instructing the caller to use the deterministic rubric.
 */
export function applyGradeGuard(input: GradeGuardInput): GradeGuardResult {
  const { raw, rubricDims, pnl, passScore } = input
  const tolerance = input.tolerance ?? DEFAULT_PNL_TOLERANCE

  if (!rubricDims.length) return { ok: false, reason: 'no rubric dimensions provided' }

  const grade = asLlmGrade(raw)
  if (!grade) return { ok: false, reason: 'malformed grade output' }

  // 2) Keep only rubric dimensions; clamp model scores; drop invented ids.
  const llmById = new Map<string, { score: number; note: string }>()
  for (const d of grade.dimensions) {
    if (rubricDims.some((r) => r.id === d.id) && Number.isFinite(d.score)) {
      llmById.set(d.id, { score: clamp01(d.score), note: d.note })
    }
  }
  if (llmById.size === 0) return { ok: false, reason: 'no usable LLM dimensions' }

  // The deterministic guardrail total (the rubric's own P&L-free process score).
  const deterministicTotal = weightedTotal(rubricDims.map((r) => ({ weight: r.weight, score: r.deterministic })))
  const merged: DimensionScore[] = rubricDims.map((r) => {
    const llm = llmById.get(r.id)
    return {
      id: r.id,
      label: r.label,
      weight: r.weight,
      score: llm ? llm.score : r.deterministic, // skipped dims fall back to the guardrail
      note: '',
    }
  })
  const llmTotal = weightedTotal(merged)

  const allowed = [
    ...(input.allowedNumbers ?? []),
    llmTotal,
    deterministicTotal,
    passScore,
    100,
    ...merged.map((d) => Math.round(d.score * 100)),
  ]

  // Sanitize per-dimension notes (drop unsafe ones) now that the whitelist is known.
  for (const d of merged) {
    const llm = llmById.get(d.id)
    d.note = llm ? sanitizeProse(llm.note, allowed) : ''
  }

  // 4) PROCESS-NOT-P&L sanity bound vs the deterministic guardrail. The P&L sign may NOT
  //    drag the score in its own direction beyond the tolerance:
  //      - a LOSS may not be scored far BELOW the process it earned, and
  //      - a WIN  may not be scored far ABOVE the process it earned.
  if (pnl < 0 && llmTotal < deterministicTotal - tolerance) {
    return { ok: false, reason: 'P&L-penalized loss: LLM scored a loss below its process merit' }
  }
  if (pnl > 0 && llmTotal > deterministicTotal + tolerance) {
    return { ok: false, reason: 'P&L-rewarded win: LLM scored a win above its process merit' }
  }

  // 3) Sanitize feedback; if unsafe, fall back to a number-safe detail built from dimensions.
  const detail = merged.map((d) => `${d.label}: ${Math.round(d.score * 100)}%${d.note ? ` — ${d.note}` : ''}`).join('  ')
  const feedback = sanitizeProse(grade.feedback, allowed) || detail

  const score: ProcessScore = {
    total: llmTotal,
    dimensions: merged,
    pnl,
    title: llmTotal >= passScore ? 'Solid process' : 'Process needs work',
    detail,
  }
  return { ok: true, score, feedback }
}
