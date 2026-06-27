/**
 * Isomorphic COMPOSE builders — the single source of truth both the Vite client and the
 * Cloud Functions runtime use to make GPT-5.5 author a validated interactive scenario.
 *
 * PURE / ISOMORPHIC: imports only sibling genui modules + the shared `../types`. NO
 * React/DOM/Phaser/firebase, so `functions/scripts/copy-shared.mjs` mirrors it verbatim
 * and the server composes + validates with the SAME code the client renders against.
 *
 * The model emits LAYOUT + COPY + a real-data ref choice ONLY. Every traded number, the
 * grading constraints, the dataRef indices, and the provenance are SERVER-OWNED here —
 * see `assembleComposedSpec`, which rebuilds them and validates the layout against the
 * catalog allow-list + the numeric/disallowed-claim lints before a spec is trusted.
 */
import type { DataRef, RiskConstraints, ScenarioSpec, Track } from '../types'
import type { LayoutCatalog, ScenarioLayout, Widget, WidgetDataRef, WidgetKind } from './types'
import { WIDGET_REGISTRY, WIDGET_KINDS } from './registry'
import { layoutFitsTrack, validateLayout } from './schema'
import { hasDisallowedClaim, hasNumericClaim } from './copyLint'

/** Max real-data refs offered to the model per call (bounds prompt size, diversifies content). */
export const SAMPLE_REFS = 40

/** The real-data allow-list + the rubric/nudge id allow-lists the composer may reference. */
export interface ComposeCatalog extends LayoutCatalog {
  rubricIds: string[]
  nudgeIds: string[]
}

export interface ComposeRequest {
  track: Track
  tier: number
  accountBalance: number
  catalog: ComposeCatalog
}

/** Pick up to n refs using a partial Fisher–Yates with an injectable rng (default Math.random). */
export function sampleRefs(refs: string[], n: number, rng: () => number = Math.random): string[] {
  if (refs.length <= n) return refs.slice()
  const pool = refs.slice()
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
    out.push(pool[i])
  }
  return out
}

/** Widget kinds valid for a track (registry-driven), so the prompt only offers usable kinds. */
export function widgetKindsForTrack(track: Track): WidgetKind[] {
  return WIDGET_KINDS.filter((k) => WIDGET_REGISTRY[k].tracks.includes(track))
}

/** The default rubric for a track (server-owned; the model's choice is validated against the catalog). */
export function defaultRubricId(track: Track): string {
  return track === 'options' ? 'options-v1' : track === 'market-making' ? 'market-making-v1' : 'charts-v1'
}

/** Track-appropriate default nudges, used when the model picks none that are in the catalog. */
export function defaultNudgeIds(track: Track): string[] {
  if (track === 'options') return ['undefined-risk', 'sizing']
  if (track === 'market-making') return ['spread-too-tight', 'inventory-runaway']
  return ['sizing', 'no-stop']
}

/**
 * The system/developer message: hard integrity rules that hold for EVERY compose call.
 * Stable (no per-request data) so it can be cached as `instructions`.
 */
export function buildComposeInstructions(): string {
  return [
    'You are a curriculum designer who composes a single trading-practice SCENARIO as an interactive LAYOUT of validated widgets. You are NOT a forecaster or an advisor.',
    'Your audience is BEGINNERS — assume the learner is brand new to trading and easily overwhelmed.',
    'HARD RULES — you NEVER break these:',
    '- NEVER predict a price, recommend a trade, or give financial advice.',
    '- NEVER invent any market number (price, premium, Greek, P&L, percentage). You only REFERENCE real data by key; the app loads the real numbers.',
    '- All copy (title, brief, narrative, widget labels/prompts) is teaching prose ONLY — a setup plus an objective, with NO specific numbers.',
    '- Compose ONLY from the allowed widget kinds for the track; give every widget a unique id and a valid config.',
    '- Teach the WHY. Defer every traded number to the real data the app resolves.',
    'STYLE — write for a new trader:',
    '- Use plain, warm, encouraging language and short sentences. Avoid jargon; if a term is truly needed, explain it in a few plain words.',
    '- Keep it SIMPLE. Favour the FEWEST widgets that still let the learner make a complete decision — clarity beats cleverness.',
    '- Scale complexity to the tier: low tiers get a minimal layout (the chart plus the core decision, maybe one short framing note); add extra context, choices, or checklists only at higher tiers. When unsure, choose fewer widgets and plainer wording.',
    'Return STRICT JSON matching the provided schema — no markdown, no commentary.',
  ].join('\n')
}

