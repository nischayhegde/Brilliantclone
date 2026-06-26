# Phase 2 Review — Trading Practice (OpenAI GPT-5.5 + GenUI + Hybrid Scoring + Redesign)

Branch: `feat/trading-practice` · Diff: `9ea182f..HEAD` (102 files, +13,340 / −446)
Reviewer: final read-only review against the rebuild plan + `PRDphase2.md` invariants.

## Verdict
**Fix-then-ship.** No Critical breaches; the integrity model (deterministic math owns all
traded numbers; LLM emits layout/copy/refs/process-scores only; server-side validation +
grade guard) is implemented correctly and the secret boundary is clean. Three Important
hardening items should land before shipping the live backend.

## Gate results
| Gate | Result |
|---|---|
| `npm test` | PASS — 55 files, 333 tests |
| `npm run typecheck` (`tsc -b`) | PASS (exit 0) |
| `npm run build` (`tsc -b && vite build`) | PASS — chunk-size warning only (index 822 kB, phaser 1.48 MB); non-fatal |
| `npm --prefix functions run build` (prebuild copy-shared + `tsc`) | PASS (exit 0) |

## Invariant scorecard
1. LLM never produces a traded number — **PASS (server)**, with a client defense-in-depth gap (Important #1).
2. Grade process, not P&L — **PASS**. `applyGradeGuard` clamps [0,1], drops invented dims, fills skipped dims from the deterministic guardrail, sanitizes prose, enforces the P&L-aligned sanity bound (loss can't be dragged below / win above process merit), and falls back to the deterministic rubric. P&L is display-only in the debrief.
3. Secure boundary — **PASS for the secret** (no OpenAI key/SDK in the client bundle; build confirms only `firebase`/`phaser`/app chunks). Callables are auth-gated + per-uid rate-limited + token-capped. Two abuse-surface caveats below (Important #2, #3).
4. Curated fallback with AI disabled — **PASS**. Every served spec gets a layout (`ensureLayout` → `defaultLayoutFor`), per-call failures fall back to curated, deterministic rubric + curated debrief grade offline.
5. DEV-only `/preview` — **PASS**. `import.meta.env.DEV` ternary collapses to `null` in prod; the build emits no preview chunk (tree-shaken).
6. A11y + determinism — **PASS**. Widgets keyboard-operable (role="slider"/radiogroup, arrows/Home/End, focus-visible rings, aria-value*), reduced-motion aware; tests fully offline (mocked callables, jsdom per-file).

---

## Critical
None.

## Important

### IMP-1 — Client renders server-returned LLM specs without re-validating (Invariant 1 "BOTH client and server")
- `src/practice/ai/composer.ts` — on `{spec}` the client only runs `ensureLayout` and trusts it (`source:'llm'`). `validateComposed`/`validateLayout`/`layoutFitsTrack` are not called on the live LLM path.
- `src/practice/ai/grade.ts` — trusts `gradeRun`'s `{score, feedback}` without re-running `applyGradeGuard`/prose sanitization client-side.
- `src/practice/ScenarioPlayer.tsx` then renders `spec.layout` directly in `WidgetHost`; an out-of-registry `kind` would throw in `decision.ts`.
- Fix: in client `composeScenario`, run `validateComposed(res.spec, catalog)` before trusting; on failure fall back to curated. In `gradeRunHybrid`, re-apply `applyGradeGuard` (isomorphic) before accepting LLM scores/feedback.

### IMP-2 — `composeScenario` trusts a client-built catalog with unbounded prompt-bearing fields
- `functions/src/guards.ts` `validateComposeInput` caps the count of `candlesKeys/ohlcAssets/chainAssets` (≤5000) but not `rubricIds`/`nudgeIds` count, per-string length, or total input size.
- `src/practice/genui/composePrompt.ts` interpolates `rubricIds`/`nudgeIds` in full into the prompt.
- Fix: cap `rubricIds`/`nudgeIds` count + per-string length; add a total input-char ceiling; ideally derive rubric/nudge allow-lists server-side.

### IMP-3 — Generic `aiRespond` GPT-5.5 proxy is deployed but unused by the app
- `functions/src/index.ts` (`aiRespond`) + `src/services/aiModel.ts` (`getModelClient`) — referenced only by tests; the app composes via `composeScenario` and grades via `gradeRun`. Same for `coach.ts`/`coachPrompt.ts`.
- Fix: remove `aiRespond` + `getModelClient` (+ dead `coach.ts`/`coachPrompt.ts`), or constrain a generic transport to known schemas/prompts.

## Minor
- **MIN-1** `src/practice/genui/copyLint.ts` `NUMERIC_CLAIM_PATTERN` misses single-digit numbers ("risk 5%").
- **MIN-2** Rules-of-Hooks: `PriceLines.tsx`, `OptionLegBuilder.tsx` call hooks after an early `return null`. Keep hooks unconditional; gate only the output.
- **MIN-3** Dead code: old Phaser `src/practice/scenes/*` + vestigial `TrackEngine.sceneKind/sceneParams` referenced only by their own tests; plus unused `coach*`. Delete + trim.
- **MIN-4** `functions/src/genui.ts` `Number(pnl ?? 0)` can yield NaN; `validateGradeInput` should assert finite `pnl`.
- **MIN-5** `aiEnabled` is effectively always true (`httpsCallable` rarely throws); functionally fine (per-call try/catch → curated) but misleading.

## Notable strengths
- Isomorphic core genuinely shared via `functions/scripts/copy-shared.mjs`; functions build imports the same `validateLayout`/`applyGradeGuard`.
- Server owns every grading-relevant field: `assembleComposedSpec` rebuilds constraints/objective/dataRef/source, keeps only catalog-validated rubric/nudge choices; options `decisionDate` derived from the asset path, never trusted.
- Malformed-model-JSON paths are crash-safe (parse in try/catch; retry→fallback→deterministic).
- Resolution math stays deterministic and real-data-bound; debrief makes P&L explicitly secondary.

---

## Fixes applied (fix wave, branch `feat/trading-practice`)

Gates after the wave: root `npm test` **325 passing / 53 files**, `npm run typecheck` PASS, `npm run build` PASS (same pre-existing chunk-size warning, no preview chunk); functions `npm run build` PASS, functions `vitest` **34 passing / 3 files**. No network in any test.

### IMP-1 — Client re-validates server LLM output (defense-in-depth; Invariant 1 "BOTH sides validate") — FIXED
- `src/practice/ai/composer.ts`: after `composeScenario` returns `{spec}`, the client now `ensureLayout`s then re-validates the layout with the SAME isomorphic checks the server used — `validateLayout(layout, catalog)` + `layoutFitsTrack(layout, track)` — before trusting it (`source:'llm'`). Any failure falls back to the curated spec, identical to the error path. An out-of-registry `kind` can no longer reach `decision.ts`/`WidgetHost`.
- `src/practice/ai/grade.ts`: `gradeRunHybrid` now re-applies the isomorphic `applyGradeGuard(...)` to the server's `{score, feedback}` (rebuilding the `LlmGrade` shape from the returned dimensions) — clamp[0,1], drop invented dims, sanitize prose, enforce the process-not-P&L bound vs the deterministic rubric. If it can't be made valid it falls back to the deterministic rubric + curated debrief.
- Tests added: composer falls back to curated on an out-of-registry kind AND on a track-invalid widget; grade clamps an out-of-[0,1] dimension and drops an unknown dimension via the guard. The pre-existing "server LLM score" grade test was updated to a full, in-range score (the guard is idempotent on a well-formed grade).

### IMP-2 — Bound `composeScenario` input (cost + prompt-injection) — FIXED
- `functions/src/guards.ts` `validateComposeInput`: added `MAX_ID_LIST_ENTRIES=200` (rubricIds/nudgeIds count — they're interpolated in full into the prompt), `MAX_CATALOG_ENTRY_CHARS=64` (per-string cap across every array), and `MAX_TOTAL_CATALOG_CHARS=200_000` (total-char ceiling across all arrays). Existing `MAX_CATALOG_ENTRIES=5000` count cap retained. Real catalog (~bundled candle keys + a few hundred OHLC paths) stays well under all caps.
- Tests added for each new cap (over-long id list, over-long entry, total-size ceiling). Catalog trust model unchanged (just bounded).

### IMP-3 — Remove the unused generic proxy + dead AI code — FIXED
- Confirmed via grep that `aiRespond`, `getModelClient`, and `coach.ts`/`coachPrompt.ts` were referenced ONLY by their own tests (the app composes via `composeScenario`/`getComposeFn` and grades via `gradeRun`/`getGradeFn`; `PracticeContext`/`ScenarioPlayer` import only those). Deleted:
  - `functions/src/index.ts` `aiRespond` callable (+ its `AiRespondResponse`); trimmed `validateAiRespondInput`, `clampTemperature`, `AiRespondInput`, `ValidationOutcome`, `JSON_SCHEMA_NAME_RE`, `MAX_INPUT_CHARS`, and the now-unused `JsonSchemaSpec` import from `functions/src/guards.ts` (+ their tests).
  - `src/services/aiModel.ts` `getModelClient` (+ its request/response types + cache); removed the `getModelClient` test block. `getComposeFn`/`getGradeFn` and the auth/rate-limit/token-clamp helpers used by `composeScenario`/`gradeRun` are kept.
  - `src/practice/ai/coach.ts`, `coach.test.ts`, `coachPrompt.ts`, `coachPrompt.test.ts`; removed the now-unused `ModelClient`/`CoachRequest` types from `src/practice/ai/types.ts`. Updated a stale `aiRespond` comment in `src/lib/firebase.ts`.

### MIN-1 — numeric-claim lint single digits — FIXED
- `src/practice/genui/copyLint.ts` `NUMERIC_CLAIM_PATTERN` now also catches single-digit percentages (`\b\d+(?:\.\d+)?\s?%`) and ratios (`\b\d+\s*(?:[-\s]*to[-\s]*|:)\s*\d+\b`, e.g. `5%`, `2.5%`, `5-to-1`, `5 to 1`, `5:1`). `$`-amounts incl. a single digit were already covered. Bare lone single digits are deliberately NOT flagged (avoids over-blocking prose). Tests added for "risk 5%" / "5-to-1" flagged and clean prose passing.

### MIN-2 — Rules of Hooks — FIXED
- `src/practice/genui/widgets/PriceLines.tsx` and `OptionLegBuilder.tsx`: all hooks now run unconditionally above the `if (widget.kind !== '…') return null` guard; only the rendered output is gated. `OptionLegBuilder` reads its config defensively (`widget.kind === '…' ? widget.config : undefined`) so the config-dependent `useResolvedChain`/`requireDefinedRisk` stay above the guard. Behavior unchanged (widget tests still green).

### MIN-4 — finite pnl — FIXED
- `functions/src/guards.ts` `validateGradeInput` now rejects any non-finite numeric `outcomeFacts` value and requires `pnl` (when present) to be a finite number (never a string that would coerce to NaN in `Number(req.outcomeFacts.pnl ?? 0)`). Test added.

### Deferred
- **MIN-3** (delete old Phaser `src/practice/scenes/*` + trim `TrackEngine.sceneKind/sceneParams`): left as-is. Still referenced by real code/tests — `src/practice/engines.ts` (`sceneKind`/`sceneParams` on every `TrackEngine`, `sceneKey:'MarketMakeScene'`), `src/practice/scenes/index.ts` (scene registry), and `engines.test.ts`/`scenes/index.test.ts`. Removal needs a `TrackEngine` contract change across multiple files/tests, so it isn't the clean/low-risk cleanup the task scoped; deferred to avoid breaking green.
- **MIN-5** (`aiEnabled` semantics): left as-is per scope — functionally fine (per-call try/catch → curated); only noted.
