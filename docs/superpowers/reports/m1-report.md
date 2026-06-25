# M1 — Track A (Chart-Pattern Trading) Implementation Report

**Branch:** `feat/trading-practice`
**Plan:** `docs/superpowers/plans/2026-06-25-practice-m1-track-a-charts.md`
**Status:** DONE (automated gate green; manual browser exit-criteria not executed — see Concerns)

M1 builds the first fully-playable scenario lifecycle on top of the M0 foundations:
setup → live nudges → mandatory journal → deterministic resolve over real OHLC →
pure process rubric → curated debrief → `applyResult` (account update + persistence).

---

## Final verification gate

```
npm test        → 13 files, 77 tests passed  (was 61 at M0; +16 new)
npm run typecheck → tsc -b clean
npm run build   → tsc -b && vite build OK (built in ~12s)
```

The only build output note is the pre-existing "chunks > 500 kB" advisory for the
Phaser/Firebase vendor bundles — informational, not an error, unchanged by M1.

---

## Per-task implementation + RED/GREEN evidence

### Task 1 — Bus `decision` + `nudge` events + ModuleScene emitters
- Files: `src/engine/bus.ts`, `src/engine/ModuleScene.ts`.
- Added two additive `SceneEvent` variants (`decision` w/ generic `Record<string, unknown>`
  payload, `nudge` w/ `id`) so `engine/` stays decoupled from `practice/` types; added
  `emitDecision`/`emitNudge` helpers after `readout`.
