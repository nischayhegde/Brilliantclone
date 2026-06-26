# WS-D — GPT-5.5 layout composer + hybrid grader pipelines

Branch: `feat/trading-practice`. Status: **complete, all gates green.** The app stayed green:
**root 322 tests pass** (277 pre-existing + 45 new), `tsc -b` clean, `vite build` clean (only the
pre-existing phaser/firebase chunk-size warning). **functions build clean + 39 tests pass**
(24 pre-existing + 15 new). No test touches the network or a real model.

## What was built

GPT-5.5 now composes a validated, interactive **layout** scenario and grades **process (not P&L)**
with written feedback — behind dedicated, hardened server-side callables — with client pipelines, a
prefetch queue that yields layout specs, and a curated layout fallback so the app works fully with AI
disabled. The deterministic engine/rubrics still own every traded number; the LLM emits layout + copy +
real-data ref choices + process scores/prose only. The old Phaser `ScenarioPlayer` + `coach.ts` are
untouched (layout is additive; WS-E swaps the shell to WidgetHost + `gradeRunHybrid`).

## Isomorphic builders + guard (pure, `src/practice/genui/`, mirrored to functions)

All three are React/DOM/Phaser/firebase-free and import only sibling genui modules + `../types`, so
`functions/scripts/copy-shared.mjs` mirrors them verbatim and the server composes/grades/guards with the
**same** code the client trusts.

### `composePrompt.ts`
```ts
buildComposeInstructions(): string                       // stable hard-rules system msg
buildComposeInput(req: ComposeRequest, {rng?}): string   // per-call: catalog sample + allowed kinds + rubric/nudge ids
composeJsonSchema(): Record<string,unknown>              // structured-output schema (strict:false; validateLayout is the hard gate)
COMPOSE_SCHEMA_NAME: 'ComposedScenario'
parseComposedLayout(json): ComposedDraft                 // {title,brief,narrative?,dataRef?,layout,rubricId?,nudgeIds?}
serverConstraints(track, accountBalance): RiskConstraints// single source of truth (re-exported by ai/validateComposed)
pickDataRef(track, catalog, rng?): DataRef               // server-side ref; charts/MM → {candlesKey|ohlcAsset}, options → {chainAsset,decisionDate}
decisionDateFromAsset(chainAsset): string|undefined      // parses __YYYY-MM-DD.json
assembleComposedSpec(req, draft, {rng?,id?}): {ok,spec?,errors}  // server-owned id/source/constraints/dataRef + validated layout
sampleRefs / widgetKindsForTrack / defaultRubricId / defaultNudgeIds
```
`assembleComposedSpec` is the integrity core of compose: server-owned id/source('llm')/constraints/
objective/coachContextKeys/dataRef; model-owned-but-validated title/brief/narrative/layout and the
rubric/nudge **choices** (kept only if in the catalog). It runs `validateLayout` (catalog allow-list +
numeric/disallowed lints) + `layoutFitsTrack`, and lints title/brief/narrative for invented numbers.

### `gradePrompt.ts`
```ts
buildGradeInstructions(): string                         // PROCESS-not-P&L, cite-only-whitelisted-facts
buildGradeInput(req: GradeRequest): string               // decision + REAL candle summary + facts + signals + dimension ids/labels
gradeJsonSchema(dimIds): Record<string,unknown>          // {dimensions:[{id∈enum,score,note}], feedback} (strict:true)
GRADE_SCHEMA_NAME: 'ProcessGrade'
parseLlmGrade(json): LlmGrade
gradeAllowedNumbers(req): number[]                        // candle summary + facts + decision inputs (the citation whitelist)
// types: CandleSummary, RubricDimRef {id,label,weight,deterministic}, GradeRequest, LlmGrade
```
Key boundary: the prompt lists dimension **ids/labels only** — the deterministic guardrail scores are
NEVER shown to the model (so it judges process independently).

