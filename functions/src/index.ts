/**
 * Cloud Functions backend for Trading Practice.
 *
 * `aiRespond` is the SECURE TRANSPORT for the existing client composer/coach pipelines:
 * it keeps the OpenAI key server-side (a Functions secret), requires an authenticated
 * caller, rate-limits per uid, and clamps the token budget before calling GPT-5.5.
 *
 * Boundary note for WS-D: this is a generic text/JSON transport — the client still
 * builds the composer/grader prompts. WS-D will add dedicated `composeScenario` and
 * `gradeRun` callables that build the prompts SERVER-SIDE (importing the isomorphic
 * genui prompt builders + `validateLayout`, see ./genui) for a tighter boundary where
 * the client never sees the prompt or the raw model output.
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import { callModel } from './openai'
import {
  RateLimiter,
  clampMaxOutputTokens,
  clampTemperature,
  validateAiRespondInput,
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

export interface AiRespondResponse {
  text: string
}

/**
 * Secure GPT-5.5 transport. Input:
 *   { instructions?, input, jsonSchema?, temperature?, maxOutputTokens? } → { text }
 */
export const aiRespond = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request: CallableRequest): Promise<AiRespondResponse> => {
    // 1) Auth required — reject anonymous callers outright.
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to use AI features.')
    }

    // 2) Rate-limit per uid.
    const rl = limiter.check(uid)
    if (!rl.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit reached. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
      )
    }

    // 3) Validate + sanitize the input.
    const parsed = validateAiRespondInput(request.data)
    if (!parsed.ok) {
      throw new HttpsError('invalid-argument', parsed.error)
    }
    const { instructions, input, jsonSchema, temperature, maxOutputTokens } = parsed.value

    // 4) Token-cap + temperature clamp, then call the model.
    try {
      const result = await callModel({
        instructions,
        input,
        jsonSchema,
        temperature: clampTemperature(temperature),
        maxOutputTokens: clampMaxOutputTokens(maxOutputTokens),
      })
      return { text: result.text }
    } catch (err) {
      console.error('aiRespond callModel failed', err)
      throw new HttpsError('internal', 'The model request failed. Please try again.')
    }
  },
)

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
