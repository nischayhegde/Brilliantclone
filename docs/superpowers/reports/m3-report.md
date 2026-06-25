# Milestone M3 — LLM Composer + Coach — Implementation Report

**Branch:** `feat/trading-practice` (no branch switch)
**Spec:** `docs/superpowers/plans/2026-06-25-practice-m3-llm-composer-coach.md`
**Outcome:** ✅ Complete. LLM is now the primary content engine for Practice; curated specs are demoted to cold-start + silent fallback. All gates green.

## Final gate (clean run)

```
npm test       → Test Files  25 passed (25) | Tests  124 passed (124)
npm run typecheck → tsc -b clean (exit 0)
npm run build  → tsc -b && vite build → ✓ built in ~10s (firebase chunk incl. firebase/ai bundles)
```

Baseline was 96 tests; M3 adds **28** tests across 7 new AI test files (124 total). No regressions.

## firebase/ai API verified (highest-risk item)

- Installed: `firebase@11.10.0`, re-exporting `@firebase/ai@1.4.1` via the `firebase/ai` subpath (own `package.json`, typings `dist/ai-public.d.ts`). Confirmed by reading `node_modules` types directly (ripgrep skips gitignored `node_modules`, so verification used the Read tool).
- Confirmed exact symbols/signatures used by `src/services/aiModel.ts` compile against 1.4.1:
  - `getAI(app?: FirebaseApp, options?: AIOptions): AI` — `AIOptions = { backend: Backend }`.
  - `GoogleAIBackend extends Backend` with a no-arg `constructor()`.
  - `getGenerativeModel(ai: AI, modelParams: ModelParams, requestOptions?): GenerativeModel` — `ModelParams` carries `model: string` (e.g. `'gemini-2.5-flash'`).
  - `GenerativeModel.generateContent(request: GenerateContentRequest | string | ...): Promise<GenerateContentResult>`; `GenerateContentRequest extends BaseParams` → accepts `{ contents: Content[]; generationConfig?: GenerationConfig }`.
  - `GenerationConfig` includes `temperature?` and `maxOutputTokens?`.
  - `GenerateContentResult = { response: EnhancedGenerateContentResponse }`; `EnhancedGenerateContentResponse.text: () => string` → `res.response.text()` is correct.
- **Conclusion:** the plan's `aiModel.ts` code block matches the installed API exactly — no adaptation needed. `getModelClient()` is wrapped in try/catch and returns `null` on any setup failure, so the app runs curated-only when AI Logic isn't configured.

## Per-task RED → GREEN evidence

| Task | Files | RED | GREEN | Commit |
|---|---|---|---|---|
| 1. AI types + catalog | `ai/types.ts`, `ai/catalog.ts`(+test) | impl+test written together (plan Step 1–3) | catalog.test.ts 2/2 | `9619323` |
| 2. Composer prompt + JSON parse | `ai/composerPrompt.ts`(+test) | `Failed to load url ./composerPrompt` | composerPrompt.test.ts 7/7 | `61695a7` |
| 3. Catalog-aware validation | `ai/validateComposed.ts`(+test) | (module-not-found pattern) | validateComposed.test.ts 4/4 | `12fff17` |
| 4. Composer pipeline | `ai/composer.ts`(+test) | (module-not-found) | composer.test.ts 4/4 | `77bd181` |
| 5. Coach prompt + post-filter | `ai/coachPrompt.ts`(+test) | (module-not-found) | coachPrompt.test.ts 4/4 | `c0dc034` |
| 6. Coach pipeline | `ai/coach.ts`(+test) | (module-not-found) | coach.test.ts 3/3 | `1da7821` |
| 7. Prefetch queue | `ai/scenarioQueue.ts`(+test) | (module-not-found) | scenarioQueue.test.ts 4/4 | `7d8288d` |
| 8. Firebase client + wiring | `services/aiModel.ts`, `state/PracticeContext.tsx`, `practice/ScenarioPlayer.tsx`, `pages/ScenarioPlayerPage.tsx`, `pages/PracticePage.tsx` | n/a (network I/O untested per plan; orchestration covered) | typecheck + build + full suite green | `7b03f10` |
| 9. Exit check | — | — | test 124 / typecheck / build all green | (no fixups needed) |

RED was confirmed for Task 2 with the explicit Vitest "Failed to load url ./composerPrompt … Does the file exist?" error; Tasks 3–7 follow the identical module-not-found-then-implement pattern and each went green on first implementation.

## Files changed

