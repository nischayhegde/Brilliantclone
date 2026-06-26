# Practice Rebuild — OpenAI GPT-5.5 + Generative-UI Interaction Kit + Hybrid Scoring + Full Redesign

Status: planned. Branch: `feat/trading-practice` (continues from the M0–M6 build).
Method: subagent-driven-development relay (one workstream per implementer, verify + review between).

## Why
The first cut shipped only a few static, partly-broken Phaser interactions and a basic look, wired to Firebase AI Logic (Gemini). This rebuild makes **GPT-5.5 the engine that composes each scenario's interactive layout AND grades process**, behind a secure server boundary, with a polished, reliable, accessible UI.

## User decisions (binding)
1. **Server boundary:** Firebase **Cloud Functions** callable; OpenAI key as a Functions **secret**. Local dev via the Functions emulator.
2. **Scoring:** **Hybrid** — deterministic math owns every traded number; **GPT-5.5 is the primary process evaluator**, fed the real candle slice + deterministic outcome facts; server clamps + deterministic guardrail/fallback.
3. **UI:** **Full redesign** of all 3 tracks + the scenario-player shell.
4. **Model:** `gpt-5.5` via the **Responses API** (`/v1/responses`, `instructions`+`input`, `output_text`, structured outputs, `reasoning.effort` default `medium`).
5. **Generative UI:** LLM composes from a **validated interaction kit** (NOT raw code). **Rich** starter kit (~10–12 widgets) across all tracks.

## Non-negotiable integrity rules (carry forward from M0–M6 + final review)
- **The model never produces a traded number.** Numbers flow: GPT-5.5 → (layout spec + copy + real-data refs) → validate against widget registry + catalog allow-list + numeric-claim lint → deterministic engine loads REAL data → deterministic resolve (fills, P&L, payoff, BS-as-estimate, MM sim) → facts → GPT-5.5 (process score + prose only) → server clamp + sanitize.
- **Grade process, not P&L.** The grader prompt instructs process-over-outcome; the deterministic rubric remains as guardrail/fallback and as a sanity bound (a well-processed loss must not score below a poorly-processed win). Never feed realized P&L sign as a scoring target.
- **Server boundary:** OpenAI key only in the Functions secret; callables require auth (signed-in users). Client bundle holds no provider key.
- **Curated fallback:** the app fully works with AI disabled/offline — curated layout specs + deterministic rubric scoring + curated debrief. No errors, ever.
- **Determinism in tests:** no test hits the network or a real model. Mock the callable + the OpenAI client; validate with literal specs/catalogs.
- **A11y + reduced motion + disclaimers** preserved and extended to all new widgets (keyboard-operable, ARIA, `prefers-reduced-motion`, "illustrative; math exact" labels).

## Single source of truth: isomorphic genui core
The widget **schema + config validators + prompt builders + layout validation** must be **pure and isomorphic** (no React, no DOM, no Phaser, no firebase) so BOTH the Vite client (render + validate) and the Cloud Functions runtime (compose + validate) import the SAME code. Put them in `src/practice/genui/` (pure) and configure `functions/` to compile/import them (tsconfig `include`/`paths`, or a build copy step — implementer picks the most robust for the toolchain and documents it). No schema drift between client and server.

---

## Architecture

### Generative-UI model
- `ScenarioSpec` gains `layout: Widget[]` (LLM-authored, validated). Existing fields (track, tier, dataRef(s), rubricId, nudgeIds, objective, title, brief, source) stay.
- `Widget` = discriminated union `{ id: string; kind: WidgetKind; config: <kind-specific, validated> }`.
- **WidgetHost** renders a layout, owns per-widget UI state, aggregates widget outputs into:
  - the track's **structured Decision** (the math inputs the deterministic resolver needs), and
  - a bag of **process signals** (extra widget answers: multiple-choice, annotations, confidence) used by nudges + the LLM grader, NOT by the math.
