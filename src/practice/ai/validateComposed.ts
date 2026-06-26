import type { ScenarioSpec } from '../types'
import type { DataCatalog } from './types'
import { hasNumericClaim, validateSpec } from '../validator'
import { layoutFitsTrack, validateLayout } from '../genui/schema'
import { serverConstraints } from '../genui/composePrompt'
import { CANDLES } from '../../data/candles'

/** Fallback paper balance used to size grading constraints when none is supplied. */
const DEFAULT_ACCOUNT_BALANCE = 10000

export interface ComposedResult {
  ok: boolean
  spec?: ScenarioSpec
  errors: string[]
}

// `serverConstraints` (the single source of truth for grading limits) lives in the
// isomorphic `genui/composePrompt` so the server composer and this client-side defensive
// validator agree exactly.
export { serverConstraints }

export function validateComposed(
  raw: unknown,
  catalog: DataCatalog,
  opts: { accountBalance?: number } = {},
): ComposedResult {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['composed value is not an object'] }

  // Normalize: `source` (provenance) and `constraints` (grading limits) are set BY US, not
  // by the model. We strip any model-supplied provenance — composed specs are ALWAYS 'llm',
  // so the numeric-claim lint can never be bypassed by self-declaring 'curated' (I1) — and we
  // overwrite grading constraints with server-owned ones (I3).
  const spec: ScenarioSpec = {
    ...(raw as ScenarioSpec),
    source: 'llm',
    constraints: serverConstraints(catalog.track, opts.accountBalance ?? DEFAULT_ACCOUNT_BALANCE),
  }

  // Allow-list: the model may reference ONLY catalog members.
  const dr = spec.dataRef ?? {}
  if (dr.candlesKey && !catalog.candlesKeys.includes(dr.candlesKey)) errors.push(`candlesKey "${dr.candlesKey}" not in catalog`)
  if (dr.ohlcAsset && !catalog.ohlcAssets.includes(dr.ohlcAsset)) errors.push(`ohlcAsset "${dr.ohlcAsset}" not in catalog`)
  if (dr.chainAsset && !catalog.chainAssets.includes(dr.chainAsset)) errors.push(`chainAsset "${dr.chainAsset}" not in catalog`)
  if (spec.rubricId && !catalog.rubricIds.includes(spec.rubricId)) errors.push(`rubricId "${spec.rubricId}" not in catalog`)

  // Numeric-claim lint: composed specs are LLM output (source forced above), so this ALWAYS
  // runs — no invented price numbers in prose.
  if (hasNumericClaim(spec.brief ?? '')) errors.push('brief contains a numeric claim (LLM may not invent numbers)')
  if (hasNumericClaim(spec.title ?? '')) errors.push('title contains a numeric claim')

  // Generative-UI layout: validate against the FULL catalog allow-list (model output),
  // plus per-track widget fitness. Backward compatible — composed specs without a layout
  // are still accepted (a curated default layout is applied at render time).
  if (spec.layout !== undefined) {
    const lv = validateLayout(spec.layout, catalog)
    if (!lv.ok) errors.push(...lv.errors)
    errors.push(...layoutFitsTrack(spec.layout, catalog.track))
  }

  // Base deterministic validator with catalog-aware resolvers. The layout is already
  // validated above against the FULL catalog, so we strip it here to avoid re-validating
  // it against validateSpec's narrower (spec-dataRef-only) layout catalog.
  const base = validateSpec({ ...spec, layout: undefined }, {
    resolveCandles: (k) => CANDLES[k],
    assetExists: (p) => catalog.ohlcAssets.includes(p) || catalog.chainAssets.includes(p),
  })
  errors.push(...base.errors)

  return errors.length ? { ok: false, errors } : { ok: true, spec, errors: [] }
}
