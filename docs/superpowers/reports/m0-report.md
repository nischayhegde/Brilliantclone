# Milestone M0 (Foundations) — Implementation Report

**Feature:** Trading Practice
**Plan:** `docs/superpowers/plans/2026-06-25-practice-m0-foundations.md`
**Branch:** `feat/trading-practice`
**Date:** 2026-06-25

---

## Summary

Implemented the full M0 foundation for Practice mode exactly as specified by the plan, task by task, in order, using TDD (RED → GREEN) for every pure module. M0 stands up the shared types, the deterministic spec validator (trust gate), the scenario registry, the pure account/skill/tier reducer, the nudge catalog, the rubric registry, the Firestore practice service, the React `PracticeContext`, the `/practice` route + landing shell + nav link, and the additive Firestore security rules.

**Final state:** `npm test` → **61 tests passing (8 files)**; `npm run typecheck` → clean; `npm run build` (`tsc -b && vite build`) → clean. Baseline (32 tests) preserved; **29 new tests** added by M0.

---

## Per-task results

### Task 1 — Shared Practice types (`src/practice/types.ts`)
- **Type:** pure type declarations (no test by design).
- **Action:** Created the file verbatim from the plan: `Track`, `ChartsDecision`/`OptionLegDecision`/`OptionsDecision`/`MarketMakingDecision`, `Decision`, `RiskConstraints`, `ScenarioObjective`, `NudgeRule`, `DataRef`, `ScenarioSpec`, `DimensionScore`, `ProcessScore`, `ScenarioOutcome`, `Rubric`, `PracticeRun`, `Feeling`.
- **Verify:** `npm run typecheck` → PASS.
- **Commit:** `c6c0973`.

### Task 2 — Pure account + skill reducer (`src/practice/account.ts` + test)
- **RED:** Wrote `account.test.ts` (7 tests), ran `npx vitest run src/practice/account.test.ts` → FAIL: `Failed to load url ./account` (module not found) — expected.
- **GREEN:** Wrote `account.ts` (`STARTING_BALANCE`, `RUIN_FLOOR`, `SKILL_ALPHA`, `TIER_THRESHOLDS`, `initialAccount`, `tierFor`, `isRuined`, `accountReducer`). Re-ran → **7 passed**.
- **Commit:** `7859c9c`.

### Task 3 — Nudge catalog (`src/practice/nudges.ts` + test)
- **RED:** Wrote `nudges.test.ts` (5 tests) → FAIL: module not found — expected.
- **GREEN:** Wrote `nudges.ts` (`NudgeContext`, `Nudge`, `NUDGES` with `sizing`/`no-stop`/`undefined-risk`/`overtrading`, `evaluateNudges`). Re-ran → **5 passed**.
- **Commit:** `25b55de`.

### Task 4 — Rubric registry + noop rubric (`src/practice/rubrics/index.ts` + test)
- **RED:** Wrote `rubrics/index.test.ts` (5 tests) → FAIL: module not found — expected.
- **GREEN:** Wrote `rubrics/index.ts` (`weightedTotal`, `noop` rubric, `RUBRICS`, `getRubric`). Re-ran → **5 passed** (incl. `weightedTotal` → 67 for the 2:1 weighting case, throws on unknown id).
- **Commit:** `34a40ec`.

### Task 5 — Deterministic spec validator (`src/practice/validator.ts` + test)
- **RED:** Wrote `validator.test.ts` (7 tests) → FAIL: module not found — expected.
- **GREEN (1st run):** 6/7 passed; the "accepts a well-formed spec" case FAILED. Root cause: the plan's `valid` fixture used `revealToIndex: 60`, but the **first** bundled candles key (`asctri_quiz_AMD`) has only **52** candles, so the validator (correctly) rejected `revealToIndex > n`. The validator logic is correct — the fixture's index assumed a longer series than the first real key provides.
- **Fix (minimal, noted deviation):** changed the test fixture's `revealToIndex` from `60` → `50` (kept `splitIndex: 30`), keeping it in-range for the first real key while preserving the test's intent. Re-ran → **7 passed**.
- **Commit:** `090ab88`.