### `gradeGuard.ts`
```ts
applyGradeGuard(input: GradeGuardInput): GradeGuardResult
// in:  { raw, rubricDims, pnl, passScore, allowedNumbers?, tolerance? }
// out: { ok:true, score:ProcessScore, feedback } | { ok:false, reason }
DEFAULT_PNL_TOLERANCE = 25
```
1. **clamp** every dimension score to [0,1]; 2. **drop** model-invented dimension ids, **fill** any
rubric dimension the model skipped with the deterministic guardrail score; 3. **sanitize** feedback +
notes (disallowed-claim lint + the `numbersWithinWhitelist` leaf check — unsafe prose is blanked /
feedback falls back to a number-safe detail); 4. the **process-not-P&L sanity bound**: the realized P&L
**sign** may never drag the score in its own direction beyond `tolerance` vs the deterministic total —
`pnl<0 && llmTotal < det-tol` (a loss tanked below process merit) or `pnl>0 && llmTotal > det+tol`
(a win inflated above process merit) ⇒ `{ok:false}` → caller uses the deterministic rubric. Generosity
in the non-P&L-aligned direction is allowed (a loss scored *above* its process merit is fine).

### `copyLint.ts` (leaf, extended)
Added `NUMBER_TOKEN_PATTERN`, `extractNumberTokens(text)`, `numbersWithinWhitelist(text, allowed, eps)`
— the shared whitelist check the grade-feedback sanitizer reuses (same leaf the compose lints use).

## Server callables (`functions/src/`)

`genui.ts` gained the pure orchestrators (injected `CallModelFn` → fully offline-testable; **never sends
`temperature`** — GPT-5.5 uses `reasoning.effort`):
```ts
runCompose(req, callModel, {rng?,attempts?}): Promise<{spec} | {fallback:true}>   // 2 attempts, structured output, assemble+validate
runGrade(req, callModel): Promise<{score,feedback} | {fallback:true}>             // structured output → applyGradeGuard
```
`index.ts` exposes them as auth-gated, rate-limited callables (reusing the WS-C `limiter` + secret):

- **`composeScenario({track,tier,accountBalance,catalog}) → {spec} | {fallback:true}`** — auth +
  per-uid rate limit → `validateComposeInput` → `runCompose` (prompt + schema built server-side; the
  model output is parsed + assembled + validated server-side; client never sees prompt/raw output).
- **`gradeRun({track,passScore,decision,outcomeFacts,candleSummary,signals,rubricDims}) → {score,feedback} | {fallback:true}`**
  — auth + rate limit → `validateGradeInput` → `runGrade` (structured grade → clamp/drop/sanitize +
  process-not-P&L bound vs the `rubricDims` deterministic guardrail).

`guards.ts` gained `validateComposeInput` / `validateGradeInput` (+ `MAX_CATALOG_ENTRIES` abuse cap).

## Client pipelines (`src/`)

- `services/aiModel.ts`: `getComposeFn()` / `getGradeFn()` — typed `httpsCallable` wrappers for the two
  callables; return `null` gracefully when unwireable; per-call failures reject (caught downstream).
- `practice/ai/composer.ts`: `composeScenario(req, transport: ComposeTransport | null)` now calls the
  server callable (retry/validation are server-side) and **guarantees a `layout`** via `ensureLayout`
  (`defaultLayoutFor`); falls back to a curated layout spec on `{fallback:true}`, throw, or no transport.
- `practice/ai/grade.ts` (new): `gradeRunHybrid(input, transport: GradeTransport | null)` always computes
  the deterministic rubric first (guardrail + fallback), calls `gradeRun`, and returns the LLM
  score+feedback or the deterministic rubric + `curatedDebrief` on any failure/fallback. Plus
  `summarizeCandles(candles): CandleSummary` (compact real-slice facts = the citation whitelist).
  ```ts
  gradeRunHybrid(
    { spec, decision, outcome, candleSummary, signals?, journal? },
    transport: GradeTransport | null,
  ): Promise<{ score: ProcessScore; feedback: string; source: 'llm' | 'deterministic' }>
  ```
- `state/PracticeContext.tsx`: the prefetch queue's `compose()` uses `getComposeFn()` (→ server compose)
  and `composeScenario(req, null)` for the curated-only path; `aiEnabled = getComposeFn() !== null`.
- `practice/ai/scenarioQueue.ts`: unchanged logic (doc clarified) — every buffered/`take()`-d spec now
  carries a layout because `composeScenario` guarantees one, so prefetch yields WidgetHost-ready specs.
- `practice/ai/validateComposed.ts`: kept as a client defensive validator; its `serverConstraints` now
  re-exports the isomorphic source (single source of truth). Removed the superseded
  `ai/composerPrompt.ts(+test)` (its role moved to `genui/composePrompt.ts`).

## Curated fallback layouts
`composeScenario` (client) wraps every served spec in `ensureLayout`: a curated/registry spec with no
`layout` gets `defaultLayoutFor(track)` (WS-A's number-free single-scene layout that passes
`validateLayout` with an empty catalog). So offline/AI-disabled play, the cold-start, and every silent
fallback all yield a renderable layout — no errors.

