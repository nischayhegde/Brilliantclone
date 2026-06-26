import type { ScenarioSpec } from './types'
import { RUBRICS } from './rubrics'
import { NUDGES } from './nudges'
import { CANDLES } from '../data/candles'
import { validateLayout, layoutFitsTrack } from './genui/schema'
import { DISALLOWED_CLAIM_PATTERNS } from './genui/copyLint'
import type { LayoutCatalog } from './genui/types'

// Re-export the copy lints from their leaf home so existing consumers
// (`ai/validateComposed.ts`, `ai/coachPrompt.ts`) keep importing them from
// `../validator`. The definitions moved to `genui/copyLint.ts` to break the former
// `validator.ts ⇄ genui/schema.ts` import cycle.
export {
  DISALLOWED_CLAIM_PATTERNS,
  NUMERIC_CLAIM_PATTERN,
  hasDisallowedClaim,
  hasNumericClaim,
} from './genui/copyLint'

export interface ValidationResult {
  ok: boolean
  errors: string[]
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
  const { candlesKey, ohlcAsset, chainAsset, startIndex, splitIndex, revealToIndex } = spec.dataRef
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
    // `splitIndex`/`revealToIndex` are relative to the windowed slice; the slice can be at
    // most the whole series, so the window length (`revealToIndex`, defaulting to the rest of
    // the series after `startIndex`) bounds them.
    const start = startIndex ?? 0
    const windowLen = revealToIndex ?? n - start
    if (startIndex !== undefined && (start < 0 || start + windowLen > n))
      errors.push(`dataRef.startIndex ${start} + window ${windowLen} exceeds series length ${n}`)
    if (splitIndex !== undefined && (splitIndex < 1 || splitIndex >= windowLen))
      errors.push(`dataRef.splitIndex ${splitIndex} out of range [1, ${windowLen - 1}]`)
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