### Task 6 — Curated scenario registry (`src/practice/scenarioRegistry.ts` + test)
- **RED:** Wrote `scenarioRegistry.test.ts` (5 tests) → FAIL: module not found — expected.
- **GREEN:** Wrote `scenarioRegistry.ts` with one seed `charts-tier1-seed` spec anchored on `Object.keys(CANDLES)[0]`, with `splitIndex = floor(len*0.6)` and `revealToIndex = len` (computed from the real series length, so it is always in-range and passes `validateSpec`). Re-ran → **5 passed** (incl. the build-time "every curated spec passes the validator" contract).
- **Commit:** `975edcf`.

### Task 7 — Firestore practice service (`src/services/practiceService.ts`)
- **Type:** thin Firebase I/O wrapper (no unit test by design, mirrors untested `userService.ts`).
- **Action:** Wrote `getOrCreatePracticeData`, `persistPracticeState`, `appendPracticeRun`, `loadRecentRuns` — additive merge-writes under `practice.account` + `practiceHistory` subcollection; never creates the user doc.
- **Verify:** `npm run typecheck` → PASS.
- **Commit:** `c0c1920`.

### Task 8 — PracticeContext (`src/state/PracticeContext.tsx`)
- **Type:** provider I/O (no unit test by design; pure reducer covered by Task 2).
- **Action:** Wrote `PracticeProvider` + `usePractice` mirroring `LessonProgressContext` (hard reset on user change, load account + recent runs, optimistic `applyResult`, `nextScenario` with tier-aware pool + recent-repeat avoidance).
- **Verify:** `npm run typecheck` → PASS.
- **Commit:** `2152873`.

### Task 9 — Practice landing page + routes + nav
- **Action:** Created `src/pages/PracticePage.tsx` (balance header + three track cards + selected-track line); replaced `src/App.tsx` to wrap routes in `PracticeProvider` and add `/practice` + `/practice/:track`; added a "Practice" `<Link>` to `src/components/TopNav.tsx` (grouped with the brand on the left, matching existing link styling).
- **Verify:** `npm run typecheck` → PASS; `ReadLints` → no errors; `npm test` → 61 passed.
- **Commit:** `1f223c8`.

### Task 10 — Additive Firestore rules (`firestore.rules`)
- **Action:** Added `practiceOk(p)` and applied it to the `users/{uid}` update rule only when a `practice` object is present (`!('practice' in request.resource.data) || practiceOk(...)`); added an append-only `practiceHistory/{runId}` subcollection rule (owner-scoped read, create requires numeric `score` + string `track`, no update/delete). Legacy `progress`/`bestStreak` create + monotonic-update invariants left unchanged.
- **Correctness note:** the existing `persistPracticeState` performs a `{ merge: true }` write of only `practice`; Firestore evaluates `request.resource.data` against the **merged** document, so the legacy `progress`/`bestStreak` checks still hold on a practice-only write — identical to the existing `persistLessonProgress` pattern.
- **Verify:** validated by review (faithful transcription of the plan block; valid `rules_version='2'` syntax, balanced braces, mirrors the already-deployed rule structure).
- **Commit:** `95f462b`.

### Task 11 — Full suite green + M0 exit check
- `npm test` → **61 passed (8 files)**.
- `npm run typecheck` → clean.
- `npm run build` (`tsc -b && vite build`) → clean (`✓ built in ~10.6s`, 131 modules).
- No M0 fixups were outstanding, so the optional `chore(practice): M0 foundations green` commit was intentionally skipped to avoid an empty commit (see Deviations).

---

## Files changed

**Created**
- `src/practice/types.ts`
- `src/practice/account.ts` + `src/practice/account.test.ts`
- `src/practice/nudges.ts` + `src/practice/nudges.test.ts`
- `src/practice/rubrics/index.ts` + `src/practice/rubrics/index.test.ts`
- `src/practice/validator.ts` + `src/practice/validator.test.ts`
- `src/practice/scenarioRegistry.ts` + `src/practice/scenarioRegistry.test.ts`
- `src/services/practiceService.ts`
- `src/state/PracticeContext.tsx`
- `src/pages/PracticePage.tsx`
- `docs/superpowers/reports/m0-report.md` (this report)

**Modified**
- `src/App.tsx` (PracticeProvider + `/practice` routes)
- `src/components/TopNav.tsx` (Practice nav link)
- `firestore.rules` (additive practice rules)

