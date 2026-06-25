/**
 * Pure per-kind config validators + `validateLayout`. Part of the isomorphic core:
 * NO React/DOM/Phaser/firebase. The copy lints reuse the single source of truth in
 * `validator.ts` (`hasDisallowedClaim` / `hasNumericClaim`) so client and server agree.
 *
 * NOTE: `validator.ts` imports `validateLayout` from here and this module imports the
 * lint helpers from there — a deliberate cycle. It is safe because both sides reference
 * the other only through hoisted `function` declarations used at call time, never at
 * module-init time.
 */
import type { Track } from '../types'
import { hasDisallowedClaim, hasNumericClaim } from '../validator'
import { WIDGET_REGISTRY, isWidgetKind } from './registry'
import type { LayoutCatalog, PriceLineId, WidgetDataRef } from './types'

export interface LayoutValidation {
  ok: boolean
  errors: string[]
}

const PRICE_LINE_IDS: PriceLineId[] = ['entry', 'stop', 'target']
const DIRECTIONS = new Set(['long', 'short', 'skip'])
const ANNOTATION_TOOLS = new Set(['level', 'zone', 'trendline'])

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Lint a copy string for invented numbers and disallowed claims. */
function lintCopy(label: string, text: unknown, errors: string[]): void {
  if (text == null) return
  if (!isString(text)) {
    errors.push(`${label} must be a string`)
    return
  }
  if (hasNumericClaim(text)) errors.push(`${label} contains a number (widget copy may not invent numbers)`)
  if (hasDisallowedClaim(text)) errors.push(`${label} contains a disallowed claim`)
}

/** Check every data ref present in a widget config is in the catalog allow-list. */
function checkDataRef(label: string, ref: unknown, catalog: LayoutCatalog, errors: string[]): void {
  if (ref == null) return
  if (!isObject(ref)) {
    errors.push(`${label} dataRef must be an object`)
    return
  }
  const dr = ref as WidgetDataRef
  if (dr.candlesKey != null && !catalog.candlesKeys.includes(dr.candlesKey))
    errors.push(`${label} candlesKey "${dr.candlesKey}" not in catalog`)
  if (dr.ohlcAsset != null && !catalog.ohlcAssets.includes(dr.ohlcAsset))
    errors.push(`${label} ohlcAsset "${dr.ohlcAsset}" not in catalog`)
  if (dr.chainAsset != null && !catalog.chainAssets.includes(dr.chainAsset))
    errors.push(`${label} chainAsset "${dr.chainAsset}" not in catalog`)
}

/**
 * Validate a single widget's config against its kind. `label` carries the widget id
 * for actionable errors. Returns accumulated errors (empty = valid).
 */
