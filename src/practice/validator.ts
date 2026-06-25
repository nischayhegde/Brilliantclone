import type { ScenarioSpec } from './types'
import { RUBRICS } from './rubrics'
import { NUDGES } from './nudges'
import { CANDLES } from '../data/candles'
import { validateLayout, layoutFitsTrack } from './genui/schema'
import type { LayoutCatalog } from './genui/types'

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/** Phrases an LLM brief must NOT contain — predictions, advice, guarantees. */
export const DISALLOWED_CLAIM_PATTERNS: RegExp[] = [
  /\bwill (?:definitely |certainly )?(?:go|rise|fall|drop|moon|crash)\b/i,
  /\bguarantee(?:d|s)?\b/i,
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\b(?:financial )?advice\b/i,
  /\bsure thing\b/i,
  /\bcan'?t lose\b/i,
  /\brisk[- ]free\b/i,
]

/**
 * Price-like number in prose, e.g. "$182.50", "182.5", a bare "200" — LLM/widget copy
 * must avoid inventing specific numbers (the model never produces a traded number).
 */
export const NUMERIC_CLAIM_PATTERN = /\$\s?\d[\d,]*(\.\d+)?|\b\d{2,}(\.\d+)?\b/

/** The single source of truth for the copy lints (reused by the genui schema). */
export function hasDisallowedClaim(text: string): boolean {
  return DISALLOWED_CLAIM_PATTERNS.some((re) => re.test(text))
}

export function hasNumericClaim(text: string): boolean {
  return NUMERIC_CLAIM_PATTERN.test(text)
}

const ASSET_RE = /^data\/(ohlc|options)\/[\w.-]+\.json$/

/**
 * The deterministic trust gate (PRDphase2 §8.2). A spec is rejected unless every
 * rule holds. `opts.resolveCandles`/`opts.assetExists` let M3 inject corpus-aware
 * resolvers; M0 defaults to bundled CANDLES + a string-shape check for assets.
 */
export function validateSpec(
  spec: ScenarioSpec,
  opts: { resolveCandles?: (key: string) => unknown[] | undefined; assetExists?: (path: string) => boolean } = {},
): ValidationResult {
  const errors: string[] = []
  const resolveCandles = opts.resolveCandles ?? ((k: string) => CANDLES[k])
  const assetExists = opts.assetExists ?? ((p: string) => ASSET_RE.test(p))

  // Rule 1: data refs resolve; indices in range.
  const { candlesKey, ohlcAsset, chainAsset, splitIndex, revealToIndex } = spec.dataRef
  let series: unknown[] | undefined
  if (candlesKey) {
    series = resolveCandles(candlesKey)
    if (!series) errors.push(`dataRef.candlesKey "${candlesKey}" does not resolve to real data`)
  }
  if (ohlcAsset && !assetExists(ohlcAsset)) errors.push(`dataRef.ohlcAsset "${ohlcAsset}" is not a known data/ asset`)
  if (chainAsset && !assetExists(chainAsset)) errors.push(`dataRef.chainAsset "${chainAsset}" is not a known data/ asset`)
  if (spec.track === 'charts' && !candlesKey && !ohlcAsset)
    errors.push('charts spec must reference candlesKey or ohlcAsset')

  if (series) {
    const n = series.length
    if (splitIndex !== undefined && (splitIndex < 1 || splitIndex >= n))
      errors.push(`dataRef.splitIndex ${splitIndex} out of range [1, ${n - 1}]`)
    if (revealToIndex !== undefined && (revealToIndex <= (splitIndex ?? 0) || revealToIndex > n))
      errors.push(`dataRef.revealToIndex ${revealToIndex} must be > splitIndex and <= ${n}`)
  }

  // Rule 3: objective achievable (process objective is always achievable; sanity-check bounds).
  if (spec.objective.kind !== 'process') errors.push('objective.kind must be "process" in v1')
  if (spec.objective.passScore < 0 || spec.objective.passScore > 100)
    errors.push('objective.passScore must be 0..100')

  // Rule 4: rubric + nudges + constraints well-formed.
  if (!RUBRICS[spec.rubricId]) errors.push(`unknown rubricId "${spec.rubricId}"`)
  for (const n of spec.nudges) if (!NUDGES[n.id]) errors.push(`unknown nudge id "${n.id}"`)
  if (spec.constraints.accountBalance <= 0) errors.push('constraints.accountBalance must be > 0')
  if (spec.constraints.maxRiskPct <= 0 || spec.constraints.maxRiskPct > 100)
    errors.push('constraints.maxRiskPct must be in (0, 100]')
  if (!Number.isInteger(spec.tier) || spec.tier < 1) errors.push('tier must be an integer >= 1')

  // Rule 5: brief makes no disallowed claim.
  for (const re of DISALLOWED_CLAIM_PATTERNS)
    if (re.test(spec.brief) || re.test(spec.title))
      errors.push(`brief/title contains a disallowed claim: ${re}`)

  // Rule 6: optional generative-UI layout. Backward compatible — legacy specs omit it.
  // Widget data refs are checked against the bundled candle keys + this spec's own
  // assets; track-fitness is checked against the spec's track.
  if (spec.layout !== undefined) {
    const layoutCatalog: LayoutCatalog = {
      candlesKeys: Object.keys(CANDLES),
      ohlcAssets: spec.dataRef.ohlcAsset ? [spec.dataRef.ohlcAsset] : [],
      chainAssets: spec.dataRef.chainAsset ? [spec.dataRef.chainAsset] : [],
    }
    const lv = validateLayout(spec.layout, layoutCatalog)
    if (!lv.ok) errors.push(...lv.errors)
    errors.push(...layoutFitsTrack(spec.layout, spec.track))
  }

  return { ok: errors.length === 0, errors }
}