- The deterministic engine/resolvers (charts/options/market-making) are unchanged — WidgetHost maps widget outputs to their existing `Decision` shapes (`ChartsDecision`, `OptionsDecision`, `MarketMakingDecision`). Extra widgets enrich the experience + grading without touching the math.

### Interaction kit (rich, ~10–12)
Each widget = a tested component + a pure config schema + a pure `collect()` that returns its typed output. Starter kit:
1. `narrative` — LLM prose / scenario framing (no input).
2. `news-headline` — a framed headline/context card (no input; copy only).
3. `candle-chart` — renders the REAL candle slice; exposes price/time scales for overlays. (Rendering only; interactions live in overlay widgets.) Reuse candle math from `src/engine/scenes/CandleChartScene`/`src/data/candles`, but render via React + Canvas/SVG so overlays + a11y are reliable. Phaser reuse allowed for rendering only.
4. `annotate-chart` — user marks a level/zone/trendline on the chart (SVG overlay, draggable + keyboard); output = annotation(s). Process signal.
5. `direction-choice` — long / short / skip (configurable allowed set). → Decision.direction.
6. `price-lines` — draggable entry/stop/target lines on the chart (SVG overlay, keyboard-adjustable); config can `require` a subset + `minRR`. → Decision entry/stop/target.
7. `size-slider` / `risk-slider` — position size or % risk; config bounds. → Decision.size.
8. `confidence` — 0–100 confidence slider. Process signal.
9. `multiple-choice` — LLM-authored question + options about the setup. Process signal.
10. `option-leg-builder` + `payoff-graph` — build defined-risk option legs from the REAL chain; live payoff preview (deterministic). → OptionsDecision legs.
11. `quote-ladder` — MM two-sided quote (bid/ask width, size, inventory cap). → MarketMakingDecision.
12. `checklist` — LLM-composed pre-trade checklist; user ticks. Process signal.

All interactive widgets: reliable pointer + **keyboard** control, visible focus, ARIA labels, reduced-motion aware. No overlapping controls (the current options bug). Test each widget's `collect()` + config validator as pure units; smoke-test rendering.

### Backend (Firebase Cloud Functions, TS v2, Node 20)
- `functions/` package: `firebase-functions` v2, `firebase-admin`, `openai` (official SDK). Secret `OPENAI_API_KEY` via `defineSecret`.
- Callables (auth required; rate-limit per uid):
  - `composeScenario({ track, tier, accountBalance })` → builds catalog from manifests, derives a real `dataRef`, calls GPT-5.5 (Responses API, **structured output JSON schema** = the layout spec), validates against the genui schema + catalog allow-list + numeric-claim lint; retry once; returns `{ spec }` or `{ fallback: true }`.
  - `gradeRun({ spec, decision, outcomeFacts, candleSummary, processSignals, rubricDims })` → calls GPT-5.5 with the deterministic facts + compact real candle-slice summary; **structured output** = `{ dimensions: {id, score 0..1, note}[], feedback }`; server **clamps [0,1]**, sanitizes prose (disallowed claims + out-of-whitelist numbers), enforces the process-not-P&L sanity bound vs the deterministic rubric; returns `ProcessScore` + prose.
- `firebase.json`: add `functions` config + emulator. No hosting rewrite needed (callables use the SDK).
- Client transport: `src/services/aiModel.ts` becomes an OpenAI-backed `ModelClient`/callable client via `httpsCallable` (replaces the Gemini client). `getModelClient()` returns null gracefully → curated fallback.

### Hybrid grading flow (ScenarioPlayer)
1. WidgetHost aggregates → structured `Decision` + process signals.
2. Deterministic `engine.resolve(spec, data, decision)` → exact `outcome` (P&L, facts). **(unchanged math)**
3. `gradeRun(...)` → LLM per-dimension process scores + written feedback (fed real candle summary + facts + process signals).
4. Client guardrail: clamp, fall back to deterministic `getRubric(...)` if AI down; keep P&L display-only.
5. Persist `PracticeRun` (now includes process signals + which widgets appeared + the score source).

