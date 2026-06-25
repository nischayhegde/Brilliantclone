import type { ScenarioSpec } from '../types'
import type { DataCatalog } from './types'
import { validateSpec } from '../validator'
import { CANDLES } from '../../data/candles'

/** Price-like number in prose, e.g. "$182.50", "182.5", "200" near $ — LLM briefs must avoid these. */
const NUMERIC_CLAIM = /\$\s?\d[\d,]*(\.\d+)?|\b\d{2,}(\.\d+)?\b/

export interface ComposedResult {
  ok: boolean
  spec?: ScenarioSpec
  errors: string[]
}

export function validateComposed(raw: unknown, catalog: DataCatalog): ComposedResult {
  const errors: string[] = []
  const spec = raw as ScenarioSpec
  if (!spec || typeof spec !== 'object') return { ok: false, errors: ['composed value is not an object'] }

  // Allow-list: the model may reference ONLY catalog members.
  const dr = spec.dataRef ?? {}
  if (dr.candlesKey && !catalog.candlesKeys.includes(dr.candlesKey)) errors.push(`candlesKey "${dr.candlesKey}" not in catalog`)
  if (dr.ohlcAsset && !catalog.ohlcAssets.includes(dr.ohlcAsset)) errors.push(`ohlcAsset "${dr.ohlcAsset}" not in catalog`)
  if (dr.chainAsset && !catalog.chainAssets.includes(dr.chainAsset)) errors.push(`chainAsset "${dr.chainAsset}" not in catalog`)
  if (spec.rubricId && !catalog.rubricIds.includes(spec.rubricId)) errors.push(`rubricId "${spec.rubricId}" not in catalog`)

  // Numeric-claim lint (LLM source only): no invented price numbers in prose.
  if (spec.source === 'llm') {
    if (NUMERIC_CLAIM.test(spec.brief ?? '')) errors.push('brief contains a numeric claim (LLM may not invent numbers)')
    if (NUMERIC_CLAIM.test(spec.title ?? '')) errors.push('title contains a numeric claim')
  }

  // Base deterministic validator with catalog-aware resolvers.
  const base = validateSpec(spec, {
    resolveCandles: (k) => CANDLES[k],
    assetExists: (p) => catalog.ohlcAssets.includes(p) || catalog.chainAssets.includes(p),
  })
  errors.push(...base.errors)

  return errors.length ? { ok: false, errors } : { ok: true, spec, errors: [] }
}
