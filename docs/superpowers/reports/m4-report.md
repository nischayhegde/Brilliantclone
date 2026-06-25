# M4 — Adaptive Difficulty + Reset-and-Reflect — Implementation Report

**Branch:** `feat/trading-practice` (no branch switch)
**Plan:** `docs/superpowers/plans/2026-06-25-practice-m4-adaptive-difficulty.md`
**Status:** ✅ COMPLETE — all 6 tasks implemented, committed, and green.

---

## What was implemented

Complexity now scales with **skill, not luck**: per-track tiers rise immediately when the
rolling process-skill EMA crosses a threshold and only fall after a sustained drop (hysteresis,
preventing thrash). The seed's hard `< $1,000 = fail` became a **coached reset-and-reflect**:
on ruin the app diagnoses the failure pattern from real run history (oversizing / undefined
risk / tilt), drops every track one tier, refills to $10,000, and increments a persistent
`ruinEvents` counter — while **preserving the skill rating** across the blowup.

---

## Per-task RED → GREEN evidence

### Task 1 — Hysteresis tier transitions + `RESET_AND_REFLECT`
- Files: `src/practice/account.ts`, `src/practice/account.test.ts`
- **RED:** `npx vitest run src/practice/account.test.ts` → 5 failed / 8 passed
  (`nextTier is not a function`; `RESET_AND_REFLECT` not handled → balance stayed 800; mediocre score demoted 5→4).
- **Impl:** added `HYSTERESIS = 6`, `nextTier(prevTier, skill)` (immediate promotions; demote only when
  `skill < prevFloor - HYSTERESIS`, floored at tier 1); switched `APPLY_RESULT` to use `nextTier(...)`
  instead of the raw `tierFor(...)` set; added the `RESET_AND_REFLECT` action (refill to `STARTING_BALANCE`,
  drop each track tier by one min 1, `ruinEvents + 1`, skill untouched).
- **GREEN:** 13/13 passed. **M0 cases preserved** — the M0 "raises tier as skill crosses thresholds"
  case still holds because promotions remain immediate.
- Commit: `e8dcfe8`

### Task 2 — Pure ruin diagnosis (`summarizeRuin`)
- Files: `src/practice/reflect.ts` (new), `src/practice/reflect.test.ts` (new)
- **RED:** `npx vitest run src/practice/reflect.test.ts` → failed to load `./reflect` (module not found).
- **Impl:** pure `summarizeRuin(runs) → RuinSummary` mining the most recent 15 runs for weak `sizing`
  (oversizing), weak `stop`/`defined-risk` (no-stops), and `revenge`/`fomo` journal feelings (tilt);
  returns ranked causes + cause-specific headline/coaching, with a calm generic fallback when no pattern.
- **GREEN:** 4/4 passed.
- Commit: `2d57d11`

### Task 3 — Wire ruin detection + reset into `PracticeContext`
- File: `src/state/PracticeContext.tsx`
- Added `pendingRuin`, `ruinSummary`, `resetAndReflect()` to `PracticeValue` and the provider value.
- `applyResult` now detects `isRuined(next)` after applying, and sets `pendingRuin` + `summarizeRuin(updatedRuns)`.
- `resetAndReflect()` dispatches `RESET_AND_REFLECT`, clears the gate, and persists.
- **Stale-closure fix (deviation, see below):** added a `recentRunsRef` mirror so the ruin diagnosis is
  computed against current history (the M3 `applyResult` callback is memoized on `[user]`, so the
  `recentRuns` state value would have been stale at ruin time). Ruin state is also cleared on user change.
- Integrated **additively** — M3 async LLM `nextScenario`, the composed-spec store, and the prefetch
  queue are untouched.
- **GREEN:** `npm run typecheck` clean; full suite 134/134.
- Commit: `8233560`

### Task 4 — Coached reset screen + ruin counter
- Files: `src/practice/ResetReflect.tsx` (new), `src/pages/PracticePage.tsx`
- `ResetReflect` renders the diagnosed headline, per-cause counts, coaching, the next reset number,
  and an acknowledge `Button` → `resetAndReflect`. Reuses the existing default-export `Button`
  (`src/components/ui/Button`) and existing design tokens (`brand-red`, `brand-red-soft`, `ink-soft`,
  `hairline`, `muted`) — all verified present in `src/index.css`.
- `PracticePage` gates on `pendingRuin` (mandatory full-page reset screen) and shows a `Resets {ruinEvents}`
  chip beside the paper-balance header. The finish flow already navigates to `/practice` after `applyResult`
  (`src/practice/ScenarioPlayer.tsx`), so the gate appears when ruined.
- **GREEN:** typecheck clean; full suite 134/134.
- Commit: `2e5161a`