---

## Commits (newest last)

```
c6c0973 feat(practice): add shared ScenarioSpec/Decision/grading types
7859c9c feat(practice): pure account/skill/tier reducer with tests
25b55de feat(practice): nudge catalog with pure trigger predicates
34a40ec feat(practice): rubric registry + weightedTotal + noop rubric
090ab88 feat(practice): deterministic ScenarioSpec validator (trust gate)
975edcf feat(practice): curated scenario registry + build-time validator contract
c0c1920 feat(practice): Firestore practice service (account + history)
2152873 feat(practice): PracticeContext loads/persists account + history
1f223c8 feat(practice): /practice route, provider wiring, nav link, landing shell
95f462b feat(practice): additive Firestore rules for practice account + history
```

---

## Final verification output (summary)

| Gate | Command | Result |
|---|---|---|
| Tests | `npm test` | **61 passed** (8 files): account 7, nudges 5, rubrics 5, validator 7, scenarioRegistry 5 (new = 29) + streak 5, progress 10, registry 17 (baseline 32) |
| Types | `npm run typecheck` (`tsc -b`) | **clean** |
| Build | `npm run build` (`tsc -b && vite build`) | **clean** — 131 modules, `✓ built in ~10.6s` |

> The Vite build prints a pre-existing "chunks larger than 500 kB" advisory (the Phaser bundle). On PowerShell this surfaces as a non-fatal `NativeCommandError` (stderr passthrough); the build exits 0.

---

## Concerns & deviations from the plan

1. **Validator test fixture index (minimal fix, Task 5).** The plan's `valid` fixture used `revealToIndex: 60`, but the first bundled candles key (`asctri_quiz_AMD`) has only 52 candles, so the validator correctly rejected it and the "accepts a well-formed spec" test failed. Fixed minimally by changing the fixture's `revealToIndex` `60 → 50` (kept `splitIndex: 30`). The validator implementation matches the plan exactly and was **not** changed. The Task 6 seed scenario already derives its indices from the real series length, so it was unaffected.

2. **Firestore rules not deployed / emulator-verified.** Per the task instructions ("the Firestore `.rules` file is not exercised by tests/build — just ensure it is valid per the plan"), the live `firebase deploy --only firestore:rules` and the manual emulator checks (plan Task 10 steps 2–3) were **deferred**. The rules are a faithful transcription of the plan, syntactically valid, and preserve the legacy monotonic invariants. They should be deployed before any environment exercises practice persistence.

3. **Skipped the empty "M0 green" chore commit (Task 11 step 4).** Every task was committed cleanly per-task, so no M0 fixups remained. `git add -A` was deliberately avoided because the working tree has many pre-existing untracked, out-of-scope items (`.cursor/`, `docs/`, `planning/`, `public/data/`, `scripts/`, etc.); sweeping them into a commit would be incorrect. An empty commit was therefore not created.

4. **Manual `/practice` dev smoke not run headlessly (Task 11 step 3).** The interactive sign-in + reload round-trip requires real Google auth in a browser and could not be exercised non-interactively. The page compiles, typechecks, builds, and renders the balance/track-card shell deterministically from `PracticeContext`; the persistence round-trip is covered structurally by the service + context + rules. Recommend a quick manual confirmation when convenient.

5. **CRLF line endings.** Git reports "LF will be replaced by CRLF" warnings on Windows for the new files. Cosmetic only; no functional impact.

---

## Carried interfaces for later milestones

`ScenarioSpec`, `Decision`, `ScenarioOutcome`, `Rubric`, `ProcessScore`, `DimensionScore`, `PracticeRun` (types); `accountReducer`/`tierFor`/`isRuined`/`initialAccount` + constants (account); `NUDGES`/`evaluateNudges`/`NudgeContext` (nudges); `RUBRICS`/`getRubric`/`weightedTotal` (rubrics); `validateSpec`/`DISALLOWED_CLAIM_PATTERNS` (validator); `SCENARIOS`/`getScenario`/`scenariosFor`/`allTracks` (registry); `getOrCreatePracticeData`/`persistPracticeState`/`appendPracticeRun`/`loadRecentRuns` (service); `usePractice().{ loading, account, recentRuns, nextScenario, applyResult }` (context).
