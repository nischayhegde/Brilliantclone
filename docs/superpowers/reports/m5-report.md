# M5 — Track B (Market Making) Implementation Report

**Branch:** `feat/trading-practice`
**Plan:** `docs/superpowers/plans/2026-06-25-practice-m5-track-b-market-making.md`
**Result:** All 8 tasks implemented TDD-first. Final gate green — `npm test` (157 tests), `npm run typecheck` (exit 0), `npm run build` (exit 0).

---

## What was implemented

The third Practice track — **market making**. The learner posts a two-sided quote (bid/ask half-widths, quote size, inventory cap) and a session runs deterministically over a **real** mid path (OHLC closes), with a labelled illustrative order-flow simulation. Graded on **process** (two-sided quoting, spread sized to volatility, inventory discipline, quote size); P&L is shown (spread captured vs adverse selection decomposition) but never gates.

- `bookStats.ts` — `bookStatsFromCandles(candles, steps?) → { mids, sigma, mid0, finalMid }` (real path + realized vol).
- `resolve/marketMaking.ts` — pure, RNG-free `simulateMarketMaking(decision, { mids, sigma, orderRate? }) → ScenarioOutcome`; emits `facts.{spreadCaptured, adverseSelection, finalInventory, maxInventoryHeld, fills, finalMid, sigma}`.
- `rubrics/marketMaking.ts` — `marketMakingRubricV1` (dims: `two-sided`, `spread-vs-vol`, `inventory-discipline`, `quote-size`); registered as `market-making-v1`.
- `nudges.ts` — `spread-too-tight`, `inventory-runaway`; `NudgeContext` extended additively (`decision?`, `sigma?`, `finalMid?`).
- `engines.ts` — `marketMakingEngine: TrackEngine<BookStats>` registered under `market-making`.
- `scenes/MarketMakeScene.ts` — Phaser input scene (ladder + four sliders, live nudges, emits `MarketMakingDecision`); registered under kind `market-make`.
- `scenarioRegistry.ts` — 6 curated MM scenarios (2 per tier, tiers 1–3) over real bundled windows.

---

## Per-task RED → GREEN evidence

| Task | RED | GREEN | Commit |
|---|---|---|---|
| 1 — book stats | `Failed to load url ./bookStats` | 3 passed | `4d23973` |
| 2 — simulator | `Failed to load url ./marketMaking` | 5 passed | `c14a8f6` |
| 3 — rubric (+ sigma echo) | sigma echo green (6); rubric `Failed to load url ./marketMaking` | rubrics 17 passed (mm 5, index 5, charts 4, options 3) | `8aea5b4` |
| 4 — nudges | 3 failed (`Cannot read properties of undefined (reading 'triggered')`) | 8 passed | `2d3a63f` |
| 5 — engine | 2 failed (`sceneKind`/`sceneKey` assertions) | 4 passed | `0b1c2e2` |
| 6 — scene + registry | (smoke) | scenes 4 passed | `735667a` |
| 7 — scenarios + enable | (registry) | registry 7 passed (incl. `market-making covers tiers 1..3`) | `bc94e15` |
| 8 — exit + fixup | typecheck TS2698 in nudges.test | typecheck exit 0; nudges 8 passed | `525da88` |

**Flat-path hand-check (exact):** `simulateMarketMaking(flat, { mids:[100,100], sigma:1, orderRate:4 })` → `spreadCaptured=1.0`, `adverseSelection=0`, `finalInventory=0`, `pnl=1.0`, `facts.sigma=1` — matches the plan's worked example and the test assertions.

---

## Files changed

Created: `src/practice/bookStats.ts` (+`.test.ts`), `src/practice/resolve/marketMaking.ts` (+`.test.ts`), `src/practice/rubrics/marketMaking.ts` (+`.test.ts`), `src/practice/scenes/MarketMakeScene.ts`.

Modified (additive): `src/practice/rubrics/index.ts`, `src/practice/nudges.ts` (+`.test.ts`), `src/practice/engines.ts` (+`.test.ts`), `src/practice/scenes/index.ts` (+`.test.ts`), `src/practice/resolve/marketMaking.test.ts`, `src/practice/scenarioRegistry.ts` (+`.test.ts`).

Unchanged on purpose: `src/lessons/order-book/scenes/book.ts` (read-only formatters reused), `src/practice/types.ts` (`MarketMakingDecision` used as-is), `src/pages/PracticePage.tsx` (see deviations).

---

## Final gate output

```
npm test       → Test Files 29 passed (29) · Tests 157 passed (157)
npm run typecheck → exit 0
npm run build  → ✓ built in ~13s (exit 0)
```

(135 → 157 tests; +22 from M5. The Phaser chunk-size note in the build is a pre-existing warning, not an error.)

---

## Deviations from the plan (minimal, intent-preserving)

1. **`TrackEngine` interface.** This repo's M2 interface is `{ sceneKind, loadData, sceneParams, resolve(spec, data, decision) }` — not the plan's `{ track, resolve(spec, decision, data) }`. I implemented `marketMakingEngine` to the real interface (`sceneKind: 'market-make'`, scene resolved via `sceneKind` by `ScenarioPlayer`) and adapted the plan's engine test to assert `.sceneKind` and call `resolve(spec, data, decision)`. `sceneParams` still returns `sceneKey: 'MarketMakeScene'` (truthy) per the plan's assertion. Keeps the existing charts/options engines + their tests green.
2. **`Candle` import.** The plan imports `Candle` from `../engine/scenes/CandleChartScene`, which does not export it. Imported from `../data/candles` instead (the canonical source, consistent with `corpus.ts`/`ChartTradeScene`). Field shape `{t,o,h,l,c}` matches the test factory.
3. **Scene registry convention.** `PRACTICE_SCENES` is keyed by **kind** (`chart-trade`, `options-build`), not class name. Registered `MarketMakeScene` under `market-make` and set `MarketMakeScene.KEY = 'market-make'` (matching engine `sceneKind`); adapted the smoke test to assert that key. The scene follows the established `ModuleScene` pattern (`protected build()`, base `init`/`create` inherited) rather than the plan's sketch `init`/`create` overrides, so it wires to the `SceneBus` correctly.
4. **`PracticePage.tsx` — no edit needed.** The track card is gated purely by `scenariosFor(track).length > 0`, and the composer's curated fallback (`pickCurated`) selects from `scenariosFor(track)`. Adding the curated MM scenarios flips the card from "Coming soon" to active and makes runtime `nextScenario('market-making')` resolve — no code change required (and the placeholder `'market-making': chartsEngine` in `engines.ts` is now replaced by the real engine).
5. **Test-only fixups.** The plan's nudge test typed the shared `base` `as never` and spread it (`{ ...base }`), which fails typecheck (TS2698). Changed to a plain base object and cast each context `as never` at the `triggered(...)` call site. Duplicate `import` lines from the append-style snippets were omitted (the files already import `NUDGES`/`evaluateNudges`/`getEngine`).

## Concerns / notes

- `MarketMakeScene` `drawLadder`/`drawControls` are implemented with the established `ModuleScene` primitives (panels, labels, sliders) and are deliberately visual-only; all session math lives in the tested resolver. They are covered by the wiring smoke test (mocked Phaser), not pixel-tested — consistent with `ChartTradeScene`/`OptionsBuildScene`.
- Determinism verified: the `is deterministic` test asserts `toEqual` on repeated calls; the engine is a pure function of (decision, real path) with no RNG.
- Process-not-P&L verified: the rubric test `never lets P&L gate the score` confirms a losing session with good process still scores ≥75.
