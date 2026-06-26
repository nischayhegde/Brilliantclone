# WS-E — Trading Practice UI redesign (generative flow)

Branch: `feat/trading-practice`. Status: **complete, all gates green.** Root: **326 tests pass**
(322 pre-existing + 4 new), `tsc -b` clean, `vite build` clean (only the pre-existing
phaser/firebase chunk-size warning). Dev server (`http://localhost:5174`) transforms every new
module 200 OK. No network/model touched in tests.

## What changed at a glance

The old `ScenarioPlayer` mounted a Phaser scene + the coach debrief. It now drives the **generative
WidgetHost flow** end-to-end and the whole Practice surface was redesigned against the impeccable
**product** register and the Trilliant token system (warm ink/amber, Fraunces display, Inter UI).

## The new ScenarioPlayer flow (`src/practice/ScenarioPlayer.tsx`)

Three phases, with a visible stepper (Set up → Reflect → Result):

1. **Set up** — render `spec.layout` (LLM-authored, validated) or `defaultLayoutFor(track)` via
   `WidgetHost` + `WIDGET_COMPONENTS`, wrapped in the WS-B data providers seeded from the loaded data:
   - charts → `ChartDataProvider candles={data}` + `LegsProvider`
   - options → `ChartDataProvider candles={underlying}` + `ChainDataProvider chain={snapshot}` + `LegsProvider`
   - market-making → `ChartDataProvider candles={midsToCandles(mids)}` + `LegsProvider`
   - `prepareLayout` **drops the standalone `candle-chart`** from charts layouts when an interactive
     chart widget (`price-lines`/`annotate-chart`) is present, per the WS-B note (avoids a double chart).
   - `WidgetHost.onSubmit(decision, signals)` aggregates the typed widget outputs into the existing
     `Decision` shape + a `ProcessSignals` bag and advances to the journal.
2. **Reflect (mandatory journal gate)** — the redesigned `Journal` (rationale + feeling) is the
   required pre-submit gate; nothing resolves until it's logged. Kept its full keyboard/ARIA
   behavior (roving radiogroup, ⌘/Ctrl+Enter).
3. **Result** — on journal submit:
   - `engine.resolve(spec, data, decision)` runs the **EXACT deterministic math** (untouched).
   - `nudgesForRun(...)` derives the coaching nudges from the same decision (replaces the old live
     Phaser nudge events).
   - `gradeRunHybrid({ spec, decision, outcome, candleSummary, signals, journal }, getGradeFn())`
     produces the **process score + written feedback** (GPT-5.5 when wired, deterministic guardrail +
     curated debrief otherwise). `candleSummaryFor` builds the real-slice summary (charts → data,
     options → underlying, MM → mid-path) — the grader's citation whitelist.
   - A skeleton shows while the grade resolves; `applyResult` persists on **Continue**.

Analytics preserved: `scenario_started` (mount), `decision_submitted` (layout submit),
`scenario_completed` + `nudge_fired` (after grading).

## Redesigned debrief (`src/practice/ScenarioDebrief.tsx`)

- **Process score is the headline**: an SVG ring gauge (0–100) + qualitative title + a labelled
  pass pill (`Process passed` / `Keep building the process` — state is never hue-only).
- **Per-dimension bars**: label, %, a track/fill bar (green ≥80 / amber ≥50 / red below, with a
  "Focus here" tag on weak dimensions), and the grader's note.
- **Written feedback** in a calm panel, capped at 68ch.
- **Journal recap** ("what you logged going in" + feeling) closes the reflection loop.
- **Nudges** as warm amber caution notes.
- **P&L is display-only and secondary** — a small footer row, clearly labelled "display only · it
  never sets your grade", with the closed-early model-estimate + illustrative labels where relevant.
- **Score source** is subtly indicated ("Graded by GPT-5.5" vs "Deterministic grade").

## Redesigned PracticePage (`src/pages/PracticePage.tsx`)

Replaced the 3-up identical-card grid with a confident **track list** (1D stack, not a card grid):
each track row carries its title (Fraunces), what it teaches, a tier badge, and an amber **skill
progress bar** with the 0–100 value. The lowest-skill playable track is flagged **"Start here"** to
guide the next session. Account header keeps the paper balance (prominent) + resets. `PracticeStats`
retained below.

## Player shell + chrome

`ScenarioPlayerPage` is a clean block shell (`max-w-3xl`, centered loader). The player owns a
`max-w-2xl` reading column with: a track/tier chip + the phase stepper, a strong title/brief, the
phase body, the honesty label, and the persistent `Disclaimer`. No overlapping/clipped controls
(the widgets render in a flex column; charts draw into a fixed viewBox from WS-B).

## Accessibility / motion

- Reduced-motion aware via `useReducedMotion`: the score-ring sweep, dimension-bar fill, and the
  result reveal all degrade to instant; the global `prefers-reduced-motion` rule backstops it.