/**
 * The per-request user message: the track/tier/account, a fresh bounded sample of real-data
 * refs to choose from, the allowed widget kinds, and the rubric/nudge id allow-lists.
 */
export function buildComposeInput(req: ComposeRequest, opts: { rng?: () => number } = {}): string {
  const { track, tier, accountBalance, catalog } = req
  const all = track === 'options' ? catalog.chainAssets : [...catalog.candlesKeys, ...catalog.ohlcAssets]
  const refs = sampleRefs(all, SAMPLE_REFS, opts.rng)
  const kinds = widgetKindsForTrack(track)
  // Lower tiers are where new traders live — explicitly ask for a gentle, minimal scene.
  const complexityNote =
    tier <= 2
      ? 'This learner is NEW. Keep the layout minimal and welcoming: the real chart, the core decision widgets, and at most one short framing or context widget. Use plain, encouraging language and explain any term you use.'
      : 'Scale the layout to the tier, but keep the language plain and every decision clear; never pile on widgets for their own sake.'
  return [
    `Compose for track "${track}", tier ${tier}, account balance $${accountBalance}.`,
    'Choose ONE real-data ref that best fits the lesson you design (the app loads it; you never see its numbers):',
    refs.map((r) => `  - ${r}`).join('\n'),
    `Allowed widget kinds for this track: ${kinds.join(', ')}.`,
    'Build a coherent layout: framing/context widgets, the real chart, and the interactive widgets the track needs to express a complete decision. Vary the structure so scenarios stay fresh.',
    complexityNote,
    `Pick a rubricId from: ${catalog.rubricIds.join(', ')}.`,
    `Pick nudge ids (zero or more) from: ${catalog.nudgeIds.join(', ')}.`,
    'Output JSON with: title, brief, narrative (scenario framing), dataRef (your chosen ref), layout (the widgets), rubricId, nudgeIds.',
  ].join('\n')
}

/** JSON-schema name for the compose structured-output request. */
export const COMPOSE_SCHEMA_NAME = 'ComposedScenario'

/**
 * The structured-output JSON schema for a composed scenario. Deliberately LOOSE on
 * `config` (`strict:false`) — encoding the 14-kind discriminated union as a strict schema
 * is brittle, and `validateLayout` (the real guardrail) re-checks every config server-side.
 */
export function composeJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      brief: { type: 'string' },
      narrative: { type: 'string' },
      dataRef: {
        type: 'object',
        properties: {
          candlesKey: { type: 'string' },
          ohlcAsset: { type: 'string' },
          chainAsset: { type: 'string' },
        },
      },
      rubricId: { type: 'string' },
      nudgeIds: { type: 'array', items: { type: 'string' } },
      layout: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kind: { type: 'string' },
            config: { type: 'object' },
          },
          required: ['id', 'kind', 'config'],
        },
      },
    },
    required: ['title', 'brief', 'layout'],
  }
}

