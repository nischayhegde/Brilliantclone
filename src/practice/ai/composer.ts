import type { ScenarioSpec } from '../types'
import type { ComposeRequest, ModelClient } from './types'
import { buildComposerPrompt, parseComposerJson } from './composerPrompt'
import { validateComposed } from './validateComposed'
import { scenariosFor } from '../scenarioRegistry'

export const MAX_COMPOSE_ATTEMPTS = 2

export interface ComposeResult {
  spec: ScenarioSpec
  source: 'llm' | 'curated'
  attempts: number
}

/** Compose a validated scenario; retry ≤ MAX, then fall back to a curated spec. */
export async function composeScenario(
  req: ComposeRequest,
  model: ModelClient,
  opts: { temperature?: number } = {},
): Promise<ComposeResult> {
  const prompt = buildComposerPrompt(req)
  for (let attempt = 1; attempt <= MAX_COMPOSE_ATTEMPTS; attempt++) {
    try {
      const reply = await model.generate(prompt, { temperature: opts.temperature ?? 0.8 })
      const raw = parseComposerJson(reply)
      const res = validateComposed(raw, req.catalog)
      if (res.ok && res.spec) return { spec: res.spec, source: 'llm', attempts: attempt }
    } catch {
      // fall through to next attempt / curated fallback
    }
  }
  const curated = pickCurated(req)
  return { spec: curated, source: 'curated', attempts: MAX_COMPOSE_ATTEMPTS }
}

function pickCurated(req: ComposeRequest): ScenarioSpec {
  const atTier = scenariosFor(req.track, req.tier)
  const pool = atTier.length ? atTier : scenariosFor(req.track)
  if (!pool.length) throw new Error(`No curated fallback for track ${req.track}`)
  return pool[Math.floor(Math.random() * pool.length)]
}
