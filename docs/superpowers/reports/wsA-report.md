# WS-A — Generative-UI core (pure/isomorphic backbone)

Branch: `feat/trading-practice`. Status: **complete, all gates green.** The app stayed green throughout: **215 tests pass** (179 pre-existing + 36 new), `tsc -b` clean, `vite build` clean.

## What was built

A pure, isomorphic backbone in `src/practice/genui/` that lets GPT-5.5 compose a scenario as a validated `layout` of typed widgets, and that aggregates widget outputs back into the EXISTING deterministic `Decision` shapes. Only `WidgetHost.tsx` touches React; every other module is React/DOM/Phaser/firebase-free so the Cloud Functions runtime (WS-C) can import `types.ts` / `schema.ts` / `registry.ts` / `decision.ts` directly.

The deterministic resolvers/rubrics math is untouched. `layout` is **optional** on `ScenarioSpec`; legacy curated specs render via `defaultLayoutFor(track)`.

## Contracts WS-B / WS-C / WS-D will rely on (exact signatures)

### `genui/types.ts`
```ts
export type WidgetKind =
  | 'narrative' | 'news-headline' | 'candle-chart' | 'annotate-chart'
  | 'direction-choice' | 'price-lines' | 'size-slider' | 'risk-slider'
  | 'confidence' | 'multiple-choice' | 'option-leg-builder' | 'payoff-graph'
  | 'quote-ladder' | 'checklist'

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

export type ScenarioLayout = Widget[]

export type WidgetOutput =
  | { kind: 'direction-choice'; direction: Direction }                 // 'long'|'short'|'skip'
  | { kind: 'price-lines'; entry?: number; stop?: number; target?: number }
  | { kind: 'size-slider'; size: number }
  | { kind: 'risk-slider'; riskPct: number }
  | { kind: 'confidence'; confidence: number }
  | { kind: 'multiple-choice'; selected: string[] }
  | { kind: 'annotate-chart'; annotations: Annotation[] }
  | { kind: 'option-leg-builder'; legs: OptionLegDecision[]; managed?: OptionsDecision['managed'] }
  | { kind: 'quote-ladder'; bidWidth: number; askWidth: number; quoteSize: number; maxInventory: number }
  | { kind: 'checklist'; checked: string[] }

export type WidgetOutputs = Record<string, WidgetOutput>          // keyed by widget id
export type ProcessSignalValue = number | string | boolean | string[] | Annotation[]
export type ProcessSignals = Record<string, ProcessSignalValue>  // keyed by widget id

export interface LayoutCatalog { candlesKeys: string[]; ohlcAssets: string[]; chainAssets: string[] }
// DataCatalog (ai/types.ts) is structurally assignable to LayoutCatalog.
```
Config interfaces (all exported): `NarrativeConfig`, `NewsHeadlineConfig`, `CandleChartConfig`, `AnnotateChartConfig`, `DirectionChoiceConfig {allowed: Direction[]; prompt?}`, `PriceLinesConfig {require: PriceLineId[]; minRR?}`, `SizeSliderConfig {min; max; step?; unit?}`, `RiskSliderConfig {minPct; maxPct; step?}`, `ConfidenceConfig`, `MultipleChoiceConfig {prompt; options: McOption[]; multiSelect?}`, `OptionLegBuilderConfig {maxLegs; dataRef?; requireDefinedRisk?}`, `PayoffGraphConfig {source?}`, `QuoteLadderConfig {levels?; maxInventoryHint?}`, `ChecklistConfig {items: ChecklistItem[]; requireAll?}`. Helper types: `Direction`, `PriceLineId`, `AnnotationTool`, `WidgetDataRef`, `Annotation`, `McOption`, `ChecklistItem`.

### `genui/schema.ts` (pure)
```ts
export interface LayoutValidation { ok: boolean; errors: string[] }
export function validateLayout(layout: unknown, catalog: LayoutCatalog): LayoutValidation
export function layoutFitsTrack(layout: unknown, track: Track): string[]
```
`validateLayout` enforces: array shape; non-empty + unique ids; known kinds; valid per-kind config; any data refs ∈ catalog; widget copy passes the numeric-claim + disallowed-claim lints. The lints are the SINGLE SOURCE OF TRUTH reused from `validator.ts` (`hasNumericClaim`, `hasDisallowedClaim`) — no schema drift. `layoutFitsTrack` is the track-fitness check (registry-driven) used by callers that know the track.

### `genui/registry.ts` (pure)
```ts
export type WidgetFeed = 'none' | 'signal' | 'direction' | 'price-lines' | 'size' | 'option-legs' | 'quote'
export interface WidgetMeta { kind: WidgetKind; interactive: boolean; feeds: WidgetFeed; required: boolean; tracks: Track[] }
export const WIDGET_REGISTRY: Record<WidgetKind, WidgetMeta>
export const WIDGET_KINDS: WidgetKind[]
export function isWidgetKind(value: unknown): value is WidgetKind
export function widgetMeta(kind: WidgetKind): WidgetMeta
```
`feeds`/`required`/`tracks` per kind: direction-choice→direction (required, charts), price-lines→price-lines (required, charts), size-slider→size (required, charts), option-leg-builder→option-legs (required, options), quote-ladder→quote (required, market-making); confidence/multiple-choice/annotate-chart/checklist/risk-slider→signal; narrative/news-headline/candle-chart/payoff-graph→none.

