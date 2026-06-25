/**
 * Generative-UI core types — the single source of truth shared by the Vite client
 * (render + validate) and the Cloud Functions runtime (compose + validate).
 *
 * PURE / ISOMORPHIC: this module (and its siblings schema/registry/decision) must
 * import nothing from React, the DOM, Phaser, or firebase. Only `WidgetHost.tsx`
 * is allowed to touch React.
 */
import type { OptionLegDecision, OptionsDecision } from '../types'

/** The interaction-kit widget kinds the LLM may compose a scenario from. */
export type WidgetKind =
  | 'narrative'
  | 'news-headline'
  | 'candle-chart'
  | 'annotate-chart'
  | 'direction-choice'
  | 'price-lines'
  | 'size-slider'
  | 'risk-slider'
  | 'confidence'
  | 'multiple-choice'
  | 'option-leg-builder'
  | 'payoff-graph'
  | 'quote-ladder'
  | 'checklist'

/** Allowed directional choices for a charts trade. */
export type Direction = 'long' | 'short' | 'skip'

/** The three price levels a charts trade can pin. */
export type PriceLineId = 'entry' | 'stop' | 'target'

/** Chart annotation tools (process signal; never feeds the math). */
export type AnnotationTool = 'level' | 'zone' | 'trendline'

/** A real-data reference a widget may render/use; validated against the catalog. */
export interface WidgetDataRef {
  candlesKey?: string
  ohlcAsset?: string
  chainAsset?: string
}

// --- per-kind config shapes (discriminate via the widget's `kind`) ---

export interface NarrativeConfig {
  heading?: string
  body: string
}

export interface NewsHeadlineConfig {
  headline: string
  source?: string
  body?: string
}

export interface CandleChartConfig {
  /** Optional explicit data ref; when omitted the chart binds to the spec's dataRef. */
  dataRef?: WidgetDataRef
  showVolume?: boolean
}

export interface AnnotateChartConfig {
  prompt?: string
  tools?: AnnotationTool[]
  maxAnnotations?: number
}

export interface DirectionChoiceConfig {
  prompt?: string
  /** The allowed subset of directions (non-empty). */
  allowed: Direction[]
}

export interface PriceLinesConfig {
  /** Which lines the learner must set for a taken trade. */
  require: PriceLineId[]
  /** Minimum reward:risk the widget should encourage (display/validation hint only). */
  minRR?: number
}

export interface SizeSliderConfig {
  min: number
  max: number
  step?: number
  unit?: 'shares' | 'contracts'
}

export interface RiskSliderConfig {
  minPct: number
  maxPct: number
  step?: number
}

export interface ConfidenceConfig {
  prompt?: string
}

export interface McOption {
  id: string
  label: string
}

export interface MultipleChoiceConfig {
  prompt: string
  options: McOption[]
  multiSelect?: boolean
}

export interface OptionLegBuilderConfig {
  /** Optional explicit chain ref; when omitted the builder binds to the spec's dataRef. */
  dataRef?: WidgetDataRef
  maxLegs: number
  requireDefinedRisk?: boolean
}

export interface PayoffGraphConfig {
  /** Id of the option-leg-builder widget whose legs this graph previews. */
  source?: string
}

export interface QuoteLadderConfig {
  levels?: number
  /** Display hint for the inventory-cap control bounds. */
  maxInventoryHint?: number
}

export interface ChecklistItem {
  id: string
  label: string
}

export interface ChecklistConfig {
  items: ChecklistItem[]
  requireAll?: boolean
}

/** A single composed widget — discriminated union over `kind`. */
export type Widget =
  | { id: string; kind: 'narrative'; config: NarrativeConfig }
  | { id: string; kind: 'news-headline'; config: NewsHeadlineConfig }
  | { id: string; kind: 'candle-chart'; config: CandleChartConfig }
  | { id: string; kind: 'annotate-chart'; config: AnnotateChartConfig }
  | { id: string; kind: 'direction-choice'; config: DirectionChoiceConfig }
  | { id: string; kind: 'price-lines'; config: PriceLinesConfig }
  | { id: string; kind: 'size-slider'; config: SizeSliderConfig }
  | { id: string; kind: 'risk-slider'; config: RiskSliderConfig }
  | { id: string; kind: 'confidence'; config: ConfidenceConfig }
  | { id: string; kind: 'multiple-choice'; config: MultipleChoiceConfig }
  | { id: string; kind: 'option-leg-builder'; config: OptionLegBuilderConfig }
  | { id: string; kind: 'payoff-graph'; config: PayoffGraphConfig }
  | { id: string; kind: 'quote-ladder'; config: QuoteLadderConfig }
  | { id: string; kind: 'checklist'; config: ChecklistConfig }

/** An LLM-authored, validated interactive layout. */
export type ScenarioLayout = Widget[]

// --- widget outputs (what an interactive widget collects) ---

export interface Annotation {
  tool: AnnotationTool
  label?: string
  price?: number
  price2?: number
  index?: number
  index2?: number
}

/** Typed output of one interactive widget — discriminated over `kind`. */
export type WidgetOutput =
  | { kind: 'direction-choice'; direction: Direction }
  | { kind: 'price-lines'; entry?: number; stop?: number; target?: number }
  | { kind: 'size-slider'; size: number }
  | { kind: 'risk-slider'; riskPct: number }
  | { kind: 'confidence'; confidence: number }
  | { kind: 'multiple-choice'; selected: string[] }
  | { kind: 'annotate-chart'; annotations: Annotation[] }
  | { kind: 'option-leg-builder'; legs: OptionLegDecision[]; managed?: OptionsDecision['managed'] }
  | { kind: 'quote-ladder'; bidWidth: number; askWidth: number; quoteSize: number; maxInventory: number }
  | { kind: 'checklist'; checked: string[] }

/** Per-widget outputs keyed by widget id (the WidgetHost owns this state). */
export type WidgetOutputs = Record<string, WidgetOutput>

/** A process-signal value (enriches nudges + the LLM grader; never the math). */
export type ProcessSignalValue = number | string | boolean | string[] | Annotation[]

/** Process-only widget answers keyed by widget id. */
export type ProcessSignals = Record<string, ProcessSignalValue>

/**
 * The real-data allow-list `validateLayout` checks widget data refs against. A
 * `DataCatalog` (src/practice/ai/types.ts) is structurally assignable to this.
 */
export interface LayoutCatalog {
  candlesKeys: string[]
  ohlcAssets: string[]
  chainAssets: string[]
}
