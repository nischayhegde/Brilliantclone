/**
 * Proof that the Cloud Functions toolchain can import + run the PURE / ISOMORPHIC
 * genui core (the WS-A backbone). This unblocks WS-D, which will build server-side
 * `composeScenario`/`gradeRun` callables that compose a layout with GPT-5.5 and then
 * validate it here with the SAME `validateLayout` the client uses (no schema drift).
 *
 * The core is mirrored into `src/shared/**` by `scripts/copy-shared.mjs` on prebuild.
 */
import { validateLayout, layoutFitsTrack } from './shared/practice/genui/schema'
import type { LayoutCatalog } from './shared/practice/genui/types'
import type { ProcessScore, ScenarioSpec, Track } from './shared/practice/types'
import {
  assembleComposedSpec,
  buildComposeInput,
  buildComposeInstructions,
  composeJsonSchema,
  COMPOSE_SCHEMA_NAME,
  parseComposedLayout,
  type ComposeRequest,
} from './shared/practice/genui/composePrompt'
import {
  buildGradeInput,
  buildGradeInstructions,
  gradeAllowedNumbers,
  gradeJsonSchema,
  GRADE_SCHEMA_NAME,
  type GradeRequest,
} from './shared/practice/genui/gradePrompt'
import { applyGradeGuard } from './shared/practice/genui/gradeGuard'

export interface LayoutSanity {
  ok: boolean
  errors: string[]
}

/**
 * Server-side sanity validation of an LLM/curated layout against the real-data
 * allow-list (and, when a track is given, widget/track fitness). Pure — delegates to
 * the shared isomorphic validators.
 */
export function sanityValidateLayout(
  layout: unknown,
  catalog: LayoutCatalog,
  track?: Track,
): LayoutSanity {
  const base = validateLayout(layout, catalog)
  const errors = [...base.errors]
  if (track) errors.push(...layoutFitsTrack(layout, track))
  return { ok: errors.length === 0, errors }
}

/**
 * The subset of `callModel` (./openai) the orchestrators need. Injected so unit tests run
 * fully offline against a mock — NO network, NO real model. NOTE: `temperature` is
 * deliberately NOT in this surface — GPT-5.5 is a reasoning model (uses `reasoning.effort`)
 * and WS-C flagged that temperature may be rejected, so the orchestrators never send it.
 */
export type CallModelFn = (params: {
  instructions?: string
  input: string
  jsonSchema?: { name: string; schema: Record<string, unknown>; strict?: boolean }
  maxOutputTokens?: number
}) => Promise<{ text: string; json?: unknown }>

export type { ComposeRequest } from './shared/practice/genui/composePrompt'
export type { GradeRequest } from './shared/practice/genui/gradePrompt'

export const COMPOSE_MAX_TOKENS = 3072
export const GRADE_MAX_TOKENS = 1024
export const COMPOSE_ATTEMPTS = 2

export type ComposeResponse = { spec: ScenarioSpec } | { fallback: true }

/**
 * Compose a validated scenario SERVER-SIDE: build the prompt + layout JSON schema from the
 * isomorphic builders, call GPT-5.5 (structured output), parse + ASSEMBLE the spec with
 * server-owned constraints/dataRef/source, validate the layout against the catalog allow-list,
 * retry once, else fall back. The client never sees the prompt or the raw model output.
 */
export async function runCompose(
  req: ComposeRequest,
  callModel: CallModelFn,
  opts: { rng?: () => number; attempts?: number } = {},
): Promise<ComposeResponse> {
  const instructions = buildComposeInstructions()
  const jsonSchema = { name: COMPOSE_SCHEMA_NAME, schema: composeJsonSchema(), strict: false }
  const attempts = opts.attempts ?? COMPOSE_ATTEMPTS

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const input = buildComposeInput(req, { rng: opts.rng })
      const res = await callModel({ instructions, input, jsonSchema, maxOutputTokens: COMPOSE_MAX_TOKENS })
      const draft = parseComposedLayout(res.json ?? res.text)
      const assembled = assembleComposedSpec(req, draft, { rng: opts.rng })
      if (assembled.ok && assembled.spec) return { spec: assembled.spec }
    } catch {
      // fall through to the next attempt / fallback
    }
  }
  return { fallback: true }
}

export type GradeResponse = { score: ProcessScore; feedback: string } | { fallback: true }

/**
 * Grade a run SERVER-SIDE: build the process-not-P&L prompt + grade JSON schema, call GPT-5.5
 * (structured output), then clamp/drop/sanitize + enforce the process-not-P&L sanity bound via
 * `applyGradeGuard`. Returns the trusted score + feedback, or signals a deterministic fallback.
 */
export async function runGrade(req: GradeRequest, callModel: CallModelFn): Promise<GradeResponse> {
  const dimIds = req.rubricDims.map((d) => d.id)
  const instructions = buildGradeInstructions()
  const input = buildGradeInput(req)
  const jsonSchema = { name: GRADE_SCHEMA_NAME, schema: gradeJsonSchema(dimIds), strict: true }

  try {
    const res = await callModel({ instructions, input, jsonSchema, maxOutputTokens: GRADE_MAX_TOKENS })
    const guard = applyGradeGuard({
      raw: res.json ?? res.text,
      rubricDims: req.rubricDims,
      pnl: Number(req.outcomeFacts.pnl ?? 0),
      passScore: req.passScore,
      allowedNumbers: gradeAllowedNumbers(req),
    })
    if (guard.ok) return { score: guard.score, feedback: guard.feedback }
  } catch {
    // fall through to deterministic fallback
  }
  return { fallback: true }
}
