import { auth } from '../lib/firebase'
import type { ComposeRequest } from '../practice/ai/types'
import type { ProcessScore, ScenarioSpec } from '../practice/types'
import type { GradeRequest } from '../practice/genui/gradePrompt'

/**
 * Dedicated transports for the composer/grader. They POST to the Render LLM endpoint
 * (`VITE_LLM_API_URL`), which builds the prompt + JSON schema SERVER-SIDE and validates/guards
 * the model output there — so the client never sees the prompt or the raw output, and the
 * OpenAI key stays a server env var (never in the client bundle).
 *
 * Every call carries the caller's Firebase ID token (`Authorization: Bearer …`); the server
 * verifies it and rate-limits per uid. When `VITE_LLM_API_URL` is unset both factories return
 * null (→ curated/deterministic-only); per-call failures reject and are caught by the
 * composer/grader pipelines, which fall back for that call.
 */

/** `POST /api/compose {track,tier,accountBalance,catalog}` → `{spec} | {fallback:true}`. */
export type ComposeApiResponse = { spec: ScenarioSpec } | { fallback: true }
export type ComposeFn = (req: ComposeRequest) => Promise<ComposeApiResponse>

/** `POST /api/grade {...}` → `{score,feedback} | {fallback:true}`. */
export type GradeApiResponse = { score: ProcessScore; feedback: string } | { fallback: true }
export type GradeFn = (req: GradeRequest) => Promise<GradeApiResponse>

/** Base URL of the Render LLM service (no trailing slash); unset → AI disabled. */
const API_BASE = (import.meta.env.VITE_LLM_API_URL ?? '').replace(/\/$/, '')

/** POST `body` to `path` with the current user's Firebase ID token; throws on non-2xx. */
async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const token = await user.getIdToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`LLM endpoint ${path} failed: ${res.status}`)
  return (await res.json()) as T
}

let cachedCompose: ComposeFn | null | undefined
let cachedGrade: GradeFn | null | undefined

export function getComposeFn(): ComposeFn | null {
  if (cachedCompose !== undefined) return cachedCompose
  if (!API_BASE) {
    console.warn('VITE_LLM_API_URL unset — Practice composes curated-only.')
    cachedCompose = null
    return cachedCompose
  }
  cachedCompose = (req) => authedPost<ComposeApiResponse>('/api/compose', req)
  return cachedCompose
}

export function getGradeFn(): GradeFn | null {
  if (cachedGrade !== undefined) return cachedGrade
  if (!API_BASE) {
    console.warn('VITE_LLM_API_URL unset — Practice grades deterministically.')
    cachedGrade = null
    return cachedGrade
  }
  cachedGrade = (req) => authedPost<GradeApiResponse>('/api/grade', req)
  return cachedGrade
}