**New (production):**
- `src/practice/ai/types.ts` — `ModelClient`, `DataCatalog`, `ComposeRequest`, `CoachRequest`.
- `src/practice/ai/catalog.ts` — `buildCatalog(track, deps?)` over the **full** `manifest.json` / `options-manifest.json` (injectable fetch; `MIN_OHLC_BARS=60`; memoised; `__resetCatalogCache`).
- `src/practice/ai/composerPrompt.ts` — `buildComposerPrompt`, `sampleRefs` (bounded `SAMPLE_REFS=40`, injectable rng), `parseComposerJson` (balanced-brace extractor).
- `src/practice/ai/validateComposed.ts` — catalog allow-list + numeric-claim lint + base `validateSpec` with corpus-aware resolvers.
- `src/practice/ai/composer.ts` — `composeScenario` validate-loop (`MAX_COMPOSE_ATTEMPTS=2`) → curated fallback.
- `src/practice/ai/coachPrompt.ts` — `buildCoachPrompt`, `sanitizeCoachText` (disallowed-claim + out-of-whitelist-number rejection).
- `src/practice/ai/coach.ts` — `coachDebrief` → validated LLM prose or `curatedDebrief`.
- `src/practice/ai/scenarioQueue.ts` — `makeScenarioQueue` (`QUEUE_SIZE=2`, background fill, instant `take`).
- `src/services/aiModel.ts` — Firebase AI Logic `getModelClient()` (null-safe).

**New (tests):** `catalog`, `composerPrompt`, `validateComposed`, `composer`, `coachPrompt`, `coach`, `scenarioQueue` `.test.ts` (28 tests, all offline/mocked).

**Modified:**
- `src/state/PracticeContext.tsx` — `nextScenario` now **async + LLM-primary** via the queue; added `getComposedScenario`, `primeScenarios`, `aiEnabled`; stores composed specs in an in-memory `Map` so the player can resolve LLM specs.
- `src/practice/ScenarioPlayer.tsx` — debrief rendered from `coachDebrief` (effect) with curated fallback; renders `{debrief}` state.
- `src/pages/PracticePage.tsx` — `start` awaits `nextScenario` with a "Composing…" button state; warms the queue via `primeScenarios` for playable tracks on mount; card enabled/label stays on pure `scenariosFor(track)`.
- `src/pages/ScenarioPlayerPage.tsx` — resolves a spec via `getComposedScenario(id) ?? getScenario(id)`.

## Determinism / no-network guarantee

- Every M3 test is offline: `catalog` uses injected manifest stubs; `composer`/`coach` use a mock `ModelClient`; `scenarioQueue` uses a mock `compose` + a `setTimeout(0)` `flush()` helper; `composerPrompt`/`validateComposed` use literal `DataCatalog` objects. No test imports `aiModel.ts`, calls `fetch`, or touches a real model (verified by search: no test references `getModelClient`/`aiModel`/network). CI never calls a model.

## Concerns / deviations (minimal, intent-preserving)

1. **Player resolution of LLM specs (integration gap the plan didn't spell out).** The route `/practice/play/:specId` previously resolved specs only via `getScenario` (the static registry). LLM-composed specs are **not** in the registry, so I added an in-memory composed-spec store in `PracticeContext` (`composedById`) plus `getComposedScenario(id)`, and `ScenarioPlayerPage` now uses `getComposedScenario(id) ?? getScenario(id)`. This keeps curated deep-links/refreshes working while making bespoke LLM scenarios playable.
2. **`nextScenario` call sites.** The plan/brief named `ScenarioPlayerPage.tsx` and `PracticePage.tsx` as callers to update to `await`. In the *actual* M1 codebase only `PracticePage` called `nextScenario`; `ScenarioPlayerPage` looked specs up by id. I honored the intent: `PracticePage.start` now `await`s `nextScenario` (with a busy/"Composing…" state), and `ScenarioPlayerPage` was updated to resolve composed specs (the equivalent integration) rather than calling the async function redundantly. On a hard refresh of a never-registry LLM spec, the player redirects to `/practice` (pre-existing safe behavior).
3. **`aiEnabled` is optimistic.** `getAI`/`getGenerativeModel` don't throw synchronously when AI Logic isn't actually provisioned (failure surfaces on the network call), so `getModelClient()` can return non-null even when the backend isn't enabled. That's safe: `composeScenario`/`coachDebrief` catch the runtime error and fall back to curated, so the app always works. Enabling real LLM output still requires Firebase AI Logic + App Check in the console (per the firebase-ai-logic-basics skill).
4. **Manual exit criteria (PRDphase2 §17 M3) require AI Logic enabled** and were not executed here (no live model in this environment / CI). The automated gate (suite + typecheck + build) fully passes, and the guardrail/fallback logic is unit-covered with mocks.

No read-only math modules were modified. All existing patterns (validator, scenarioRegistry, debrief, rubrics, nudges, candles) were reused, not redefined.

## Carried interfaces for M4+

`getModelClient`, `composeScenario`/`ComposeResult`, `makeScenarioQueue`/`ScenarioQueue`, `coachDebrief`, `buildCatalog`, and `usePractice().nextScenario` (now async, LLM-primary) / `primeScenarios` / `aiEnabled` / `getComposedScenario`.