### `genui/decision.ts` (pure, fully unit-tested)
```ts
export interface AggregateResult { decision: Decision; signals: ProcessSignals }
export function aggregateDecision(track: Track, layout: ScenarioLayout, outputs: WidgetOutputs): AggregateResult
export function isLayoutComplete(layout: ScenarioLayout, outputs: WidgetOutputs): boolean
```
Maps outputs into existing `ChartsDecision | OptionsDecision | MarketMakingDecision` + a process-signal bag. A `skip` direction → `took:false` and trade params omitted. `isLayoutComplete` requires each REQUIRED widget answered (each required price line set), short-circuiting trade-entry widgets on `skip`, and ≥1 option leg for options.

### `genui/WidgetHost.tsx` (the ONLY React file)
```ts
export interface WidgetProps { widget: Widget; value?: WidgetOutput; onChange: (output: WidgetOutput | undefined) => void }
export type WidgetComponents = Record<WidgetKind, ComponentType<WidgetProps>>
export interface WidgetHostProps {
  track: Track
  layout: ScenarioLayout
  components: WidgetComponents
  onSubmit: (decision: Decision, signals: ProcessSignals) => void
  submitLabel?: string
}
export default function WidgetHost(props: WidgetHostProps)
```
Renders each widget by kind from the INJECTED `components` map (testable with fakes), owns per-widget output state, disables submit until `isLayoutComplete`, and calls `onSubmit(aggregateDecision(...))`.

### `genui/defaultLayout.ts` (pure)
```ts
export function defaultLayoutFor(track: Track): ScenarioLayout
```
Curated single-scene shim per track (charts: candle-chart + direction-choice + price-lines + size-slider; options: candle-chart + option-leg-builder + payoff-graph; market-making: candle-chart + quote-ladder). Every default layout passes `validateLayout` with an empty catalog.

## TDD evidence
- Wrote tests first → confirmed RED: `schema.test.ts`, `decision.test.ts`, `defaultLayout.test.ts`, `WidgetHost.test.tsx` all failed with "Failed to load url" (modules absent).
- Implemented modules → GREEN: 36 new tests pass (schema 13, decision 9, defaultLayout 12, WidgetHost 2).
- Full suite GREEN: 215 tests (179 pre-existing untouched + 36 new).

## Files changed
Added: `src/practice/genui/{types,schema,registry,decision,defaultLayout}.ts`, `src/practice/genui/WidgetHost.tsx`, and tests `genui/{schema,decision,defaultLayout}.test.ts` + `genui/WidgetHost.test.tsx`, plus this report.
Edited: `src/practice/types.ts` (optional `layout?: ScenarioLayout`); `src/practice/validator.ts` (exported `NUMERIC_CLAIM_PATTERN` + `hasNumericClaim`/`hasDisallowedClaim`; `validateSpec` validates `layout` when present); `src/practice/ai/validateComposed.ts` (reuses shared numeric lint; validates `layout` + track fitness against the full catalog; strips `layout` from the base `validateSpec` call to avoid double-validation); `vitest.config.ts` (include `*.test.tsx`, `esbuild.jsx:'automatic'`).

## Final gate
- `npm test` → 37 files, **215 passed**.
- `npm run typecheck` (`tsc -b`) → clean.
- `npm run build` (`tsc -b && vite build`) → built (only the pre-existing phaser/firebase chunk-size warning).
- Purity grep of `src/practice/genui/*.{ts}` non-test, non-`WidgetHost` modules: only imports are `../types`, `./types`, `./registry`, `../validator` — no React/DOM/Phaser/firebase.

## Concerns / notes for downstream
- **risk-slider → signal (deviation from plan):** the plan tags `risk-slider` as `Decision.size`, but converting %-risk → shares needs account balance + stop distance (deterministic engine math, and `aggregateDecision` is pure with no spec/account context). WS-A records `risk-slider` as a process signal; WS-B/WS-D should add the %→shares conversion in the engine/sizing layer if a risk-slider is used in a real layout. `size-slider` is the canonical `shares` input.
- **Deliberate import cycle:** `validator.ts ⇄ genui/schema.ts` (validator validates layouts; schema reuses validator's lints). It is safe because both cross-imports are HOISTED `function` declarations referenced only at call time; verified green by tests + build. If WS-C's Functions bundler is stricter about cycles, extract the lints into a leaf module (`practice/lint.ts`) re-exported by `validator.ts`.
- **`WidgetHost` props add `track`:** the plan listed `{ layout, components, onSubmit }`, but `aggregateDecision` needs the track, so `track: Track` was added (necessary). `submitLabel?` is an optional convenience.
- **React tests:** `*.test.tsx` opt into jsdom via a per-file `// @vitest-environment jsdom` directive; JSX is transformed by esbuild's automatic runtime (no Vite React plugin, which would reintroduce the dual-Vite type clash the existing comment warned about).
- **`validateLayout` is track-agnostic** by signature (`(layout, catalog)`); track fitness is the separate `layoutFitsTrack`. WS-C's composer should call both.
- WS-A intentionally ships NO real widgets (WS-B), NO functions/OpenAI (WS-C), NO UI redesign (WS-E).
