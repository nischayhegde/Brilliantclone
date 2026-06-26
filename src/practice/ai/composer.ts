import type { ScenarioSpec } from '../types'
import type { ComposeRequest } from './types'
import { defaultLayoutFor } from '../genui/defaultLayout'
import { scenariosFor } from '../scenarioRegistry'

/** The server callable response (mirrors functions `composeScenario`). */
export type ComposeApiResponse = { spec: ScenarioSpec } | { fallback: true }

/** Injectable compose transport — `getComposeFn()` (the httpsCallable wrapper) or a test fake. */
export type ComposeTransport = (req: ComposeRequest) => Promise<ComposeApiResponse>

export interface ComposeResult {
  spec: ScenarioSpec
  source: 'llm' | 'curated'
  attempts: number
}

/** Every served spec must carry a layout so WidgetHost can render it offline. */
function ensureLayout(spec: ScenarioSpec): ScenarioSpec {
  return spec.layout ? spec : { ...spec, layout: defaultLayoutFor(spec.track) }
}

/**
 * Compose a validated LAYOUT scenario via the SERVER `composeScenario` callable (which builds
 * the prompt + JSON schema and validates the model output server-side), falling back to a
 * curated layout spec when the model is unavailable, signals a fallback, or the call fails.
 *
 * The retry/validation now lives server-side; the client trusts the returned spec (already
 * validated against the catalog allow-list + numeric lint) and only guarantees a layout.
 */
export async function composeScenario(
  req: ComposeRequest,
  transport: ComposeTransport | null,
): Promise<ComposeResult> {
  if (transport) {
    try {
      const res = await transport(req)
      if ('spec' in res && res.spec) return { spec: ensureLayout(res.spec), source: 'llm', attempts: 1 }
    } catch {
      // fall through to the curated fallback
    }
  }
  return { spec: ensureLayout(pickCurated(req)), source: 'curated', attempts: 1 }
}

function pickCurated(req: ComposeRequest): ScenarioSpec {
  const atTier = scenariosFor(req.track, req.tier)
  const pool = atTier.length ? atTier : scenariosFor(req.track)
  if (!pool.length) throw new Error(`No curated fallback for track ${req.track}`)
  return pool[Math.floor(Math.random() * pool.length)]
}
