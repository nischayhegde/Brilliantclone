# M6 — Polish (Analytics, A11y/Reduced-Motion, Copy) — Implementation Report

**Branch:** `feat/trading-practice`
**Status:** COMPLETE — final gate green (`npm test` + `npm run typecheck` + `npm run build`).
**Baseline at start:** 157 tests / 29 files green. **End:** 168 tests / 33 files green.

M6 makes the Trading Practice feature shippable: privacy-light analytics, a React
accessibility + reduced-motion pass, a centralized copy/disclaimer layer, a pure
practice-summary aggregation with a stats panel, and the plans index. Everything was
added **additively** — no existing M0–M5 behavior or tests were changed (only the
Journal/ScenarioPlayer/PracticePage/PracticeContext surfaces were extended).

---

## What was implemented (per task)

### Task 1 — Analytics event builders + safe emitter
- **Files:** `src/practice/analytics.ts`, `src/practice/analytics.test.ts`
- `PracticeEvent` discriminated union (`scenario_started | decision_submitted | nudge_fired | scenario_completed | reset_and_reflect`), builders (`evScenarioStarted/evDecision/evNudge/evCompleted/evReset`), `AnalyticsSink` type, and `class PracticeAnalytics` with `emit()` that stamps `ts` and **swallows sink errors** (analytics can never break practice).
- **RED:** `npx vitest run src/practice/analytics.test.ts` → "Failed to load url ./analytics … Does the file exist?"
- **GREEN:** 4/4 passed.
- **Deviation (noted):** the plan's builders were typed to return the broad `PracticeEvent` union, which makes the test's `e.score` access fail `tsc` (the union isn't narrowed). I changed each builder to return its **specific** event type via a small `EventOf<T>` helper (`Extract<PracticeEvent,{type:T}>`). Runtime is identical, each specific type is still assignable to `PracticeEvent`/`AnalyticsSink`, and `tsc -b` passes.

### Task 2 — Firestore analytics sink (untested I/O) + rules
- **Files:** `src/services/analyticsSink.ts`, `firestore.rules`
- `firestoreSink(uid)` appends events to `users/{uid}/practiceEvents` via `addDoc`; `noopSink` for signed-out/dev. Network I/O is untested by policy (same as `userService`); the emitter that uses it is fully tested.
- Added an **additive** create-only, owner-only, immutable rule block for `practiceEvents` inside `match /users/{uid}` (alongside the existing `practiceHistory` block), validating `ts is int` and `type is string`.
- **Verify:** `npm run typecheck` → PASS.

### Task 3 — React `useReducedMotion` hook
- **Files:** `src/hooks/useReducedMotion.ts`, `src/hooks/useReducedMotion.test.ts`
- Reads `(prefers-reduced-motion: reduce)`, subscribes to changes, SSR/no-`matchMedia` safe (returns `false`). Mirrors the scene-side `ModuleScene.reduceMotion` for the React surfaces.
- **Testing-library install (integration point #1):** `@testing-library/react` was NOT installed. Installed dev deps: `@testing-library/react` + `@testing-library/dom` (peer), and **`jsdom`** (required by Vitest's jsdom environment, which was also absent).
- **Vitest env handling:** the global `vitest.config.ts` uses `environment: 'node'` and `include: ['src/**/*.test.ts']`. Per the integration note, I did **not** change global config; instead I added `// @vitest-environment jsdom` as the first line of `useReducedMotion.test.ts` so only this test runs under jsdom (needed for `renderHook`).
- **RED:** module-not-found (jsdom env loaded, import unresolved).
- **GREEN:** 2/2 passed.

### Task 4 — Central copy + illustrative labels
- **Files:** `src/practice/copy.ts`, `src/practice/copy.test.ts`
- `DISCLAIMER` (contains "paper" + "not financial advice"), `TRACK_BLURB: Record<Track,string>` (all three tracks), `FEELING_LABEL: Record<Feeling,string>`, and `illustrativeLabel(spec) → string | null` driven by `spec.illustrativeFlags` (returns an "Illustrative … — the arithmetic shown is exact." string, else `null`).
- **RED:** "Failed to load url ./copy". **GREEN:** 3/3 passed.

### Task 5 — Practice summary aggregation + stats panel
- **Files:** `src/practice/summary.ts`, `src/practice/summary.test.ts`, `src/practice/PracticeStats.tsx`
- `summarizePractice(runs) → { totalRuns, avgScoreByTrack, bestScore, lastPlayedTs }` (pure). `PracticeStats` is a presentational panel (props: `runs`, `account`) rendering runs / best score / resets (`account.ruinEvents`) / last played, plus per-track tier·skill·avg-process. No new component deps were invented (the plan mentioned "ring/Badge" components which don't exist; kept it presentational with existing Tailwind tokens).
- **RED:** "Failed to load url ./summary". **GREEN:** 2/2 passed.

### Task 6 — Wire analytics, a11y, copy, disclaimer into the UI
- **Files:** `src/components/Disclaimer.tsx` (new); modified `src/state/PracticeContext.tsx`, `src/practice/ScenarioPlayer.tsx`, `src/practice/Journal.tsx`, `src/pages/PracticePage.tsx`.
- **PracticeContext:** built `analytics` via `useMemo(() => new PracticeAnalytics({ sink: user ? firestoreSink(user.uid) : noopSink }), [user])`, exposed it on the context value, and emit `evReset({ ruinEvents: next.ruinEvents })` inside `resetAndReflect` (added `analytics` to its deps).
- **ScenarioPlayer:** emits `scenario_started` (on spec load, using `spec.source`), `decision_submitted` (bus `decision`), `nudge_fired` (bus `nudge`), `scenario_completed` (on grade, with `score.total`, `outcome.pnl`, `firedNudges`). Renders `illustrativeLabel(spec)` near the canvas and `<Disclaimer/>` at the bottom. A11y: phase content wrapped in `aria-live="polite"`; the graded result is a focusable region (`tabIndex={-1}`, labelled) that receives focus when shown; reveal uses `useReducedMotion` (instant under reduced motion, otherwise a short opacity transition).
- **Journal:** `<label htmlFor>` on the rationale field (autofocused); feelings are a real `role="radiogroup"` of `role="radio"` buttons with roving tabindex + arrow/space/Enter selection (focus follows selection) using `FEELING_LABEL`; Ctrl/Cmd+Enter submits.
- **PracticePage:** mounts `<PracticeStats runs={recentRuns} account={account} />` and `<Disclaimer/>` (both the normal and ruin/`ResetReflect` branches carry the disclaimer); track cards now show `TRACK_BLURB[t]`.
- **Verify:** `npm run typecheck` + `npm run build` PASS; no linter errors on changed files.

### Task 7 — Plans index
- **File:** `docs/superpowers/plans/README.md` — created exactly as specified (M0–M6 table, source spec, conventions).

### Task 8 — Release gate
- `npm test` → **168 passed (33 files)**.
- `npm run typecheck` (`tsc -b`) → clean.
- `npm run build` (`tsc -b && vite build`) → ✓ built (~9.7s). The only build output to stderr is Vite's pre-existing >500 kB chunk-size advisory (phaser/firebase/index bundles); exit code 0. PowerShell renders that stderr as a `NativeCommandError`-styled line, but it is **not** a failure.

---

## Testing-library install + vitest env handling (integration point #1, detail)
- `package.json` before: no `@testing-library/*`, no `jsdom`. Confirmed via the dependency manifest.
- Installed (dev): `@testing-library/react`, `@testing-library/dom`, `jsdom` (let npm resolve versions compatible with React 18).
- Global Vitest stays `environment: 'node'`; the single DOM-requiring test opts in with a top-of-file `// @vitest-environment jsdom` directive. All other tests remain in the fast `node` env. `include` is `src/**/*.test.ts`, so the `.test.ts` extension is correct (no `.tsx` tests added).

## Files changed / added
- **New:** `src/practice/analytics.ts` (+test), `src/services/analyticsSink.ts`, `src/hooks/useReducedMotion.ts` (+test), `src/practice/copy.ts` (+test), `src/practice/summary.ts` (+test), `src/practice/PracticeStats.tsx`, `src/components/Disclaimer.tsx`, `docs/superpowers/plans/README.md`, `docs/superpowers/reports/m6-report.md`.
- **Modified:** `firestore.rules`, `src/state/PracticeContext.tsx`, `src/practice/ScenarioPlayer.tsx`, `src/practice/Journal.tsx`, `src/pages/PracticePage.tsx`, `package.json`, `package-lock.json`.

## Commits (in order)
1. `5338060` feat(practice): privacy-light analytics event builders + safe emitter
2. `15ce144` feat(practice): Firestore analytics sink + owner-only event rules
3. `1855c99` feat(a11y): React useReducedMotion hook (parity with scene reduceMotion)
4. `36630a7` feat(practice): central copy - disclaimer, track blurbs, illustrative labels
5. `c5a66b9` feat(practice): practice summary aggregation + stats panel
6. `98cfab6` feat(practice): wire analytics, disclaimers, illustrative labels, a11y into UI
7. `9e3892d` docs(practice): plans index (M0-M6)
8. *(final marker)* chore(practice): M6 polish complete — analytics, a11y, copy, stats green

## Final gate output
```
Test Files  33 passed (33)
     Tests  168 passed (168)
typecheck: tsc -b → clean
build:     ✓ built (vite) — only the pre-existing >500kB chunk-size advisory
```

## Concerns / deviations
1. **Builder return types (Task 1):** narrowed from `PracticeEvent` to specific event types so the plan's own test (`e.score`) type-checks. Behavior-preserving; noted above.
2. **`jsdom` had to be installed** in addition to `@testing-library/react`/`@testing-library/dom` — Vitest's jsdom environment requires the `jsdom` package, which was not present. The dependency-manifest changes were committed with Task 3 (the install is intrinsic to that task).
3. **Final `git add -A` deviation (Task 8 step 3):** the working tree contains substantial **pre-existing untracked** artifacts that predate M6 and have been untracked across M0–M5 (all `docs/superpowers/plans/*.md` plan files, prior `m0`/`m5` reports, the entire `public/data/` OHLC corpus, `scripts/`, `.cursor/`, `.impeccable/`, `.superpowers/`). A literal `git add -A` would have committed all of that unrelated content into the "M6 complete" commit. To avoid that scope/hygiene problem (and to match the repo's established pattern of leaving those artifacts untracked), the final commit adds **only the M6 report**. All M6 source, tests, rules, and the plans index are already committed in commits 1–7; nothing M6-specific is left uncommitted.
4. **`PracticeStats` "ring/Badge" components** referenced by the plan don't exist in `src/components/`; the panel was kept presentational with existing Tailwind tokens (no fabricated dependencies).
5. **Phaser scenes untouched** — reduced motion there continues to flow through `ModuleScene.reduceMotion`; the React `useReducedMotion` hook is the parallel for React surfaces, as specified.