function validateConfig(kind: string, label: string, config: unknown, catalog: LayoutCatalog): string[] {
  const errors: string[] = []
  const c: Record<string, unknown> = isObject(config) ? config : {}
  if (!isObject(config)) {
    errors.push(`${label} config must be an object`)
    return errors
  }

  switch (kind) {
    case 'narrative':
      if (!isString(c.body) || c.body.trim() === '') errors.push(`${label} narrative requires a non-empty body`)
      lintCopy(`${label} heading`, c.heading, errors)
      lintCopy(`${label} body`, c.body, errors)
      break

    case 'news-headline':
      if (!isString(c.headline) || c.headline.trim() === '') errors.push(`${label} news-headline requires a headline`)
      lintCopy(`${label} headline`, c.headline, errors)
      lintCopy(`${label} source`, c.source, errors)
      lintCopy(`${label} body`, c.body, errors)
      break

    case 'candle-chart':
      checkDataRef(label, c.dataRef, catalog, errors)
      if (c.showVolume != null && typeof c.showVolume !== 'boolean') errors.push(`${label} showVolume must be a boolean`)
      break

    case 'annotate-chart':
      lintCopy(`${label} prompt`, c.prompt, errors)
      if (c.tools != null) {
        if (!Array.isArray(c.tools) || c.tools.some((t) => !ANNOTATION_TOOLS.has(t as string)))
          errors.push(`${label} annotate-chart tools must be a subset of level|zone|trendline`)
      }
      if (c.maxAnnotations != null && (!isFiniteNumber(c.maxAnnotations) || c.maxAnnotations < 1))
        errors.push(`${label} maxAnnotations must be a positive number`)
      break

    case 'direction-choice': {
      lintCopy(`${label} prompt`, c.prompt, errors)
      const allowed = c.allowed
      if (!Array.isArray(allowed) || allowed.length === 0) errors.push(`${label} direction-choice requires a non-empty allowed set`)
      else if (allowed.some((d) => !DIRECTIONS.has(d as string))) errors.push(`${label} direction-choice allowed must be long|short|skip`)
      break
    }

    case 'price-lines': {
      const require = c.require
      if (!Array.isArray(require) || require.length === 0) errors.push(`${label} price-lines requires a non-empty require set`)
      else if (require.some((l) => !PRICE_LINE_IDS.includes(l as PriceLineId))) errors.push(`${label} price-lines require must be entry|stop|target`)
      if (c.minRR != null && (!isFiniteNumber(c.minRR) || c.minRR <= 0)) errors.push(`${label} minRR must be a positive number`)
      break
    }

    case 'size-slider':
      if (!isFiniteNumber(c.min) || !isFiniteNumber(c.max)) errors.push(`${label} size-slider requires numeric min and max`)
      else if (c.min >= c.max) errors.push(`${label} size-slider min must be < max`)
      if (c.step != null && (!isFiniteNumber(c.step) || c.step <= 0)) errors.push(`${label} size-slider step must be positive`)
      if (c.unit != null && c.unit !== 'shares' && c.unit !== 'contracts') errors.push(`${label} size-slider unit must be shares|contracts`)
      break

    case 'risk-slider':
      if (!isFiniteNumber(c.minPct) || !isFiniteNumber(c.maxPct)) errors.push(`${label} risk-slider requires numeric minPct and maxPct`)
      else if (c.minPct >= c.maxPct) errors.push(`${label} risk-slider minPct must be < maxPct`)
      if (c.step != null && (!isFiniteNumber(c.step) || c.step <= 0)) errors.push(`${label} risk-slider step must be positive`)
      break

    case 'confidence':
      lintCopy(`${label} prompt`, c.prompt, errors)
      break

    case 'multiple-choice': {
      if (!isString(c.prompt) || c.prompt.trim() === '') errors.push(`${label} multiple-choice requires a prompt`)
      lintCopy(`${label} prompt`, c.prompt, errors)
      const options = c.options
      if (!Array.isArray(options) || options.length < 2) errors.push(`${label} multiple-choice requires at least 2 options`)
      else {
        for (const [i, opt] of options.entries()) {
          if (!isObject(opt) || !isString(opt.id) || !isString(opt.label))
            errors.push(`${label} multiple-choice option ${i} needs an id and label`)
          else lintCopy(`${label} option "${opt.id}"`, opt.label, errors)
        }
      }
      if (c.multiSelect != null && typeof c.multiSelect !== 'boolean') errors.push(`${label} multiSelect must be a boolean`)
      break
    }

    case 'option-leg-builder':
      checkDataRef(label, c.dataRef, catalog, errors)
      if (!isFiniteNumber(c.maxLegs) || c.maxLegs < 1) errors.push(`${label} option-leg-builder maxLegs must be >= 1`)
      if (c.requireDefinedRisk != null && typeof c.requireDefinedRisk !== 'boolean') errors.push(`${label} requireDefinedRisk must be a boolean`)
      break

    case 'payoff-graph':
      if (c.source != null && !isString(c.source)) errors.push(`${label} payoff-graph source must be a widget id string`)
      break

    case 'quote-ladder':
      if (c.levels != null && (!isFiniteNumber(c.levels) || c.levels < 1)) errors.push(`${label} quote-ladder levels must be >= 1`)
      if (c.maxInventoryHint != null && !isFiniteNumber(c.maxInventoryHint)) errors.push(`${label} maxInventoryHint must be a number`)
      break

    case 'checklist': {
      const items = c.items
      if (!Array.isArray(items) || items.length === 0) errors.push(`${label} checklist requires at least one item`)
      else {
        for (const [i, item] of items.entries()) {
          if (!isObject(item) || !isString(item.id) || !isString(item.label))
            errors.push(`${label} checklist item ${i} needs an id and label`)
          else lintCopy(`${label} item "${item.id}"`, item.label, errors)
        }
      }
      if (c.requireAll != null && typeof c.requireAll !== 'boolean') errors.push(`${label} requireAll must be a boolean`)
      break
    }

    default:
      // Unknown kind is caught by validateLayout before this is reached.
      errors.push(`${label} unhandled kind "${kind}"`)
  }

  return errors
}

/**
 * Validate an LLM-authored (or curated) layout. Enforces: array shape; non-empty,
 * unique ids; known kinds; valid per-kind config; data refs in the catalog allow-list;
 * and the numeric-claim / disallowed-claim copy lints. Pure — safe on any runtime.
 */
export function validateLayout(layout: unknown, catalog: LayoutCatalog): LayoutValidation {
  const errors: string[] = []

  if (!Array.isArray(layout)) {
    return { ok: false, errors: ['layout must be an array of widgets'] }
  }

  const seen = new Set<string>()
  for (const [i, raw] of layout.entries()) {
    const at = `widget[${i}]`
    if (!isObject(raw)) {
      errors.push(`${at} must be an object`)
      continue
    }
    const id = raw.id
    const kind = raw.kind

    if (!isString(id) || id.trim() === '') {
      errors.push(`${at} requires a non-empty string id`)
    } else if (seen.has(id)) {
      errors.push(`${at} duplicate widget id "${id}"`)
    } else {
      seen.add(id)
    }

    const label = isString(id) && id ? `widget "${id}"` : at

    if (!isWidgetKind(kind)) {
      errors.push(`${label} has unknown kind "${String(kind)}"`)
      continue
    }

    errors.push(...validateConfig(kind, label, raw.config, catalog))
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Check every widget in a layout is registered as valid for `track`. Separate from
 * `validateLayout` (whose signature is track-agnostic) so callers that know the track
 * (validateSpec) can add this lightweight fitness check.
 */
export function layoutFitsTrack(layout: unknown, track: Track): string[] {
  if (!Array.isArray(layout)) return ['layout must be an array of widgets']
  const errors: string[] = []
  for (const raw of layout) {
    if (!isObject(raw) || !isWidgetKind(raw.kind)) continue
    const meta = WIDGET_REGISTRY[raw.kind]
    if (!meta.tracks.includes(track)) {
      const id = isString(raw.id) ? raw.id : raw.kind
      errors.push(`widget "${id}" (${raw.kind}) is not valid for track ${track}`)
    }
  }
  return errors
}