- Evidence: `npm run typecheck` clean; `src/lessons/registry.test.ts` 17/17 pass
  (additive variants don't break existing handlers).
- Commit: `f28c8d1`.

### Task 2 — Corpus loader
- Files: `src/practice/corpus.ts` (+ `.test.ts`).
- `decodeColumnarOhlc`, `loadCandles(dataRef)` (bundled `CANDLES[key]` or fetch+decode a
  `public/data/ohlc` asset, in-memory cache), `__clearCorpusCache`.
- RED: `npx vitest run src/practice/corpus.test.ts` → "Failed to load url ./corpus".
- GREEN: 4/4 pass.
- Commit: `694ece8`.

### Task 3 — Pure chart-trade resolver (honest fills)
- Files: `src/practice/resolve/charts.ts` (+ `.test.ts`).
- `resolveChartTrade(candles, decision, ref, frictions?)` → `ScenarioOutcome`;
  `DEFAULT_FRICTIONS`. Stop-before-target within a bar; gap **through** a level fills at
  the bar **open** (worse than the level); per-share fee + half-spread against the learner;
  honours an early `managedExitIndex`. `facts: { took, hit, exit, exitIndex, netMove }`.
- RED: module not found. GREEN: 4/4 pass (TP-before-SL, gap-through-stop fills at open
  = 90 not 97, skip records `netMove`, default frictions shave gross).
- Commit: `3f7a99b`.

### Task 4 — Charts process rubric (`charts-v1`)
- Files: `src/practice/rubrics/charts.ts`, register in `src/practice/rubrics/index.ts` (+ `.test.ts`).
- Dimensions: `read` (w2), `sizing` (w2), `stop` (w2), `rr` (w1), `management` (w1).
  Grades **process not P&L**: a profitable-but-stopless/oversized trade scores < 50 and
  `stop`=0; a disciplined skip on a small move scores `read` high.
- RED: module not found. GREEN: `src/practice/rubrics/` 9/9 pass.
- **Deviation (noted):** the plan's transcribed test passed a stray top-level `took: false`
  into the `ScenarioOutcome` helper, which `tsc` rejects (`TS2353` — not a key of
  `ScenarioOutcome`; the rubric reads `outcome.facts.took`). Removed the stray property in
  `charts.test.ts` to keep `npm run typecheck` green. Behaviour/intent unchanged. (Plan
  Task 4 only ran vitest, which doesn't typecheck, so it slipped; fixed alongside Task 6.)
- Commit: `b0482f1` (rubric) + the test fix folded into `a3f2b21`.

### Task 5 — Curated debrief generator
- Files: `src/practice/debrief.ts` (+ `.test.ts`).
- Deterministic prose from real score + outcome facts + journal feeling; praises good
  process on a loss, names the weakest dimension when low, confronts a
  fomo/revenge/anxious self-attribution. (LLM replaces this behind the same signature in M3.)
- RED: module not found. GREEN: 3/3 pass.
- Commit: `0c5c37b`.

### Task 6 — ChartTradeScene (input-only) + practice scene registry
- Files: `src/practice/scenes/ChartTradeScene.ts`, `src/practice/scenes/index.ts` (+ `index.test.ts`).
- Scene draws real candles to the split with the hidden region masked, an entry line, a
  take/skip toggle, a size slider, and two draggable price lines; it **never grades** —
  on submit it `emitDecision({ took, direction, shares, entry, stop, target })` and fires
  live `sizing`/`no-stop` nudges. Registry: `PRACTICE_SCENES` + `resolvePracticeScene`.
- Verified per Global Constraints by a phaser-mocked wiring smoke test (mirrors
  `src/lessons/registry.test.ts`): 1/1 pass; constructable + resolvable, unknown → undefined.
- **Deviation (noted):** the plan's `drawAdjustableLine` sketch (a) created a fresh
  `dashedLine` graphics every redraw (leak) and (b) gated `no-stop` on
  `this.stop === undefined`, which is a `tsc` error since `stop` is typed `number`
  (and dead — the scene always sets a stop). I implemented the lines using the
  `CandleChartScene.addPriceLine` redraw/constrain pattern the plan explicitly points to:
  a single re-cleared `lineG`, the **target** constrained to the profit side of entry, the
  **stop** free to range so a wrong-side placement is reachable, and `no-stop` fired when
  the stop sits on the wrong side of entry (undefined risk — consistent with the rubric's
  `stop`=0 case). This keeps both nudges demonstrable per exit-criterion #2 and passes typecheck.
- Commit: `a3f2b21`.

### Task 7 — Journal component
- File: `src/practice/Journal.tsx`. Required one-line rationale + a feeling tag; submit
  disabled until both present. `npm run typecheck` clean (no unit test per plan).
- Commit: `cc0443e`.

### Task 8 — ScenarioPlayer + page + route
- Files: `src/practice/ScenarioPlayer.tsx`, `src/pages/ScenarioPlayerPage.tsx`,
  `src/App.tsx`.
- Player orchestrates `setup → journal → resolved`: subscribes to the bus (nudge → toast,
  decision → store + advance to required journal), then resolves+grades with
  `resolveChartTrade`/`getRubric`, renders banner + per-dimension breakdown + curated
  debrief, and on Continue calls `applyResult(PracticeRun)` and navigates back.
  Page loads spec via `getScenario` + candles via `loadCandles`; route
  `/practice/play/:specId` added inside the protected routes (before `/practice/:track`).
- `npm run typecheck` clean.
- Commit: `5c7df55`.

### Task 9 — Curated charts catalog + Practice page entry
- Files: `src/practice/scenarioRegistry.ts`, `src/pages/PracticePage.tsx`.
- Replaced the M0 single seed with **12 curated charts specs across tiers 1–3**, each
  referencing a real bundled `CANDLES` key (verified keys + lengths by reading
  `src/data/candles.ts`), `splitIndex ≈ 60%`, `revealToIndex = series length`,
  `rubricId: 'charts-v1'`, tier-scaled `minRewardRisk` (1.5 at T1, 2 at T2/T3). Keys used:
  `asctri_quiz_AMD`, `bearflag_quiz_TSLA`, `pltr_2024`, `nvda_2023` (T1);
  `cupHandle_quiz_DIS`, `db_quiz_SNAP`, `hs_quiz_META`, `gme_squeeze_2021` (T2);
  `dt_quiz_NFLX`, `ihs_quiz_NVDA`, `triple_bottom_quiz_DIS`, `vw_squeeze_2008` (T3).
- Practice page: `Start scenario` button per card, gated on the pure
  `scenariosFor(track).length > 0` (not on calling `nextScenario`, so it stays render-safe
  when M3 makes selection async); charts enabled, options/market-making show "Coming soon".
- Evidence: `npx vitest run src/practice/scenarioRegistry.test.ts` 5/5 (every spec passes
  `validateSpec`, ids unique) + `npm run typecheck` clean.
- Commit: `a571d68`.

### Task 10 — M1 exit check
- Full gate green (see top). No code fixups required at this step, so no extra fixup commit
  was created (avoids an empty/no-op commit). This report is the remaining deliverable.

---

## Files changed (M1)

Created:
- `src/practice/corpus.ts` (+ `corpus.test.ts`)
- `src/practice/resolve/charts.ts` (+ `charts.test.ts`)
- `src/practice/rubrics/charts.ts` (+ `charts.test.ts`)
- `src/practice/debrief.ts` (+ `debrief.test.ts`)
- `src/practice/scenes/ChartTradeScene.ts`, `src/practice/scenes/index.ts` (+ `index.test.ts`)
- `src/practice/Journal.tsx`
- `src/practice/ScenarioPlayer.tsx`
- `src/pages/ScenarioPlayerPage.tsx`
- `docs/superpowers/reports/m1-report.md` (this file)

Modified:
- `src/engine/bus.ts`, `src/engine/ModuleScene.ts`
- `src/practice/rubrics/index.ts`
- `src/practice/scenarioRegistry.ts`
- `src/pages/PracticePage.tsx`
- `src/App.tsx`

Read-only math/other-milestone modules were not touched.

---

## Test summary

`npm test` → **13 files / 77 tests passing** (M0 was 61; +16: corpus 4, resolve/charts 4,
rubrics/charts 4, debrief 3, scenes wiring 1). `tsc -b` clean. `vite build` succeeds.

---

## Concerns / deviations

1. **Manual browser exit-criteria (Task 10 Step 2) not executed.** It requires
   `npm run dev`, an authenticated sign-in, and interactive Phaser dragging across 10
   scenarios with a live Firestore round-trip — outside the headless automated gate and
   the Node test environment (Phaser scenes can't be deeply unit-tested per the Global
   Constraints, which is why the scene ships with a wiring smoke test). All pure pieces
   (corpus, resolver, rubric, debrief, registry contract) are unit-tested; the player
   wiring typechecks and the production build succeeds. Recommend a human run-through of
   the 5 manual sub-criteria before sign-off.
2. **Two small, noted plan/codebase reconciliations** (both to keep typecheck green and
   honour intent): removed a stray `took` key from the rubric test's outcome literal
   (Task 4), and implemented the draggable stop/target lines via the referenced
   `CandleChartScene.addPriceLine` constrain pattern instead of the plan's leak-prone /
   `stop === undefined` sketch (Task 6). Behaviour matches the plan's intent.
3. **`no-stop` nudge semantics:** because this scene always initialises a valid stop, the
   `no-stop` nudge fires only when the learner drags the stop to the wrong side of entry
   (undefined risk). This is the reachable, teachable trigger and is consistent with the
   `charts-v1` rubric scoring a wrong-side/absent stop as 0.
4. **Circular import (intentional, per plan):** `rubrics/index.ts` ↔ `rubrics/charts.ts`
   resolves cleanly because `weightedTotal` is a hoisted function declaration and
   `chartsRubricV1` is defined before `RUBRICS` evaluates. All rubric tests + build pass.
