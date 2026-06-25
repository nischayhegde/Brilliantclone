# WS-B — Interaction-kit widgets (rich, ~14)

Branch: `feat/trading-practice`. Status: **complete, all gates green.** App stayed green:
**272 tests pass** (215 pre-existing untouched + 57 new), `tsc -b` clean, `vite build` clean
(only the pre-existing phaser/firebase chunk-size warning).

A React component for every `WidgetKind` WS-A defined, conforming EXACTLY to WS-A's
`WidgetProps` (`{ widget, value?, onChange }`) + the injected `components` map. The pure
deterministic modules (`payoffMath`, `optionMath`, `book`, candle data) are **reused, not
reimplemented** — widgets only render real/configured data and shape outputs into WS-A's
`WidgetOutput` shapes.

All new code lives in `src/practice/genui/widgets/`. No existing scene/player code was
touched (WS-E owns that).

## The `WIDGET_COMPONENTS` map (`widgets/index.ts`)

```ts
export const WIDGET_COMPONENTS: WidgetComponents = {
  narrative, 'news-headline', 'candle-chart', 'annotate-chart', 'direction-choice',
  'price-lines', 'size-slider', 'risk-slider', confidence, 'multiple-choice',
  'option-leg-builder', 'payoff-graph', 'quote-ladder', checklist,
}
// WidgetComponents = Record<WidgetKind, ComponentType<WidgetProps>>  (from WidgetHost)
```

`index.ts` also re-exports the data providers/hooks and the pure helpers (below).
`index.test.ts` asserts the map has exactly one `function` component per `WIDGET_KINDS`
entry (no missing/extra kinds).

## Chart scale API (`widgets/chartScale.ts`, pure, unit-tested)

```ts
makeChartScale(candles: Candle[], opts?: {
  width?; height?; pad?: {left,right,top,bottom}; padFrac?
}): ChartScale

interface ChartScale {
  pmin; pmax; plot: {l,r,t,b,w,h}; width; height; n; bodyW; step
  xFor(i): number        // candle index → x (bar center)
  yFor(price): number    // price → y
  priceFor(y): number    // y → price (clamped to plot)
  indexFor(x): number    // x → nearest candle index (clamped)
  fmtPrice(p): string
}
priceRange(candles, padFrac=0.08): { min, max }   // safe on empty/flat slices
```

The chart renders into a **fixed viewBox** (`480×280` default), so every coordinate is
resolution-independent and the base candles + overlay share one coordinate space — no DOM
measurement, nothing clips/overlaps (the old Phaser controls bug). `svgPoint()` in
`ChartBase.tsx` converts pointer events to viewBox units for dragging (null in jsdom →
keyboard is the reliable/tested path).

## How chart widgets share data (the one wiring point for WS-E)

`widgets/context.tsx` provides thin React contexts so the chart family shares the ONE real
slice/chain a scenario is built on (the `WidgetProps` contract has no spec/dataRef channel):

- `ChartDataProvider candles? | dataRef?` → `useCandles()` / `useResolvedCandles(configRef)`
- `ChainDataProvider chain? | dataRef?` → `useChain()` / `useResolvedChain(configRef)`
- `LegsProvider initial?` → `useLegs()` (option-leg-builder publishes legs; payoff-graph reads `legs[source]`)