## Test evidence (no network / no model)
- `genui/composePrompt.test.ts` (18): instructions/input/schema/parse; `pickDataRef` + date parse;
  `assembleComposedSpec` builds server-owned constraints/dataRef, overrides model id/source/rubric/nudge
  (I1/I3), rejects invented-number briefs + track-invalid widgets, prepends narrative, derives options date.
- `genui/gradePrompt.test.ts` (7): process-over-outcome instructions; input lists dimension labels but
  **never the deterministic scores**; schema enum; `gradeAllowedNumbers`.
- `genui/gradeGuard.test.ts` (10): clamp; drop invented dims; fill skipped dims; feedback/note sanitation;
  and the **process-not-P&L** assertions — rejects a P&L-penalized loss, rejects a P&L-rewarded win, allows
  generosity, and the **guardrail test asserting a well-processed loss is never graded below a
  poorly-processed win** (both contaminated grades rejected → deterministic ordering preserved: 90%>15%).
- `genui/copyLint.test.ts` (5): number-token extraction + whitelist (sign-agnostic).
- functions `genui.test.ts` (+7): `runCompose` assembles a server-owned spec, **does NOT send
  temperature**, retries-then-falls-back, offline fallback; `runGrade` returns sanitized score+feedback,
  **falls back on a P&L-contaminated grade**, offline fallback. `guards.test.ts` (+8): compose/grade input
  validation. (`callModel` is injected/mocked — no network.)
- `services/aiModel.test.ts` (+4), `ai/composer.test.ts` (5, rewritten), `ai/grade.test.ts` (7): transport
  wiring/caching/graceful-null/reject; curated layout fallback; hybrid grade request shape + fallbacks.

## Gate output
- Root `npm test` → **52 files, 322 passed**. `npm run typecheck` (`tsc -b`) → clean.
  `npm run build` → built (only pre-existing chunk-size warning).
- `functions/`: `npm run build` (copy:shared + tsc) → clean; `npm test` → **3 files, 39 passed**.
- Client bundle scan (`dist/assets`): `OPENAI_API_KEY`=0, `gpt-5.5`=0, `responses.create`=0;
  `composeScenario` callable name present (1, expected); `gradeRun` absent (tree-shaken — wired in WS-E).

## Integrity held
LLM emits layout + copy + real-data ref choice + process scores/prose ONLY. Server builds the prompt +
dataRef + constraints, validates the layout against the catalog allow-list + numeric lint
(`assembleComposedSpec`), and clamps/sanitizes/process-bounds the grade (`applyGradeGuard`). The
deterministic engine/rubrics own all math and are the guardrail/fallback. The app grades + plays fully
with AI disabled.

## Concerns / notes for downstream (WS-E / WS-F)
- **Catalog is client-built, server-enforced.** `composeScenario` receives the catalog from the client
  (which reads the manifests via `buildCatalog`) because the data files aren't in the functions
  deployment. The server still **enforces** the allow-list (`validateLayout`) and **builds the dataRef +
  constraints** server-side, and the numeric lint + deterministic-load-by-ref guarantees hold regardless,
  so no invented number can slip through. WS-F can mirror the manifests/candle-keys index into functions
  for a fully server-sourced allow-list. The dedicated boundary (prompt + raw model output stay
  server-side) is fully achieved today.
- **`gradeRun` not yet wired into a player** — `ScenarioPlayer` still uses the Phaser flow + `coach.ts`
  (unchanged, green). WS-E should render `WidgetHost`, aggregate `decision`/`signals`, call
  `summarizeCandles` on the revealed slice, and replace the coach debrief with `gradeRunHybrid` +
  `getGradeFn()` (per-dimension LLM scores + feedback + P&L display-only).
- **Charts/MM dataRef omits split/reveal indices** (server picks the key; the resolver defaults the
  window). Variety across scenarios still comes from the asset choice + tier; WS-F can pass per-ref
  lengths if a randomized window is wanted.
- **Compose schema is `strict:false`** (free-form `config`); `validateLayout` is the real guardrail. The
  grade schema is `strict:true` with an id enum.
- The compose `id` is `llm-<track>-<base36 rng>` — fine for a session; persistence/uniqueness is not a
  concern (LLM specs live only in `composedById`, never the static registry).
