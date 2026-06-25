# M2 — Track C (Options Strategies) Implementation Report

**Branch:** `feat/trading-practice`
**Plan:** `docs/superpowers/plans/2026-06-25-practice-m2-track-c-options.md`
**Status:** ✅ COMPLETE — all 8 tasks implemented task-by-task with TDD, each committed. Final gate green.

---

## What was implemented

M2 ships the options track end-to-end and introduces the `TrackEngine` abstraction so the
ScenarioPlayer is now track-agnostic (per-track data loading, scene params, resolution):

- **Chain snapshot loader** (`src/practice/chain.ts`) over `public/data/options/*` — `loadChain`
  (fetch + cache), `contractsForExpiry`, `findContract`, `dteDays`, `__clearChainCache`, plus the
  `ChainSnapshot`/`ContractRow`/`CP` types matching the verified on-disk JSON shape.
- **Pure Black–Scholes** (`src/practice/resolve/bs.ts`) — `normCdf` (Abramowitz–Stegun 7.1.26) +
  `bsPrice`. Fed **real snapshot IV**; output is a labelled model estimate (used only for the
  in-scene "today" curve and closed-early valuation).
- **Options resolver** (`src/practice/resolve/options.ts`) — `resolveOptionsPosition` books
  **exact expiry intrinsic on real premiums** at the real underlying close for `hold`/`rolled`
  (`modelEstimate: false`), and a **labelled BS value** at half the DTE for `closed-early`
  (`modelEstimate: true`). Also `combinedExpiryMaxLoss` (finite vs `Infinity` for naked shorts)
  and `underlyingCloseOn`.
- **`options-v1` rubric** (`src/practice/rubrics/options.ts`, registered in `rubrics/index.ts`) —
  thesis (w2), sizing-by-max-loss (w2), defined-risk (w2), R:R (w1), strike/expiry sanity (w2),
  management (w2). Extended `OptionLegDecision` with `deltaAtEntry?`/`dteAtEntry?` (sourced from
  the real chain, grading only).
