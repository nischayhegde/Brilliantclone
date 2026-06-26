/**
 * Pure guard helpers for the `aiRespond` callable: input validation, token/temperature
 * clamping, and per-uid rate limiting. Deliberately FREE of `firebase-functions` and
 * `firebase-admin` imports so they unit-test fully offline; `index.ts` maps their
 * results onto `HttpsError`.
 */
import type { JsonSchemaSpec } from './openai'

// --- token + temperature clamps ---------------------------------------------------

/** Floor for a single response's output tokens. */
export const MIN_OUTPUT_TOKENS = 16
/** Default output-token budget when the caller doesn't ask for one. */
export const DEFAULT_OUTPUT_TOKENS = 1024
/** Hard ceiling — clamps any client request so a single call can't run away on cost. */
export const MAX_OUTPUT_TOKENS = 4096

/** Clamp a requested output-token budget into [MIN, MAX], defaulting when absent/invalid. */
export function clampMaxOutputTokens(requested?: number): number {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return DEFAULT_OUTPUT_TOKENS
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, Math.floor(requested)))
}

/** Clamp temperature into [0, 2]; returns undefined when not provided (so it's omitted). */
export function clampTemperature(requested?: number): number | undefined {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return undefined
  return Math.min(2, Math.max(0, requested))
}

// --- input validation -------------------------------------------------------------

/** The validated, trusted shape `aiRespond` forwards to `callModel`. */
export interface AiRespondInput {
  instructions?: string
  input: string
  jsonSchema?: JsonSchemaSpec
  temperature?: number
  maxOutputTokens?: number
}

export type ValidationOutcome =
  | { ok: true; value: AiRespondInput }
  | { ok: false; error: string }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const JSON_SCHEMA_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/
/** Max accepted prompt size (chars) — a coarse abuse guard before hitting the model. */
export const MAX_INPUT_CHARS = 24000

/** Validate raw callable `data` into a trusted `AiRespondInput` (or an error string). */
export function validateAiRespondInput(data: unknown): ValidationOutcome {
  if (!isObject(data)) return { ok: false, error: 'Request body must be an object.' }

  const { input, instructions, jsonSchema, temperature, maxOutputTokens } = data

  if (typeof input !== 'string' || input.trim() === '') {
    return { ok: false, error: 'input must be a non-empty string.' }
  }
  if (input.length > MAX_INPUT_CHARS) {
    return { ok: false, error: `input exceeds ${MAX_INPUT_CHARS} characters.` }
  }
  if (instructions != null && typeof instructions !== 'string') {
    return { ok: false, error: 'instructions must be a string when provided.' }
  }
  if (temperature != null && (typeof temperature !== 'number' || !Number.isFinite(temperature))) {
    return { ok: false, error: 'temperature must be a finite number when provided.' }
  }
  if (maxOutputTokens != null && (typeof maxOutputTokens !== 'number' || !Number.isFinite(maxOutputTokens))) {
    return { ok: false, error: 'maxOutputTokens must be a finite number when provided.' }
  }

  let schema: JsonSchemaSpec | undefined
  if (jsonSchema != null) {
    if (!isObject(jsonSchema)) return { ok: false, error: 'jsonSchema must be an object when provided.' }
    const { name, schema: schemaObj, strict } = jsonSchema
    if (typeof name !== 'string' || !JSON_SCHEMA_NAME_RE.test(name)) {
      return { ok: false, error: 'jsonSchema.name must match [a-zA-Z0-9_-]{1,64}.' }
    }
    if (!isObject(schemaObj)) return { ok: false, error: 'jsonSchema.schema must be a JSON Schema object.' }
    if (strict != null && typeof strict !== 'boolean') {
      return { ok: false, error: 'jsonSchema.strict must be a boolean when provided.' }
    }
    schema = { name, schema: schemaObj as Record<string, unknown>, ...(typeof strict === 'boolean' ? { strict } : {}) }
  }

  const value: AiRespondInput = { input }
  if (typeof instructions === 'string') value.instructions = instructions
  if (schema) value.jsonSchema = schema
  if (typeof temperature === 'number') value.temperature = temperature
  if (typeof maxOutputTokens === 'number') value.maxOutputTokens = maxOutputTokens
  return { ok: true, value }
}

// --- composeScenario / gradeRun input validation ----------------------------------

const TRACKS = new Set(['charts', 'options', 'market-making'])

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/** The trusted shape `composeScenario` forwards to the isomorphic compose builder. */
export interface ComposeInput {
  track: string
  tier: number
  accountBalance: number
  catalog: {
    candlesKeys: string[]
    ohlcAssets: string[]
    chainAssets: string[]
    rubricIds: string[]
    nudgeIds: string[]
  }
}

export type ComposeOutcome =
  | { ok: true; value: ComposeInput }
  | { ok: false; error: string }

/** Max catalog allow-list size (per array) — a coarse abuse guard before composing. */
export const MAX_CATALOG_ENTRIES = 5000

