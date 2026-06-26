/**
 * Pure guard helpers for the `composeScenario`/`gradeRun` callables: input validation,
 * output-token clamping, and per-uid rate limiting. Deliberately FREE of
 * `firebase-functions` and `firebase-admin` imports so they unit-test fully offline;
 * `index.ts` maps their results onto `HttpsError`.
 */

// --- token clamp ------------------------------------------------------------------

/** Floor for a single response's output tokens. */
export const MIN_OUTPUT_TOKENS = 16
/** Default output-token budget when the caller doesn't ask for one. */
export const DEFAULT_OUTPUT_TOKENS = 1024
/** Hard ceiling — clamps any request so a single call can't run away on cost. */
export const MAX_OUTPUT_TOKENS = 4096

/** Clamp a requested output-token budget into [MIN, MAX], defaulting when absent/invalid. */
export function clampMaxOutputTokens(requested?: number): number {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return DEFAULT_OUTPUT_TOKENS
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, Math.floor(requested)))
}

// --- composeScenario / gradeRun input validation ----------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

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
/**
 * Max rubric/nudge id-list size. These are interpolated IN FULL into the compose prompt
 * (unlike the data refs, which are sampled), so they are the primary prompt-injection
 * surface and get a tighter count cap than the data allow-lists.
 */
export const MAX_ID_LIST_ENTRIES = 200
/** Max length of any single catalog string — bounds the per-entry injection surface. */
export const MAX_CATALOG_ENTRY_CHARS = 64
/** Max total characters across every catalog array — a coarse cost/payload ceiling. */
export const MAX_TOTAL_CATALOG_CHARS = 200_000

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
  // rubric/nudge ids are interpolated in full into the prompt — cap their count.
  if ((rubricIds as string[]).length > MAX_ID_LIST_ENTRIES || (nudgeIds as string[]).length > MAX_ID_LIST_ENTRIES) {
    return { ok: false, error: `rubricIds/nudgeIds exceed ${MAX_ID_LIST_ENTRIES} entries.` }
  }
  // Per-string + total-size ceilings across ALL arrays (cost + prompt-injection guard).
  const allStrings = [
    ...(candlesKeys as string[]), ...(ohlcAssets as string[]), ...(chainAssets as string[]),
    ...(rubricIds as string[]), ...(nudgeIds as string[]),
  ]
  if (allStrings.some((s) => s.length > MAX_CATALOG_ENTRY_CHARS)) {
    return { ok: false, error: `a catalog entry exceeds ${MAX_CATALOG_ENTRY_CHARS} characters.` }
  }
  if (allStrings.reduce((n, s) => n + s.length, 0) > MAX_TOTAL_CATALOG_CHARS) {
    return { ok: false, error: `catalog total size exceeds ${MAX_TOTAL_CATALOG_CHARS} characters.` }
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
  // Outcome facts are numbers the grade guard whitelists + the P&L sanity bound reads — any
  // non-finite numeric fact (NaN/±Infinity) would poison the guard, so reject them (MIN-4).
  for (const [k, v] of Object.entries(outcomeFacts)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      return { ok: false, error: `outcomeFacts.${k} must be a finite number.` }
    }
  }
  // `pnl`, when present, is the sign the process-not-P&L bound protects against — require a
  // finite number (never a string that would coerce to NaN downstream).
  if (outcomeFacts.pnl != null && (typeof outcomeFacts.pnl !== 'number' || !Number.isFinite(outcomeFacts.pnl))) {
    return { ok: false, error: 'outcomeFacts.pnl must be a finite number.' }
  }
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
