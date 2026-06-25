import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { initializeApp, getApps } from 'firebase/app'
import type { ModelClient } from '../practice/ai/types'

/**
 * Firebase AI Logic (Gemini) ModelClient. Uses the Firebase backend + App Check — no
 * provider key in the client bundle. Returns null if AI Logic is not enabled, so the
 * app runs curated-only (instant + free) with zero errors.
 *
 * For a HARD server boundary instead, implement ModelClient.generate to call a
 * Cloud Functions callable (httpsCallable) that runs the model + validateSpec
 * server-side and returns the result. The orchestration (composer/coach) is identical.
 */
let cached: ModelClient | null | undefined

export function getModelClient(): ModelClient | null {
  if (cached !== undefined) return cached
  try {
    const app = getApps()[0] ?? initializeApp({}) // reuse the app from src/lib/firebase
    const ai = getAI(app, { backend: new GoogleAIBackend() })
    const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' })
    cached = {
      async generate(prompt, opts) {
        const res = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: opts?.temperature ?? 0.7, maxOutputTokens: opts?.maxTokens ?? 700 },
        })
        return res.response.text()
      },
    }
  } catch (e) {
    console.warn('Firebase AI Logic unavailable — Practice runs curated-only.', e)
    cached = null
  }
  return cached
}
