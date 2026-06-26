# Trading Practice — Build Progress Ledger

Branch: `feat/trading-practice`
Plans: `docs/superpowers/plans/2026-06-25-practice-m0..m6-*.md`
Method: subagent-driven-development (one implementer per milestone, verification gate between).

Baseline before build: typecheck clean, 32 tests passing (3 files).

## Status

- [x] M0 — foundations (commits c6c0973..95f462b; 61 tests, typecheck+build clean)
- [x] M1 — Track A charts (commits f28c8d1..0875dfb; 77 tests, typecheck+build clean)
- [x] M2 — Track C options (commits 905f149..d0cf1a5; 96 tests, typecheck+build clean)
- [x] M3 — LLM composer + coach (commits 9619323..4bfb821; 124 tests, typecheck+build clean)
- [x] M4 — adaptive difficulty + reset-and-reflect (commits e8dcfe8..ef6f0aa; 135 tests, typecheck+build clean)
- [x] M5 — Track B market making (commits 4d23973..525da88; 157 tests, typecheck+build clean)
- [x] M6 — polish (analytics, a11y, copy) + plans index (commits 5338060..8a3a22f; 168 tests, typecheck+build clean)

## Log
- M0: complete. 10 commits (c6c0973..95f462b). 61 tests passing (29 new), typecheck + build clean. Deviation: validator fixture revealToIndex 60→50 to fit real candle length. Verified green by controller.
- M1: complete. 10 commits (f28c8d1..0875dfb). 77 tests passing (16 new), typecheck + build clean. Minor fixes: stray `took` test key; draggable lines via addPriceLine constrain pattern. Verified green by controller.
- M2: complete. 8 commits (905f149..d0cf1a5). 96 tests passing (19 new), typecheck + build clean. Improvements: per-leg IV read from real snapshot (replaced 0.3 placeholder); numerical breakevens. TrackEngine introduced; charts behavior preserved. Verified green by controller.
- M3: complete. 9 commits (9619323..4bfb821). 124 tests passing (28 new, all offline/mocked), typecheck + build clean. firebase/ai 1.4.1 matched plan. Added composed-spec store + getComposedScenario in PracticeContext (plan gap). nextScenario now async LLM-primary. Verified green by controller. Deep review folded into final whole-branch review.
- M4: complete. 6 commits (e8dcfe8..ef6f0aa). 135 tests passing (11 new), typecheck + build clean. Added recentRunsRef to avoid stale closure in applyResult ruin diagnosis; tier-3 complexity via minRewardRisk (not window tightening) to avoid changing odds. M0 account tests preserved. Verified green by controller.
- M5: complete. 8 commits (4d23973..525da88). 157 tests passing (22 new), typecheck + build clean. Adapted to real TrackEngine signature (sceneKind/resolve(spec,data,decision)); Candle imported from data/candles; scene kind 'market-make'; card auto-enables via curated scenarios. Verified green by controller.
- M6: complete. 8 commits (5338060..8a3a22f). 168 tests passing (11 new), typecheck + build clean. Installed @testing-library/react+dom+jsdom; one test opts into jsdom via file directive (no global config change). Analytics + a11y + copy + stats + plans index. Verified green by controller.
- ALL MILESTONES COMPLETE. 168 tests, typecheck + build clean.
- Final whole-branch review (332b13fe): Verdict CHANGES_REQUESTED. Invariants 1,2,4,5,6 satisfied. Critical C1: rubric dimensions (options thesis, charts read) keyed off realized P&L sign → breach of "grade process not P&L". Plus I1-I5 + 7 minor.
- Fix wave (c2715160): C1 + I1-I4 fixed. 4 commits (9a2eecd, b9708cd, 3bb619a, 9ea182f). I5 + 7 minor deferred (scope). Now 179 tests, typecheck + build clean. Verified green by controller.
- DONE (phase 1). Feature complete on feat/trading-practice (63 commits from base 47c17e8). NOT merged/pushed.