/** The normalized model draft (everything server-owned is rebuilt in `assembleComposedSpec`). */
export interface ComposedDraft {
  title: string
  brief: string
  narrative?: string
  dataRef?: WidgetDataRef
  layout: ScenarioLayout
  rubricId?: string
  nudgeIds?: string[]
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Normalize raw model output (already-parsed JSON or a JSON string) into a `ComposedDraft`.
 * Throws on the structural essentials (object, string title/brief, array layout); softer
 * fields default to undefined and are validated/rebuilt downstream.
 */
export function parseComposedLayout(json: unknown): ComposedDraft {
  const raw: unknown = typeof json === 'string' ? JSON.parse(json) : json
  if (!isObject(raw)) throw new Error('composed value is not an object')
  if (typeof raw.title !== 'string') throw new Error('composed.title must be a string')
  if (typeof raw.brief !== 'string') throw new Error('composed.brief must be a string')
  if (!Array.isArray(raw.layout)) throw new Error('composed.layout must be an array')

  const draft: ComposedDraft = {
    title: raw.title,
    brief: raw.brief,
    layout: raw.layout as ScenarioLayout,
  }
  if (typeof raw.narrative === 'string') draft.narrative = raw.narrative
  if (isObject(raw.dataRef)) draft.dataRef = raw.dataRef as WidgetDataRef
  if (typeof raw.rubricId === 'string') draft.rubricId = raw.rubricId
  if (Array.isArray(raw.nudgeIds)) draft.nudgeIds = raw.nudgeIds.filter((n): n is string => typeof n === 'string')
  return draft
}

/**
 * Grading constraints are OWNED BY US, never read from model output. Rebuilt from the
 * (trusted) track + real account balance so the model cannot widen risk limits, lower the
 * reward:risk bar, or otherwise game the deterministic grader through free-form fields.
 */
export function serverConstraints(track: Track, accountBalance: number): RiskConstraints {
  if (track === 'options') return { accountBalance, maxRiskPct: 5, requireDefinedRisk: true }
  // charts + market-making trade an underlying: expect a defined stop and an R:R floor.
  // The floor is gentle (reward need only modestly beat risk) so new traders aren't failed
  // on the ratio when their entry/stop/target are otherwise coherent.
  return { accountBalance, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.2 }
}

/** Derive the snapshot date from a chain asset path, e.g. `data/options/AAPL__2021-02-17.json`. */
export function decisionDateFromAsset(chainAsset: string): string | undefined {
  return /__(\d{4}-\d{2}-\d{2})\.json$/.exec(chainAsset)?.[1]
}

/** True when a widget dataRef points only at members of the catalog allow-list. */
function refInCatalog(ref: WidgetDataRef, catalog: LayoutCatalog): boolean {
  if (ref.candlesKey != null && !catalog.candlesKeys.includes(ref.candlesKey)) return false
  if (ref.ohlcAsset != null && !catalog.ohlcAssets.includes(ref.ohlcAsset)) return false
  if (ref.chainAsset != null && !catalog.chainAssets.includes(ref.chainAsset)) return false
  return ref.candlesKey != null || ref.ohlcAsset != null || ref.chainAsset != null
}

/**
 * Build a real `DataRef` SERVER-SIDE from the catalog allow-list. Charts/market-making
 * reference a bundled candle key (or an OHLC asset) and let the resolver default the
 * split/reveal window; options reference a chain asset with its date derived from the path.
 */
export function pickDataRef(track: Track, catalog: LayoutCatalog, rng: () => number = Math.random): DataRef {
  const pick = <T,>(arr: T[]): T | undefined => (arr.length ? arr[Math.floor(rng() * arr.length)] : undefined)
  if (track === 'options') {
    const chainAsset = pick(catalog.chainAssets)
    if (!chainAsset) throw new Error('options catalog has no chain assets')
    return { chainAsset, decisionDate: decisionDateFromAsset(chainAsset) }
  }
  const candlesKey = pick(catalog.candlesKeys)
  if (candlesKey) return { candlesKey }
  const ohlcAsset = pick(catalog.ohlcAssets)
  if (!ohlcAsset) throw new Error(`${track} catalog has no candle keys or OHLC assets`)
  return { ohlcAsset }
}

/**
 * Resolve the canonical dataRef: honour the model's choice when it is fully inside the
 * catalog allow-list, otherwise pick one server-side. For options the decisionDate is ALWAYS
 * derived from the chain asset path (never trusted from the model).
 */
function resolveDataRef(track: Track, draft: ComposedDraft, catalog: LayoutCatalog, rng: () => number): DataRef {
  if (draft.dataRef && refInCatalog(draft.dataRef, catalog)) {
    if (track === 'options' && draft.dataRef.chainAsset) {
      return { chainAsset: draft.dataRef.chainAsset, decisionDate: decisionDateFromAsset(draft.dataRef.chainAsset) }
    }
    const { candlesKey, ohlcAsset } = draft.dataRef
    if (track !== 'options' && (candlesKey || ohlcAsset)) return candlesKey ? { candlesKey } : { ohlcAsset }
  }
  return pickDataRef(track, catalog, rng)
}

export interface AssembleResult {
  ok: boolean
  spec?: ScenarioSpec
  errors: string[]
}

/**
 * Rebuild a trusted `ScenarioSpec` from the model draft + server-owned fields and validate it.
 *
 * Server-owned (never from the model): id, source ('llm'), constraints, objective,
 * coachContextKeys, the dataRef (built/validated), and the rubric/nudge fallbacks. Model-owned
 * (validated): title, brief, narrative, layout, and the rubric/nudge CHOICES (kept only if in
 * the catalog). The layout is validated against the FULL catalog allow-list + per-track fitness,
 * and title/brief are run through the numeric + disallowed-claim lints.
 */
export function assembleComposedSpec(
  req: ComposeRequest,
  draft: ComposedDraft,
  opts: { rng?: () => number; id?: string } = {},
): AssembleResult {
  const { track, tier, accountBalance, catalog } = req
  const rng = opts.rng ?? Math.random
  const errors: string[] = []

  // Copy lints — the model may never invent a number or make a forbidden claim.
  if (hasNumericClaim(draft.title)) errors.push('title contains a numeric claim (LLM may not invent numbers)')
  if (hasDisallowedClaim(draft.title)) errors.push('title contains a disallowed claim')
  if (hasNumericClaim(draft.brief)) errors.push('brief contains a numeric claim (LLM may not invent numbers)')
  if (hasDisallowedClaim(draft.brief)) errors.push('brief contains a disallowed claim')
  if (draft.narrative != null) {
    if (hasNumericClaim(draft.narrative)) errors.push('narrative contains a numeric claim')
    if (hasDisallowedClaim(draft.narrative)) errors.push('narrative contains a disallowed claim')
  }

  // Layout: validate against the FULL catalog allow-list + per-track widget fitness.
  const lv = validateLayout(draft.layout, catalog)
  if (!lv.ok) errors.push(...lv.errors)
  errors.push(...layoutFitsTrack(draft.layout, track))

  if (errors.length) return { ok: false, errors }

  // Optional narrative → a leading narrative widget when the layout has none.
  let layout = draft.layout
  if (draft.narrative && !layout.some((w: Widget) => w.kind === 'narrative')) {
    layout = [{ id: 'narrative', kind: 'narrative', config: { body: draft.narrative } }, ...layout]
  }

  const rubricId = draft.rubricId && catalog.rubricIds.includes(draft.rubricId) ? draft.rubricId : defaultRubricId(track)
  const chosenNudges = (draft.nudgeIds ?? []).filter((id) => catalog.nudgeIds.includes(id))
  const nudgeIds = chosenNudges.length ? chosenNudges : defaultNudgeIds(track).filter((id) => catalog.nudgeIds.includes(id))

  const spec: ScenarioSpec = {
    id: opts.id ?? `llm-${track}-${Math.floor(rng() * 1e9).toString(36)}`,
    track,
    tier,
    title: draft.title,
    brief: draft.brief,
    dataRef: resolveDataRef(track, draft, catalog, rng),
    objective: { kind: 'process', passScore: 60 },
    constraints: serverConstraints(track, accountBalance),
    rubricId,
    nudges: nudgeIds.map((id) => ({ id })),
    coachContextKeys: ['outcome'],
    source: 'llm',
    layout,
  }
  return { ok: true, spec, errors: [] }
}
