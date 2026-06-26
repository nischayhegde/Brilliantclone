import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { ModelClient, ComposeRequest } from '../practice/ai/types'
import type { ProcessScore, ScenarioSpec } from '../practice/types'
import type { GradeRequest } from '../practice/genui/gradePrompt'

/**
 * Callable-backed ModelClient — the SECURE server boundary for the composer/coach.
 *
 * `generate()` invokes the `aiRespond` Cloud Function (httpsCallable), which holds the
 * OpenAI key as a Functions secret and runs GPT-5.5 server-side behind auth + rate
 * limits + a token cap. NO provider key is ever in the client bundle.
 *
 * `getModelClient()` returns null gracefully when the Functions client can't be wired
 * (misconfig / SDK unavailable), so Practice runs curated-only with zero errors. Per-call
 * failures (offline, signed-out, rate-limited, model error) reject from `generate()` and
 * are caught by the composer/coach, which then fall back to curated content for that call.
 *
 * The ModelClient interface is unchanged, so the existing composer/coach pipelines keep
 * working — only the transport changed (Firebase AI Logic/Gemini → Functions/GPT-5.5).
 */

/** Request shape of the `aiRespond` callable (must match functions/src/index.ts). */
interface AiRespondRequest {
  instructions?: string
  input: string
  temperature?: number
  maxOutputTokens?: number
}
interface AiRespondResponse {
  text: string
}

let cached: ModelClient | null | undefined

export function getModelClient(): ModelClient | null {
  if (cached !== undefined) return cached
  try {
    const callable = httpsCallable<AiRespondRequest, AiRespondResponse>(functions, 'aiRespond')
    cached = {
      async generate(prompt, opts) {
        const res = await callable({
          input: prompt,
          temperature: opts?.temperature,
          maxOutputTokens: opts?.maxTokens,
        })
        return res.data.text
      },
    }
  } catch (e) {
    console.warn('Cloud Functions unavailable — Practice runs curated-only.', e)
    cached = null
  }
  return cached
}

/**
 * Dedicated WS-D callable transports. Unlike `aiRespond` (a generic text transport that
 * still builds prompts client-side), `composeScenario`/`gradeRun` build the prompt + JSON
 * schema SERVER-SIDE and validate/guard the model output there, so the client never sees the
 * prompt or the raw output — and the OpenAI key stays a Functions secret. Both return null
 * when the callable can't be wired (→ curated/deterministic-only); per-call failures reject
 * and are caught by the composer/grader pipelines, which fall back for that call.
 */

/** `composeScenario({track,tier,accountBalance,catalog}) → {spec} | {fallback:true}`. */
export type ComposeApiResponse = { spec: ScenarioSpec } | { fallback: true }
export type ComposeFn = (req: ComposeRequest) => Promise<ComposeApiResponse>

/** `gradeRun({...}) → {score,feedback} | {fallback:true}`. */
export type GradeApiResponse = { score: ProcessScore; feedback: string } | { fallback: true }
export type GradeFn = (req: GradeRequest) => Promise<GradeApiResponse>

let cachedCompose: ComposeFn | null | undefined
let cachedGrade: GradeFn | null | undefined

export function getComposeFn(): ComposeFn | null {
  if (cachedCompose !== undefined) return cachedCompose
  try {
    const callable = httpsCallable<ComposeRequest, ComposeApiResponse>(functions, 'composeScenario')
    cachedCompose = async (req) => (await callable(req)).data
  } catch (e) {
    console.warn('composeScenario callable unavailable — Practice composes curated-only.', e)
    cachedCompose = null
  }
  return cachedCompose
}

export function getGradeFn(): GradeFn | null {
  if (cachedGrade !== undefined) return cachedGrade
  try {
    const callable = httpsCallable<GradeRequest, GradeApiResponse>(functions, 'gradeRun')
    cachedGrade = async (req) => (await callable(req)).data
  } catch (e) {
    console.warn('gradeRun callable unavailable — Practice grades deterministically.', e)
    cachedGrade = null
  }
  return cachedGrade
}
