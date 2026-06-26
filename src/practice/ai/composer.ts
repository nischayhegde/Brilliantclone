import type { ScenarioSpec } from '../types'
import type { ComposeRequest } from './types'
import { defaultLayoutFor } from '../genui/defaultLayout'
import { layoutFitsTrack, validateLayout } from '../genui/schema'
import { proceduralSpec, scenariosFor } from '../scenarioRegistry'

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
 * Defense-in-depth (Invariant 1: BOTH client and server validate). Re-validate the
 * server's LLM layout against the catalog allow-list + per-track widget fitness — the
 * SAME isomorphic checks the server used to assemble it — before we trust + render it.
 * An out-of-registry `kind` would otherwise throw downstream in `decision.ts`/`WidgetHost`.
 */
function layoutTrustworthy(spec: ScenarioSpec, catalog: ComposeRequest['catalog']): boolean {
  const layout = spec.layout
  if (!layout) return true
  if (!validateLayout(layout, catalog).ok) return false
  return layoutFitsTrack(layout, catalog.track).length === 0
}

/**
 * Compose a validated LAYOUT scenario via the SERVER `composeScenario` callable (which builds
 * the prompt + JSON schema and validates the model output server-side), falling back to a
 * curated layout spec when the model is unavailable, signals a fallback, or the call fails.
 *
 * The retry/validation lives server-side, but the client re-validates the returned layout
 * (Invariant 1) and only trusts it when it still passes the catalog allow-list + track
 * fitness; any failure falls back to the curated layout spec, exactly like the error path.
 */
export async function composeScenario(
  req: ComposeRequest,
  transport: ComposeTransport | null,
): Promise<ComposeResult> {
  if (transport) {
    try {
      const res = await transport(req)
      if ('spec' in res && res.spec) {
        const spec = ensureLayout(res.spec)
        if (layoutTrustworthy(spec, req.catalog)) return { spec, source: 'llm', attempts: 1 }
      }
    } catch {
      // fall through to the curated fallback
    }
  }
  return { spec: ensureLayout(pickCurated(req)), source: 'curated', attempts: 1 }
}

/**
 * The non-LLM scenario source. Charts + market-making are PROCEDURAL (random real instrument ×
 * random window × tier) so the learner gets near-infinite variety even with the model cold or
 * disabled. Options draws from the curated chain-snapshot pool (no procedural windowing there).
 */
function pickCurated(req: ComposeRequest): ScenarioSpec {
  if (req.track === 'charts' || req.track === 'market-making') return proceduralSpec(req.track, req.tier)
  const atTier = scenariosFor(req.track, req.tier)
  const pool = atTier.length ? atTier : scenariosFor(req.track)
  if (!pool.length) throw new Error(`No curated fallback for track ${req.track}`)
  return pool[Math.floor(Math.random() * pool.length)]
}
