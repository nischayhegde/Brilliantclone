# WS-F — Integration, rich curated fallback layouts, DEV-only preview route

Branch: `feat/trading-practice`. Status: **complete, all gates green.** Root: **333 tests pass**
(326 pre-existing + 7 new), `tsc -b` clean, `vite build` clean (only the pre-existing
phaser/firebase chunk-size warning). Functions: `npm run build` clean + **39 tests pass**
(unchanged). No test touches the network or a model.

This work stitches WS-A..E together end-to-end: every curated spec now ships a rich,
validated interactive layout (the offline / cold-start / AI-off showcase), and a DEV-only
`/preview` route lets the whole flow be verified visually with NO Google sign-in.

## 1) Rich curated layout scenarios (the offline / cold-start showcase)

Every curated `ScenarioSpec` in `src/practice/scenarioRegistry.ts` now carries a hand-authored
`layout` (previously they fell back to the bare `defaultLayoutFor` shim). The layouts are built
by three tier-scaling factories (`chartsLayout`, `optionsLayout`, `marketMakingLayout`) and bind
to the spec's REAL data via the WS-B providers — **no widget carries its own `dataRef`**, so
nothing can drift from the catalog. All copy is number-free + claim-free so each layout passes
`validateLayout`'s lints. These are what users see when AI is off, AND they are the composer's
cold-start / silent-fallback (`pickCurated` → `ensureLayout` keeps the curated layout).

Widget mixes per track × tier (required interactive widgets in **bold**):

- **Charts** (price-lines draws its own chart, so no standalone `candle-chart` — WS-E drops it anyway):
  - T1: `narrative` + **direction-choice** + **price-lines** (entry/stop/target, minRR 1.5) + **size-slider** + `confidence`
  - T2: `narrative` + `news-headline` + `multiple-choice` (structure read) + **direction-choice** + **price-lines** (minRR 2) + **size-slider** + `confidence`
  - T3: `narrative` + **direction-choice** + **price-lines** (minRR 2.5) + `risk-slider` + **size-slider** + `checklist` + `confidence`
- **Options** (`candle-chart` shows the real underlying; `payoff-graph.source` → the leg-builder id):
  - T1: `narrative` + `candle-chart` + **option-leg-builder** (maxLegs 2, definedRisk) + `payoff-graph`
  - T2: `narrative` + `news-headline` + `candle-chart` + **option-leg-builder** (maxLegs 4) + `payoff-graph` + `checklist`
  - T3: `narrative` + `news-headline` + `multiple-choice` (thesis) + `candle-chart` + **option-leg-builder** + `payoff-graph` + `checklist` + `confidence`
- **Market-making** (`candle-chart` shows the real mid-path):
  - T1: `narrative` + `candle-chart` + **quote-ladder** (levels 1) + `confidence`
  - T2: `narrative` + `candle-chart` + **quote-ladder** (levels 2) + `multiple-choice` (regime) + `checklist` + `confidence`
  - T3: `narrative` + `news-headline` + `candle-chart` + **quote-ladder** + `multiple-choice` + `checklist` + `confidence`

Union of kinds per track: charts 9, options 8, market-making 7 — a genuinely varied showcase.