/** Validate raw callable `data` into a trusted `ComposeInput` (or an error string). */
export function validateComposeInput(data: unknown): ComposeOutcome {
  if (!isObject(data)) return { ok: false, error: 'Request body must be an object.' }
  const { track, tier, accountBalance, catalog } = data
  if (typeof track !== 'string' || !TRACKS.has(track)) return { ok: false, error: 'track must be charts|options|market-making.' }
  if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 1) return { ok: false, error: 'tier must be an integer >= 1.' }
  if (typeof accountBalance !== 'number' || !Number.isFinite(accountBalance) || accountBalance <= 0) {
    return { ok: false, error: 'accountBalance must be a positive number.' }
  }
  if (!isObject(catalog)) return { ok: false, error: 'catalog must be an object.' }
  const { candlesKeys, ohlcAssets, chainAssets, rubricIds, nudgeIds } = catalog
  if (![candlesKeys, ohlcAssets, chainAssets, rubricIds, nudgeIds].every(isStringArray)) {
    return { ok: false, error: 'catalog arrays (candlesKeys, ohlcAssets, chainAssets, rubricIds, nudgeIds) must be string arrays.' }
  }
  if ([candlesKeys, ohlcAssets, chainAssets].some((a) => (a as string[]).length > MAX_CATALOG_ENTRIES)) {
    return { ok: false, error: `catalog allow-list exceeds ${MAX_CATALOG_ENTRIES} entries.` }
  }
  return {
    ok: true,
    value: {
      track,
      tier,
      accountBalance,
      catalog: {
        candlesKeys: candlesKeys as string[],
        ohlcAssets: ohlcAssets as string[],
        chainAssets: chainAssets as string[],
        rubricIds: rubricIds as string[],
        nudgeIds: nudgeIds as string[],
      },
    },
  }
}

/** The trusted shape `gradeRun` forwards to the isomorphic grade builder + guard. */
export interface GradeInput {
  track: string
  passScore: number
  decision: Record<string, unknown>
  outcomeFacts: Record<string, number | string | boolean>
  candleSummary: Record<string, unknown>
  signals: Record<string, unknown>
  rubricDims: { id: string; label: string; weight: number; deterministic: number }[]
}

export type GradeOutcome =
  | { ok: true; value: GradeInput }
  | { ok: false; error: string }

const CANDLE_SUMMARY_KEYS = ['bars', 'startClose', 'endClose', 'high', 'low', 'netChange', 'pctChange']

/** Validate raw callable `data` into a trusted `GradeInput` (or an error string). */
export function validateGradeInput(data: unknown): GradeOutcome {
  if (!isObject(data)) return { ok: false, error: 'Request body must be an object.' }
  const { track, passScore, decision, outcomeFacts, candleSummary, signals, rubricDims } = data
  if (typeof track !== 'string' || !TRACKS.has(track)) return { ok: false, error: 'track must be charts|options|market-making.' }
  if (typeof passScore !== 'number' || !Number.isFinite(passScore)) return { ok: false, error: 'passScore must be a finite number.' }
  if (!isObject(decision)) return { ok: false, error: 'decision must be an object.' }
  if (!isObject(outcomeFacts)) return { ok: false, error: 'outcomeFacts must be an object.' }
  if (!isObject(candleSummary) || !CANDLE_SUMMARY_KEYS.every((k) => typeof candleSummary[k] === 'number')) {
    return { ok: false, error: 'candleSummary must carry numeric bars/start/end/high/low/net/pct.' }
  }
  if (!isObject(signals)) return { ok: false, error: 'signals must be an object.' }
  if (!Array.isArray(rubricDims) || rubricDims.length === 0) return { ok: false, error: 'rubricDims must be a non-empty array.' }
  const dims: GradeInput['rubricDims'] = []
  for (const d of rubricDims) {
    if (!isObject(d) || typeof d.id !== 'string' || typeof d.label !== 'string' ||
      typeof d.weight !== 'number' || typeof d.deterministic !== 'number') {
      return { ok: false, error: 'each rubricDim needs id, label, numeric weight and deterministic.' }
    }
    dims.push({ id: d.id, label: d.label, weight: d.weight, deterministic: d.deterministic })
  }
  return {
    ok: true,
    value: {
      track,
      passScore,
      decision: decision as Record<string, unknown>,
      outcomeFacts: outcomeFacts as Record<string, number | string | boolean>,
      candleSummary: candleSummary as Record<string, unknown>,
      signals: signals as Record<string, unknown>,
      rubricDims: dims,
    },
  }
}

// --- rate limiting ----------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean
  /** Requests still permitted in the current window. */
  remaining: number
  /** Milliseconds until the window frees up (0 when allowed). */
  retryAfterMs: number
}

export interface RateLimiterOptions {
  /** Max requests permitted per uid within `windowMs`. */
  limit: number
  /** Sliding-window length in milliseconds. */
  windowMs: number
}

/**
 * Simple in-memory sliding-window limiter keyed by uid. Per-instance and best-effort
 * (a horizontally-scaled deployment limits per warm instance) — sufficient as a cost
 * guardrail; WS-D may swap in a Firestore counter for a global cap. `now` is injected
 * so the window logic is deterministically testable.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>()
  constructor(private readonly opts: RateLimiterOptions) {}

  /** Record + evaluate a request for `uid` at time `now` (ms epoch). */
  check(uid: string, now: number = Date.now()): RateLimitResult {
    const windowStart = now - this.opts.windowMs
    const recent = (this.hits.get(uid) ?? []).filter((t) => t > windowStart)

    if (recent.length >= this.opts.limit) {
      const oldest = recent[0]
      this.hits.set(uid, recent)
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, oldest + this.opts.windowMs - now) }
    }

    recent.push(now)
    this.hits.set(uid, recent)
    return { allowed: true, remaining: this.opts.limit - recent.length, retryAfterMs: 0 }
  }

  /** Drop a uid's history (test helper / manual reset). */
  reset(uid?: string): void {
    if (uid == null) this.hits.clear()
    else this.hits.delete(uid)
  }
}