### Task 5 — Tier 1–3 complexity coverage
- Files: `src/practice/scenarioRegistry.ts`, `src/practice/scenarioRegistry.test.ts`
- Audit result: charts and options **already** cover tiers 1, 2, 3 (each non-empty) — no specs needed adding.
- Encoded distinct tier-3 complexity in the charts spec: `minRewardRisk: tier >= 3 ? 2.5 : tier >= 2 ? 2 : 1.5`
  (a rubric R:R target = complexity, **not** market odds; resolvers untouched). Options tiers already encode
  structural complexity via briefs (single-leg → vertical → higher-vol / tighter management).
- Added the gating contract test: charts + options each non-empty for tiers 1..3.
- **GREEN:** `npx vitest run src/practice/scenarioRegistry.test.ts` → 6/6; full suite 135/135.
- Commit: `4f17829`

### Task 6 — M4 exit check
- Final gate `npm test ; npm run typecheck ; npm run build` — all green (output below).

---

## Dimension-id reconciliation

**No reconciliation required.** `summarizeRuin` keys were verified against the live rubrics:
- `src/practice/rubrics/charts.ts` emits dimension ids `read`, `sizing`, `stop`, `rr`, `management`.
- `src/practice/rubrics/options.ts` emits `thesis`, `sizing`, `defined-risk`, `rr`, `strike-expiry`, `management`.
- `summarizeRuin` keys on `sizing` (oversizing), `stop` + `defined-risk` (no-stops), and `journal.feeling`
  `revenge`/`fomo` (tilt) — all present and correct. `Feeling` union in `src/practice/types.ts` includes
  `'fomo'` and `'revenge'`.

---

## Files changed

- `src/practice/account.ts` (modify) — `HYSTERESIS`, `nextTier`, `RESET_AND_REFLECT`.
- `src/practice/account.test.ts` (extend) — hysteresis + reset specs (added `nextTier` to existing import to avoid a duplicate-import lint error).
- `src/practice/reflect.ts` (new) — `summarizeRuin` / `RuinSummary`.
- `src/practice/reflect.test.ts` (new).
- `src/state/PracticeContext.tsx` (modify) — ruin detection, `resetAndReflect`, `pendingRuin`/`ruinSummary`, `recentRunsRef`.
- `src/practice/ResetReflect.tsx` (new) — coached reset screen.
- `src/pages/PracticePage.tsx` (modify) — `pendingRuin` gate + `Resets` chip.
- `src/practice/scenarioRegistry.ts` (modify) — tier-3 `minRewardRisk` complexity.
- `src/practice/scenarioRegistry.test.ts` (extend) — tier 1..3 coverage contract.

---

## Commits

| SHA | Subject |
|---|---|
| `e8dcfe8` | feat(practice): hysteresis tier transitions + RESET_AND_REFLECT action |
| `2d57d11` | feat(practice): pure ruin diagnosis from real history |
| `8233560` | feat(practice): detect ruin + expose coached reset in PracticeContext |
| `2e5161a` | feat(practice): coached reset-and-reflect screen + ruin counter |
| `4f17829` | feat(practice): tier 1-3 complexity coverage for adaptive difficulty |

---

## Final gate output

```
Test Files  26 passed (26)
     Tests  135 passed (135)

> tsc -b      (typecheck: clean, exit 0)

> vite build
✓ 161 modules transformed.
✓ built in 9.73s
```

Build emits a Vite "chunks larger than 500 kB" advisory (pre-existing, phaser/firebase bundles) — it is
written to stderr so PowerShell surfaces a cosmetic `NativeCommandError`, but the build exits 0 and succeeds.

---

## Concerns / deviations

1. **`recentRunsRef` added (not in the plan snippet).** The plan's `summarizeRuin([run, ...recentRuns])`
   would have read a stale `recentRuns` because the M3 `applyResult` callback is memoized on `[user]`.
   I added a ref mirror (kept in sync in the load effect, `applyResult`, and on user change) so the
   diagnosis is computed from live history. Honors intent; more correct.
2. **Import style in `account.test.ts`.** Added `nextTier` to the existing `./account` import rather than
   the plan's separate `import { nextTier } from './account'` line, to avoid a `no-duplicate-imports` lint error.
3. **Did NOT tighten tier-3 `revealToIndex`.** The plan's Task 5 mentioned a shorter tier-3 management
   window, but narrowing the reveal window changes the realized P&L resolution — i.e. the market odds —
   which violates the "complexity, not odds; keep tier out of resolvers" constraint. I encoded tier-3
   complexity via the rubric R:R target (`minRewardRisk` 2.5) only, leaving resolvers and odds untouched.
4. **Build chunk-size advisory** is pre-existing and non-blocking (see above).

No blockers.