**Test (TDD, `scenarioRegistry.test.ts`, +5 cases, written RED first):** every curated spec
(a) carries a non-empty layout, (b) passes `validateLayout` against its per-spec catalog
(`Object.keys(CANDLES)` + the spec's own ohlc/chain asset, mirroring `validateSpec`), (c) passes
`layoutFitsTrack`, (d) includes every registry-`required` widget kind for its track, and (e) per
track the union of kinds is ≥ 5 and opens with a `narrative`. The pre-existing
"every curated spec passes `validateSpec`" case still holds (validateSpec runs validateLayout +
layoutFitsTrack when a layout is present).

## 2) DEV-only preview route (visual verification without Google auth)

- **`src/pages/PracticePreviewPage.tsx`** (new): a thin harness with a top "DEV preview" switcher
  (`Practice hub` · `Charts` · `Options` · `Market making`). The hub tab renders the redesigned
  `PracticePage`; each track tab renders a live `ScenarioPlayer` for a curated spec (with a tier
  1/2/3 selector) so the full flow — layout → mandatory journal → deterministic debrief — is
  exercisable. It needs **no signed-in user**: it relies only on the ambient `PracticeProvider`,
  which serves `initialAccount()` defaults when signed out, and `getGradeFn()` is null offline so
  grading uses the deterministic guardrail.
- **Route registration in `src/App.tsx`** is guarded twice by a static `import.meta.env.DEV`:
  the page is `lazy(() => import(...))` only in DEV (else `null`), and the `<Route path="/preview">`
  is only emitted when `import.meta.env.DEV && PracticePreviewPage`. In a production build Rollup
  evaluates `false ? lazy(...) : null` → `null` and drops the dynamic import, so **no preview chunk
  is emitted and the route is never registered**. The real `ProtectedRoute` and real routes are
  untouched; `/preview` lives outside the protected group.
- **How to open it:** `npm run dev`, then visit `/preview` (e.g. `http://localhost:5173/preview`;
  it lands on whatever free port Vite reports — it was `http://localhost:5175/preview` in this run).
- **Smoke test** (`PracticePreviewPage.test.tsx`, +2): renders the DEV switcher + the redesigned
  hub by default; switching to Charts loads the curated spec (bundled candles, no network) and runs
  it through the REAL `ScenarioPlayer` (asserts the layout's "Submit decision" control + title).

**Live browser verification (via the Cursor browser at `/preview`, signed out):** the hub renders
(Paper balance $10,000, "Start here"); Charts renders one real candle chart with draggable
entry/stop/target lines (no double chart); Options renders narrative + underlying chart + leg
builder + payoff over the real DIS chain; Market-making renders the mid-path session + quote ladder.

## 3) Functions data for live compose (WS-D follow-up) — decision: client-passes-catalog, server-enforces

WS-D set up the **dedicated boundary as "client builds the catalog, server strictly enforces it,"**
and WS-F keeps it consistent (no manifests are mirrored into the functions package). Concretely:

- The client builds the real-data allow-list from the ingested manifests (`ai/catalog.buildCatalog`
  reads `public/data/manifest.json` + `options-manifest.json`, cached) and passes it to the
  `composeScenario` callable (`state/PracticeContext`).
- The server **strictly enforces** it: `functions/src/index.ts#composeScenario` → `validateComposeInput`
  (catalog must be string arrays, each ≤ `MAX_CATALOG_ENTRIES`) → `runCompose` → `assembleComposedSpec`,
  which validates the model's layout against that catalog (`validateLayout` allow-list + numeric/claim
  lints + `layoutFitsTrack`) and **builds the dataRef + constraints server-side** (`pickDataRef` /
  `serverConstraints`). The model only ever picks from the passed allow-list; the prompt + raw output
  never leave the server.

So the deployed function needs **no data files** — its only "data" input is the validated catalog,
and every traded number is still loaded deterministically by ref on the client. This is self-contained
and the functions build/tests stay green (no functions code changed in WS-F). A future hardening could
mirror a compact candle-keys/asset index into functions for a fully server-sourced allow-list, but it
is not required for the integrity guarantees, which already hold.

## 4) Accessibility / motion / disclaimers / integrity — intact

No deterministic math, genui core, or widget public contracts were touched. The curated layouts only
add validated config; the preview page is a pure harness that reuses the real components (so their
a11y/reduced-motion/disclaimer behavior is unchanged). P&L stays display-only; grading stays
process-not-P&L with the deterministic guardrail/fallback. No invented numbers (all layout copy is
number-free and lint-checked).

## Gate output

- Root: `npm test` → **55 files, 333 passed**; `npm run typecheck` (`tsc -b`) → clean;
  `npm run build` → built (only the pre-existing chunk-size warning).
- Functions: `npm --prefix functions run build` → clean; `npm --prefix functions test` → **39 passed**.
- **Preview is DEV-only:** the production `dist/assets` emits exactly 3 JS chunks
  (`firebase-*`, `index-*`, `phaser-*`) — **no preview chunk** — and
  `rg "PracticePreview|DEV preview|No sign-in required" dist` → **0 matches**.

## What the controller should screenshot at `/preview`

Run `npm run dev`, open `/preview` (no sign-in). Screenshot, per tab:
- **Practice hub** — redesigned track list, skill bars, "Start here", paper-balance header.
- **Charts** (toggle Tier 1/2/3) — single real chart with draggable entry/stop/target; direction,
  size, confidence; at T2 the structure multiple-choice; at T3 risk-slider + checklist.
- **Options** (toggle tiers) — underlying chart + defined-risk leg builder + live payoff; T2 adds the
  news headline + checklist; T3 adds the thesis pick + confidence.
- **Market making** (toggle tiers) — mid-path chart + two-sided quote ladder; T2 adds regime pick +
  checklist; T3 adds the one-way-flow headline.
- Run one scenario end-to-end (decision → mandatory journal → process debrief with score ring +
  per-dimension bars + display-only P&L) to capture the full flow.

## Concerns / notes

- **Preview "Continue" / hub "Start" navigate to `/practice...`** which is auth-gated, so signed out
  they bounce to `/login`. That's expected (the harness doesn't weaken auth); just return to
  `/preview` to run another scenario.
- Fixed a harness race found in live testing: switching directly between two track players reused the
  `PreviewPlayer` instance and briefly handed `ScenarioPlayer` the previous track's data shape (crash).
  Now data is tagged with its spec id and `ScenarioPlayer` only mounts when `loaded.id === spec.id`
  (plus `key={view}` remounts per track). No production code is involved.
- Live GPT-5.5 compose/grade still wants a smoke-check against the deployed callables (offline tests
  exercise only the deterministic/curated paths, by design).