- ARIA: `aria-live` phase region; focus moves onto the result region when it appears; the stepper is
  an `<ol>` with `aria-current="step"`; dimension/skill bars are `role="progressbar"` with values;
  the score ring is `role="img"` with a label; journal keeps its radiogroup semantics.
- Contrast: body copy uses `ink`/`ink-soft` on `paper`/`surface` (≥4.5:1); no muted-gray-on-tint
  body text; amber accents are on soft/ink-paired surfaces.
- Motion is product-grade (150–700ms, ease-out, no bounce); the only orchestration is the single
  result reveal + bar/ring fills, which convey state.

## Files

**Added:** `src/practice/ScenarioDebrief.tsx`, `src/practice/runNudges.ts`,
`src/practice/ScenarioPlayer.test.tsx`, `src/pages/PracticePage.test.tsx`, this report.
**Rewrote:** `src/practice/ScenarioPlayer.tsx` (generative flow), `src/pages/PracticePage.tsx`
(track list redesign), `src/practice/Journal.tsx` (carded, hierarchy).
**Edited:** `src/pages/ScenarioPlayerPage.tsx` (shell), `src/practice/genui/WidgetHost.tsx`
(submit-button styling only — see deviations).

## Tests

- `ScenarioPlayer.test.tsx` (jsdom): renders framing + composed layout; full flow (skip → submit →
  mandatory journal → resolve + deterministic grade → redesigned debrief → Continue persists +
  routes). Mocks `useNavigate`, `usePractice`, and `getGradeFn`→null (no network/firebase).
- `PracticePage.test.tsx` (jsdom): renders the track list + balance + skill + "Start here"
  recommendation; Start composes via `nextScenario` and routes to the player. Mocks `TopNav`,
  `usePractice`, router.

## Gate output

- `npm test` → **54 files, 326 passed**. `npm run typecheck` (`tsc -b`) → clean.
  `npm run build` → built (only the pre-existing phaser/firebase chunk-size warning).
- Dev server: every new module returns HTTP 200 from Vite (`/src/practice/ScenarioPlayer.tsx` etc.).

## Integrity held

LLM never produces traded numbers: P&L + facts come only from `engine.resolve`; the LLM contributes
layout + copy + process score/prose (server-guarded). P&L is display-only and never gates; grading is
process-not-P&L (`gradeRunHybrid` keeps the deterministic guardrail + falls back fully offline). The
deterministic math (`resolve/*`, `rubrics/*`) and the genui core/widget public props are unchanged.

## Deviations / notes

- **WidgetHost submit button styling.** `WidgetHost` is the genui core's only React file and rendered
  a bare unstyled `<button>`. I gave it the app's primary-button classes (styling only — props,
  signature, and behavior unchanged; its test still finds it by role+name). Necessary for the
  impeccable bar without inventing a new submit affordance.
- **`ScenarioDebrief.tsx`, not `Debrief.tsx`.** The component would have collided with the existing
  `debrief.ts` (`curatedDebrief`) on case-insensitive filesystems (Windows), making the default
  import resolve to the wrong module. Named it `ScenarioDebrief` to avoid the collision.
- **Nudges moved to resolution time.** The old flow fired nudges live from the Phaser scene; the
  generative flow has no live scene, so `nudgesForRun` derives them from the resolved decision
  (read-only — it reuses `NUDGES`/`evaluateNudges`/`definedRisk`).
- **Old Phaser scenes left in place.** `src/practice/scenes/*`, `ai/coach.ts`, and `PhaserCanvas`/
  `SceneBus` are no longer used by the player but are still referenced by their own (green) tests and
  by `engines.ts`'s `sceneKind`/`sceneParams` (which `engines.test.ts` covers). Per the brief's
  "prefer leaving them if unsure," I left them rather than risk the suite; they can be retired in a
  follow-up cleanup once `engines.ts` sheds the scene fields.

## What the controller should visually verify

- PracticePage: track list rhythm, skill bars, "Start here" flag, balance header; mobile stacking.
- Player: phase stepper, title/brief hierarchy; charts scenario shows **one** chart (no double),
  controls don't clip/overlap; options leg-builder + payoff; MM quote ladder + mid-path chart.
- Journal gate appears before any result and blocks submit until filled.
- Debrief: score ring + bars + feedback + journal recap + nudges; P&L reads clearly secondary;
  reduced-motion (OS setting) removes the sweeps. Run `/practice` while signed in (route is auth-gated).

## Concerns

- The LLM grade path (`getGradeFn`) is exercised only via deterministic fallback in tests (by design,
  no network); live GPT-5.5 grading should be smoke-checked against the deployed callable.
- `candle-chart` for market-making is built from resampled mids (display only); verify it reads
  sensibly in-browser.
