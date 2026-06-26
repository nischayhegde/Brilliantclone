import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { ComposeRequest } from '../practice/ai/types'
import type { ProcessScore, ScenarioSpec } from '../practice/types'
import type { GradeRequest } from '../practice/genui/gradePrompt'

/**
 * Dedicated callable transports for the composer/grader. `composeScenario`/`gradeRun` build
 * the prompt + JSON schema SERVER-SIDE and validate/guard the model output there, so the
 * client never sees the prompt or the raw output — and the OpenAI key stays a Functions
 * secret (never in the client bundle). Both return null when the callable can't be wired
 * (→ curated/deterministic-only); per-call failures reject and are caught by the
 * composer/grader pipelines, which fall back for that call.
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