Each provider accepts already-loaded data (tests stay synchronous) **or** a `dataRef` it
loads via the read-only `loadCandles`/`loadChain`. Widgets degrade gracefully (placeholder /
empty state) when no provider/data is present. **Deliberate deviation from the literal
plan:** `price-lines`/`annotate-chart` draw their own base candles + overlay in the *same
`<svg>* (via `ChartBase.ChartFrame` `children`) rather than absolutely positioning over a
sibling `candle-chart`'s pixels — same shared scale, but bullet-proof alignment and
jsdom-testable. WS-E should render an interactive chart widget *instead of* a separate
`candle-chart` for charts scenarios (use `candle-chart` for display-only contexts).

## Per-widget summary (config read → output emitted → how tested)

| Widget | Reads (config) | Emits (`WidgetOutput`) | Tested |
|---|---|---|---|
| `narrative` | `heading?, body` | — (display) | renders heading+body |
| `news-headline` | `headline, source?, body?` | — (display) | renders headline+source |
| `candle-chart` | `dataRef?, showVolume?` | — (display) | renders accessible chart; placeholder w/o data |
| `annotate-chart` | `prompt?, tools?, maxAnnotations?` | `{annotations: Annotation[]}` | add level @ cursor → 1 annotation; remove → 0 |
| `direction-choice` | `prompt?, allowed[]` | `{direction}` | click reports dir; only allowed subset rendered |
| `price-lines` | `require[], minRR?` | `{entry?,stop?,target?}` (required only) | a labelled `slider` per line; ArrowUp/Down adjusts; reports all required on interaction |
| `size-slider` | `min,max,step?,unit?` | `{size}` | mount-commits in-range default; change reports |
| `risk-slider` | `minPct,maxPct,step?` | `{riskPct}` (signal) | change reports riskPct |
| `confidence` | `prompt?` | `{confidence}` (signal) | mount-commits 50; change reports |
| `multiple-choice` | `prompt, options[], multiSelect?` | `{selected[]}` (signal) | single→1 id; multi→accumulates |
| `checklist` | `items[], requireAll?` | `{checked[]}` (signal) | tick reports ids |
| `option-leg-builder` | `dataRef?, maxLegs, requireDefinedRisk?` | `{legs[], managed?}` | adds leg from real chain (premium=mid); naked short gated to `undefined` when `requireDefinedRisk` |
| `payoff-graph` | `source?` | — (display) | previews payoff for source legs; empty state otherwise |
| `quote-ladder` | `levels?, maxInventoryHint?` | `{bidWidth,askWidth,quoteSize,maxInventory}` | mount-commits default quote; change reports |

### Pure helpers (unit-tested, reuse the read-only math)
- `rewardRisk.ts` — `rewardRisk(dir, entry, stop, target)` (price-lines R:R readout).
- `quoteMath.ts` — `quoteFromMid(mid,bidW,askW)`, `ladderLevels(...)` (reuses `book` formatters).
- `legBuilder.ts` — `rowToLeg(row, side, contracts, snapDate)` (premium = chain mid; `dteAtEntry` via `dteDays`), `definedRisk(legs)` (no uncovered short).
- `payoffCurve.ts` — `combinedDollars`, `payoffSamples`, `priceDomain`, `payoffSummary` (max P&L / breakevens / unbounded flags) — all built on the lesson's exact `payoffMath.legPnL`.

## Integrity / a11y / motion
- **No invented prices.** Premiums = real chain mid; quote mid = last real close; price-line
  defaults derive from the real last close + price range; payoff math reuses `payoffMath`.
- **Accessibility:** sliders are native `range` or `role="slider"` knobs with
  `aria-valuemin/max/now/text`; choices use `role="radio/radiogroup"`/`checkbox` with
  `aria-checked`; charts are `role="img"` with labels; every control is keyboard-operable
  with visible `focus-visible` rings; remove buttons have `aria-label`s.
- **Keyboard chart control:** price-line knobs and the annotate cursor move with
  ↑/↓ (and ←/→, Page, Home/End); Enter/Space drops an annotation.
- **Reduced-motion aware** via `useReducedMotion()` (the only transitions — knob/cursor —
  are disabled under `prefers-reduced-motion`).

## TDD evidence
Pure layer: 5 test files written first → confirmed RED ("Failed to load url …") → implemented
→ GREEN (32). Component layer: smoke tests written, RED, implemented, GREEN (25). Total new:
**57 tests across 10 files** (`chartScale`, `rewardRisk`, `quoteMath`, `legBuilder`,
`payoffCurve`, `index`, `simple.test.tsx`, `priceLines.test.tsx`, `charts.test.tsx`,
`optionsMM.test.tsx`). Component tests use a controlled harness mirroring `WidgetHost`
(holds output state, feeds `value` back) and a per-file `// @vitest-environment jsdom`.

## Files added
`src/practice/genui/widgets/`: `chartScale.ts`, `rewardRisk.ts`, `quoteMath.ts`,
`legBuilder.ts`, `payoffCurve.ts`, `context.tsx`, `ChartBase.tsx`, `PayoffSvg.tsx`, `ui.tsx`,
the 14 widget components (`Narrative`, `NewsHeadline`, `CandleChart`, `AnnotateChart`,
`DirectionChoice`, `PriceLines`, `SizeSlider`, `RiskSlider`, `Confidence`, `MultipleChoice`,
`OptionLegBuilder`, `PayoffGraph`, `QuoteLadder`, `Checklist`), `index.ts`, and the 10 test
files. No existing files edited.

## Concerns / notes for downstream (WS-E/WS-F)
- **Wrap the rendered layout in the providers**, seeded from the spec's dataRef:
  `<ChartDataProvider dataRef={...}><ChainDataProvider dataRef={...}><LegsProvider> <WidgetHost components={WIDGET_COMPONENTS} …/> …`.
  Without them, chart/options widgets show graceful placeholders.
- **Default layout double-chart:** WS-A's `defaultLayoutFor('charts')` includes both
  `candle-chart` and `price-lines`; since `price-lines` now draws its own chart, that renders
  two charts. WS-E should drop the standalone `candle-chart` when an interactive chart widget
  is present (or keep `candle-chart` only for display-only/options/MM layouts).
- **`risk-slider` is a process signal** (per WS-A): the %→shares conversion still belongs in
  the engine/sizing layer; `size-slider` remains the canonical `shares` input.
- **`option-leg-builder` premium = snapshot mid** (deterministic). If the resolver wants
  bid/ask execution instead of mid, change `rowToLeg` (one pure spot).
- **`showVolume`** is accepted but inert — the bundled `Candle` type has no volume field.
- **Pointer dragging** relies on `getScreenCTM()` (unavailable in jsdom), so pointer drag is
  smoke-tested only via the keyboard path; verify drag in a real browser during WS-E.
