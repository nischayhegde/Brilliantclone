import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { ModelClient } from '../practice/ai/types'

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