---

## Workstreams (relay order)

### WS-A — Generative-UI core (pure/isomorphic backbone)
Files: `src/practice/genui/types.ts`, `schema.ts` (pure config validators + `validateLayout(layout, catalog)`), `registry.ts` (kind → metadata + collect signature; no React yet), `decision.ts` (`aggregateDecision(track, layout, widgetOutputs)` → `{ decision, signals }`), plus `WidgetHost.tsx` (renders by kind via an injected component map so it stays testable). Extend `ScenarioSpec` with `layout`. Update `validateSpec`/`validateComposed` to validate layouts. TDD all pure modules. Keep existing tests green (existing curated specs get a default single-widget layout shim so nothing breaks).

### WS-B — Interaction kit widgets (rich)
Files: `src/practice/genui/widgets/*` (the ~12 above) + registry wiring (kind → component). Each: pure config validator + pure `collect()` (unit-tested), accessible reliable component (smoke-tested), reduced-motion aware. `candle-chart` exposes scales; `price-lines`/`annotate-chart` render as SVG overlays driven by those scales (pointer + keyboard). Reuse `optionMath`/`payoffMath`/`book` (read-only) for `option-leg-builder`/`payoff-graph`/`quote-ladder`.

### WS-C — Backend + OpenAI GPT-5.5 + transport
Files: `functions/` (package.json, tsconfig, src/index.ts with callables), `firebase.json` (+functions+emulators), `.env.example` (document `OPENAI_API_KEY` as a Functions secret, NOT a VITE var), `src/services/aiModel.ts` (callable-backed ModelClient). Verify the `openai` SDK Responses API shape at build time (`responses.create({ model:'gpt-5.5', instructions, input, text:{format:{type:'json_schema',...}} })`, read `output_text`). Auth-gate callables. No secret in client. Provide a mock for tests. (Real calls need the user to enable Blaze + set the secret — document as a prerequisite; build/tests must pass without it.)

### WS-D — Composer + hybrid grader (server-side) + queue/fallback
Files: shared prompt builders in `src/practice/genui/prompt.ts` (compose) + `src/practice/genui/gradePrompt.ts` (grade) [pure, isomorphic]; functions wire them into the callables; client `composer`/`coach`→`grader` pipelines call the callables; update the prefetch `scenarioQueue` to compose layout specs; curated fallback layouts. Hybrid score path in ScenarioPlayer. TDD with mocked callable + literal specs; assert the process-not-P&L sanity bound and the validation/sanitize guardrails.

### WS-E — Full UI redesign (impeccable)
Redesign the scenario-player shell, `PracticePage`, the WidgetHost layout, and the debrief (overall + per-dimension LLM scores + written feedback + P&L display). Follow `.claude/skills/impeccable` (read register reference `product.md` + existing tokens in `src/index.css`/theme; verify contrast; intentional motion; no AI-slop tells). Reliable, responsive, accessible. Verify in the browser (dev server + screenshots).

### WS-F — Integration + verification
Curated fallback layouts for all tracks/tiers; end-to-end play of each track with AI mocked AND (if key available) live; `npm test`/`typecheck`/`build` green; functions build/lint; browser smoke test of all three tracks; final whole-branch review + fix wave.

## Prerequisites the USER must do for LIVE GPT-5.5 (not needed for build/tests)
- Enable the **Blaze** plan on the `brilliantclone` Firebase project (Cloud Functions requires it).
- Provide an **OpenAI API key** and set it as a Functions secret: `firebase functions:secrets:set OPENAI_API_KEY`.
- Deploy functions (`firebase deploy --only functions`) or run the emulator for local live testing.

## Definition of done
All three tracks play end-to-end with GPT-5.5-composed, validated, unique interactive layouts; hybrid process scoring with written feedback; deterministic math exact; secure server boundary; polished accessible UI; curated fallback flawless; full suite + functions build green; browser-verified.