## Phase 2 — OpenAI GPT-5.5 + Generative-UI rebuild
Plan: docs/superpowers/plans/2026-06-25-practice-openai-genui-rebuild.md
Decisions: Cloud Functions secret boundary; hybrid scoring; full redesign; gpt-5.5 (Responses API); generative UI from validated rich interaction kit.
- [x] WS-A genui core (commit fa95b15; 215 tests, typecheck+build clean). Note: validator.ts⇄schema.ts safe cycle via hoisted fns — WS-C should extract lints to a leaf module if the functions bundler is cycle-strict. risk-slider→signal; size-slider→canonical shares.
- [x] WS-B rich interaction kit (commit 67404e9; 272 tests, typecheck+build clean). 14 widgets + WIDGET_COMPONENTS map. Notes for WS-E: wrap layouts in ChartDataProvider/ChainDataProvider/LegsProvider seeded from dataRef; price-lines/annotate draw their own chart (drop standalone candle-chart from charts default layout); pointer-drag is keyboard-tested only (verify drag in browser in WS-F). makeChartScale(candles,opts) exposes xFor/yFor/priceFor/indexFor.
- [x] WS-C Cloud Functions + GPT-5.5 (commits 26bd452,af21b43,c1ccff9,cbfb216; root 277 tests + 24 functions tests; functions build green; client bundle clean of key). aiRespond callable (auth + 15/min/uid + token clamp). Isomorphic genui shared via functions prebuild copy:shared → functions/src/shared/practice. Cycle fixed via copy-lint leaf. Notes for WS-D: build server-side composeScenario/gradeRun callables via functions/src/genui.ts using mirrored isomorphic builders (put builders under src/practice so copy:shared mirrors them); GPT-5.5 may reject `temperature` (use reasoning.effort, omit temperature); rate limiter in-memory (could move to Firestore).
- [x] WS-D composer(layout) + hybrid grader (root 322 tests; functions 39; builds green). composeScenario + gradeRun callables; gradeRunHybrid({...},transport)→{score,feedback,source}. Notes for WS-E: gradeRun not wired to a player yet — swap ScenarioPlayer to WidgetHost + gradeRunHybrid. Notes for WS-F: catalog client-built/server-enforced; mirror data files into functions deploy if hardening.
- [x] WS-E full UI redesign (commit a772dfd; 326 tests, typecheck+build clean). ScenarioPlayer rebuilt on WidgetHost flow; redesigned debrief (score ring + per-dim bars + LLM feedback + P&L display-only), PracticePage, player shell. Auth is Google-popup only → controller can't reach /practice headlessly; WS-F adds a DEV-only preview route for visual verification.
- [x] WS-F integration + curated fallbacks + DEV /preview (commit 48a34ac; root 333 tests; functions 39; builds green).
- [x] Controller browser verification at /preview (localhost): hub redesign + all 3 tracks render unique working accessible layouts. Charts: candlestick + 3 draggable color-coded entry/stop/target lines + Long/Short/Skip + size/confidence + gated submit. Options: real DIS chain leg builder (expiry/CALL-PUT/long-short/26 strikes/contracts/add-leg) + price chart + payoff (illustrative, exact). MM: quote ladder (mid 136.01, bid/ask, live spread 0.40%, quoting/cap) + width/size/inventory sliders. Note: browser screenshot pipeline lags SPA state by a step (cosmetic, dev-tool only).
- [x] Final whole-branch review of phase-2 (docs/superpowers/reports/phase2-review.md): 0 Critical, 3 Important, verdict fix-then-ship. All gates green.
- [x] Fix wave (commits a502d25, 3b623e7, 33ce7c5, 94fe04e): IMP-1 client re-validates server compose+grade (validateLayout/layoutFitsTrack + applyGradeGuard, fallback to curated/deterministic); IMP-2 bounded composeScenario input (rubric/nudge count 200, per-string 64, total 200k); IMP-3 removed dead aiRespond/getModelClient/coach*; MIN-1 numeric lint single digits; MIN-2 unconditional widget hooks; MIN-4 finite pnl. Deferred: MIN-3 (old Phaser scenes still wired to engines.ts), MIN-5.
- Final state: root 325 tests + typecheck + build green; functions build + 34 tests green. Phase-2 complete on feat/trading-practice. NOT merged/pushed. LIVE GPT-5.5 needs user prereqs (Blaze plan + `firebase functions:secrets:set OPENAI_API_KEY` + deploy/emulator).

### Log (phase 2)