- **Per-track engine** (`src/practice/engines.ts`) — `TrackEngine<Data>`, `ENGINES`
  (`charts`, `options`, `market-making` placeholder), `getEngine`. Charts engine wraps M1
  identically; options engine loads `{ snapshot, underlying }` and resolves with **real per-leg
  IV looked up from the snapshot** (the plan's `0.3` placeholder was replaced as instructed).
- **Player/page refactor** — `ScenarioPlayer.tsx` dispatches via the engine (`sceneKind`,
  `sceneParams`, `resolve`) and shows a "model estimate · IV real" label when
  `outcome.facts.modelEstimate`. `ScenarioPlayerPage.tsx` loads via `getEngine(spec.track).loadData`.
- **OptionsBuildScene** (`src/practice/scenes/OptionsBuildScene.ts`, registered `options-build`) —
  real expiry picker (real DTEs), strike slider over the **real strike grid**, call/put +
  long/short toggles, contracts slider, add-leg (≤2), manage toggle. Pulls every
  `premium`/`deltaAtEntry`/`dteAtEntry`/`iv` from `findContract`. Draws the **exact expiry payoff**
  (`legPnL × MULTIPLIER × contracts`) + a model **"today" curve** (`bsPrice`, real IV, labelled),
  numeric breakevens, spot/strike markers, and fires `undefined-risk`/`sizing` nudges live.
- **Curated catalog** — 9 options specs across tiers 1–3 (`opt-t1-01`…`opt-t3-03`) over real
  snapshots (DIS, AAPL, MSFT, JPM, BAC, NVDA, AMZN, TSLA, NFLX); all paths verified to exist and
  all pass `validateSpec`. The Practice page Options card auto-enables (`scenariosFor` gate).

---

## Per-task RED → GREEN evidence

| Task | Test file | RED | GREEN |
|---|---|---|---|
| 1 chain loader | `chain.test.ts` | FAIL "Failed to load url ./chain" | ✅ 4 passed |
| 2 Black–Scholes | `resolve/bs.test.ts` | FAIL "Failed to load url ./bs" | ✅ 4 passed |
| 3 options resolver | `resolve/options.test.ts` | FAIL "Failed to load url ./options" | ✅ 5 passed |
| 4 options-v1 rubric | `rubrics/options.test.ts` | FAIL "Failed to load url ./options" | ✅ 3 passed (12 in `rubrics/`) |
| 5 track engines | `engines.test.ts` | (new module) | ✅ 2 passed; typecheck clean after player/page refactor |
| 6 OptionsBuildScene | `scenes/index.test.ts` (extended) | n/a (wiring smoke) | ✅ 2 passed |
| 7 curated catalog | `scenarioRegistry.test.ts` | n/a (contract) | ✅ 5 passed (all specs validate) |
| 8 exit check | full suite | — | ✅ 96 passed |

Test count grew 77 → 96 (+19): chain 4, bs 4, options resolver 5, options rubric 3, engines 2,
scene wiring +1.

---

## Files changed

**Created:** `src/practice/chain.ts`(+test), `src/practice/resolve/bs.ts`(+test),
`src/practice/resolve/options.ts`(+test), `src/practice/rubrics/options.ts`(+test),
`src/practice/engines.ts`(+test), `src/practice/scenes/OptionsBuildScene.ts`,
`docs/superpowers/reports/m2-report.md`.

**Modified:** `src/practice/types.ts` (OptionLegDecision +deltaAtEntry/+dteAtEntry),
`src/practice/rubrics/index.ts` (register options-v1),
`src/practice/scenes/index.ts` + `scenes/index.test.ts` (register options-build),
`src/practice/ScenarioPlayer.tsx` (engine dispatch + model-estimate label),
`src/pages/ScenarioPlayerPage.tsx` (engine loadData),
`src/practice/scenarioRegistry.ts` (optionsSpec + 9 specs).

---

## Commits (in order)

- `905f149` feat(practice): option-chain snapshot loader + indexing helpers
- `f5589c6` feat(practice): pure Black-Scholes pricer (model value from real IV)
- `638dc1a` feat(practice): options resolver (exact expiry P&L + labelled BS close)
- `5d86834` feat(practice): options-v1 rubric (defined risk, sizing, strike/expiry sanity)
- `11bd6fe` refactor(practice): per-track engine dispatch (charts + options)
- `0e875e2` feat(practice): OptionsBuildScene (real chain -> live payoff -> decision)
- `efa2e7c` feat(practice): curated options catalog (tiers 1-3, real chain snapshots)

---

## Final gate output

```
npm test       → Test Files 18 passed (18) · Tests 96 passed (96)
npm run typecheck → tsc -b (clean, exit 0)
npm run build  → vite v6.4.3 ✓ 148 modules transformed · ✓ built in 10.86s (exit 0)
```

(The build prints a PowerShell `RemoteException` line — that is stderr-routing noise from
Vite's chunk-size advisory, not an error; exit code is 0 and `✓ built` is emitted. The
>500 kB chunk warning for `phaser`/`firebase` is pre-existing and informational.)

---

## Concerns / deviations

1. **Engine IV — placeholder replaced (intended).** Per the plan's NOTE, the options engine's
   `ivByLeg: () => 0.3` typing convenience was replaced with the **real per-leg IV** via
   `findContract(snapshot, leg.expiry, leg.K, cp)?.iv` (fallback `0.3` only if a contract is
   missing). Honors "IV real". The pure resolver still accepts `ivByLeg` so its unit tests stay
   data-free.
2. **Breakevens drawn numerically in the scene.** `payoffMath.breakevens` only models
   straddle/strangle (calls→`Kc=Min`, puts→`Kp=Max`), which is wrong for verticals/credit spreads.
   The scene therefore marks breakevens by scanning the exact expiry curve for zero crossings —
   correct for arbitrary ≤2-leg structures. Booked P&L still flows through `legPnL`/`combinedPnL`
   (unchanged read-only math).
3. **"Today" curve rendered as a distinct colour, not literal dashes.** A true dashed stroke would
   fragment the sampled path; the amber "today (model · IV real)" curve vs the green "at expiry
   (exact)" curve reads clearly. Both are explicitly labelled per POLISH_STYLE_GUIDE §3.
4. **Scene is wiring-smoke-tested only** (phaser mocked), per codebase convention; all payoff/BS/
   resolution math is covered by `payoffMath` + the bs/options resolver unit tests. The scene's
   interactive build/redraw was not exercised in an automated browser run — manual exit criteria
   (PRDphase2 §17 M2, plan Task 8 Step 2) were not run in this session (no dev-server smoke test).
5. **`market-making` engine slot** points at the charts engine purely so `Record<Track,…>`
   typechecks before M5; it is never selected (no MM specs exist yet).
6. **Catalog symbol note.** The plan suggested "KO" as an example, but KO has no options snapshot
   (13 covered symbols are SPY/AAPL/MSFT/AMZN/NVDA/TSLA/GOOGL/META/NFLX/DIS/JPM/BAC/AMD). Used real
   covered symbols only; all 9 `chainAsset` paths + underlying `__1d.json` series verified present.
7. **Read-only math untouched:** `payoffMath.ts` and `optionMath.ts` were reused, never modified.
