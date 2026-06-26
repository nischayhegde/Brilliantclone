/**
 * Cloud Functions backend for Trading Practice.
 *
 * The app talks to two dedicated callables — `composeScenario` and `gradeRun` — which build
 * the GPT-5.5 prompt + JSON schema SERVER-SIDE (importing the isomorphic genui prompt
 * builders + `validateLayout`/`applyGradeGuard`, see ./genui) and validate/guard the model
 * output there. The client never sees the prompt or the raw model output, and the OpenAI key
 * stays a Functions secret. Both are auth-gated, per-uid rate-limited, and token-capped.
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import { callModel } from './openai'
import {
  RateLimiter,
  clampMaxOutputTokens,
  validateComposeInput,
  validateGradeInput,
} from './guards'
import {
  runCompose,
  runGrade,
  type CallModelFn,
  type ComposeRequest,
  type ComposeResponse,
  type GradeRequest,
  type GradeResponse,
} from './genui'

// Re-exported so WS-D and tests can reach the proven isomorphic genui import path.
export { sanityValidateLayout } from './genui'

/**
 * The model transport handed to the composer/grader orchestrators. Adapts `callModel`
 * (./openai) to the orchestrators' `CallModelFn` surface — which deliberately omits
 * `temperature` (GPT-5.5 is a reasoning model; it uses `reasoning.effort`).
 */
const modelTransport: CallModelFn = (params) =>
  callModel({
    instructions: params.instructions,
    input: params.input,
    jsonSchema: params.jsonSchema,
    maxOutputTokens: clampMaxOutputTokens(params.maxOutputTokens),
  })

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')

// Keep cold-start + cost bounded; one region for all callables.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

/** Per-uid cap: 15 model calls/minute (best-effort, per warm instance). */
const limiter = new RateLimiter({ limit: 15, windowMs: 60_000 })

/** Require an authenticated caller + a free rate-limit slot, or throw the matching HttpsError. */
function requireAuthedSlot(request: CallableRequest): string {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in to use AI features.')
  const rl = limiter.check(uid)
  if (!rl.allowed) {
    throw new HttpsError('resource-exhausted', `Rate limit reached. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`)
  }
  return uid
}

/**
 * Compose a validated, GPT-5.5-authored interactive scenario. Input:
 *   { track, tier, accountBalance, catalog } → { spec } | { fallback: true }
 *
 * The prompt + layout JSON schema are built server-side and the raw model output is
 * validated + assembled server-side (server-owned constraints/dataRef/source), so the client
 * never sees the prompt or untrusted output. On any failure it returns `{ fallback: true }`
 * and the client uses a curated layout spec.
 */
export const composeScenario = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request: CallableRequest): Promise<ComposeResponse> => {
    requireAuthedSlot(request)
    const parsed = validateComposeInput(request.data)
    if (!parsed.ok) throw new HttpsError('invalid-argument', parsed.error)
    try {
      // Validated structurally above; the builders re-validate every field defensively.
      return await runCompose(parsed.value as unknown as ComposeRequest, modelTransport)
    } catch (err) {
      console.error('composeScenario failed', err)
      return { fallback: true }
    }
  },
)

/**
 * Grade a run's PROCESS (not P&L) with GPT-5.5 + written feedback. Input:
 *   { track, passScore, decision, outcomeFacts, candleSummary, signals, rubricDims }
 *   → { score, feedback } | { fallback: true }
 *
 * The grade is clamped, dimension-filtered, prose-sanitized, and held to the process-not-P&L
 * sanity bound vs the deterministic rubric (passed in `rubricDims`). On any failure or a
 * sanity violation it returns `{ fallback: true }` and the client uses the deterministic rubric.
 */
export const gradeRun = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request: CallableRequest): Promise<GradeResponse> => {
    requireAuthedSlot(request)
    const parsed = validateGradeInput(request.data)
    if (!parsed.ok) throw new HttpsError('invalid-argument', parsed.error)
    try {
      // Validated structurally above; the grade guard re-validates + clamps defensively.
      return await runGrade(parsed.value as unknown as GradeRequest, modelTransport)
    } catch (err) {
      console.error('gradeRun failed', err)
      return { fallback: true }
    }
  },
)
