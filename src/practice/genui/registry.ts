/**
 * Pure metadata contract per widget kind. This is the shared truth the WidgetHost,
 * the layout validator, the decision aggregator, and (WS-C) the server composer all
 * rely on. NO React/DOM/Phaser/firebase imports — this is part of the isomorphic core.
 */
import type { Track } from '../types'
import type { WidgetKind } from './types'

/**
 * Where a widget's output flows:
 * - `none`        display-only widget (no output): narrative, news, candle-chart, payoff-graph
 * - `signal`      process signal (enriches nudges/grader, never the math)
 * - `direction`   → ChartsDecision.direction / took
 * - `price-lines` → ChartsDecision.entry/stop/target
 * - `size`        → ChartsDecision.shares
 * - `option-legs` → OptionsDecision.legs/managed
 * - `quote`       → MarketMakingDecision (bid/ask width, size, inventory cap)
 */
export type WidgetFeed = 'none' | 'signal' | 'direction' | 'price-lines' | 'size' | 'option-legs' | 'quote'

export interface WidgetMeta {
  kind: WidgetKind
  /** Whether the widget collects learner input (vs. display-only). */
  interactive: boolean
  /** Which structured Decision field it feeds, or `signal`/`none`. */
  feeds: WidgetFeed
  /** Whether, when present in a layout, the widget must be answered for completeness. */
  required: boolean
  /** The track(s) this widget is valid for. */
  tracks: Track[]
}

const ALL_TRACKS: Track[] = ['charts', 'options', 'market-making']

/** The pure per-kind metadata table. */
export const WIDGET_REGISTRY: Record<WidgetKind, WidgetMeta> = {
  narrative: { kind: 'narrative', interactive: false, feeds: 'none', required: false, tracks: ALL_TRACKS },
  'news-headline': { kind: 'news-headline', interactive: false, feeds: 'none', required: false, tracks: ALL_TRACKS },
  'candle-chart': { kind: 'candle-chart', interactive: false, feeds: 'none', required: false, tracks: ALL_TRACKS },
  'annotate-chart': { kind: 'annotate-chart', interactive: true, feeds: 'signal', required: false, tracks: ALL_TRACKS },
  'direction-choice': { kind: 'direction-choice', interactive: true, feeds: 'direction', required: true, tracks: ['charts'] },
  'price-lines': { kind: 'price-lines', interactive: true, feeds: 'price-lines', required: true, tracks: ['charts'] },
  'size-slider': { kind: 'size-slider', interactive: true, feeds: 'size', required: true, tracks: ['charts'] },
  // risk-slider expresses an intended % risk; converting %→shares needs account + stop
  // (deterministic engine math), so the pure core records it as a process signal.
  'risk-slider': { kind: 'risk-slider', interactive: true, feeds: 'signal', required: false, tracks: ['charts'] },
  confidence: { kind: 'confidence', interactive: true, feeds: 'signal', required: false, tracks: ALL_TRACKS },
  'multiple-choice': { kind: 'multiple-choice', interactive: true, feeds: 'signal', required: false, tracks: ALL_TRACKS },
  'option-leg-builder': { kind: 'option-leg-builder', interactive: true, feeds: 'option-legs', required: true, tracks: ['options'] },
  'payoff-graph': { kind: 'payoff-graph', interactive: false, feeds: 'none', required: false, tracks: ['options'] },
  'quote-ladder': { kind: 'quote-ladder', interactive: true, feeds: 'quote', required: true, tracks: ['market-making'] },
  checklist: { kind: 'checklist', interactive: true, feeds: 'signal', required: false, tracks: ALL_TRACKS },
}

/** All known widget kinds (validators reject anything else). */
export const WIDGET_KINDS = Object.keys(WIDGET_REGISTRY) as WidgetKind[]

export function isWidgetKind(value: unknown): value is WidgetKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WIDGET_REGISTRY, value)
}

export function widgetMeta(kind: WidgetKind): WidgetMeta {
  return WIDGET_REGISTRY[kind]
}
