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
} from './guards'

// Re-exported so WS-D and tests can reach the proven isomorphic genui import path.
export { sanityValidateLayout } from './genui'

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
