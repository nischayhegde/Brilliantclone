# Final whole-branch review — Trading Practice (M0–M6)

Branch: `feat/trading-practice` (base `47c17e8`). Suite green (168 tests), typecheck + build clean.

**Verdict: CHANGES_REQUESTED** — Critical 1 / Important 5 / Minor 7.

## Satisfied invariants (explicit)
- **Inv 1 (model never the source of a traded number):** core satisfied — traded numbers always come from real data; composer output passes catalog allow-list + numeric-claim lint; coach output sanitized; nothing invented reaches sim/P&L/grading. (See I1/I2/I3 for hardening.)
- **Inv 2 (LLM-primary + prefetch queue, curated fallback):** satisfied — `nextScenario` is async/queue-backed; app works with AI disabled (`getModelClient()` null → curated).
- **Inv 4 (honest fills / real data / labelled sims):** satisfied — deterministic resolvers, honest gap fills, labelled MM order flow + BS-as-estimate.
- **Inv 5 (Firestore owner-scoped + additive):** satisfied — practice account owner-only; practiceHistory/practiceEvents create-only/immutable; legacy protections intact.
- **Inv 6 (deterministic tests):** satisfied — mocked model + injected manifests; no network.
- Carried interfaces consistent; M6 a11y/disclaimers present.

## Critical
- **C1 — Rubric process totals depend on realized P&L sign (breaches Inv 3).**
  - `src/practice/rubrics/options.ts:~22` — `thesis` dimension = `outcome.pnl > 0 ? 0.9 : 0.3`.
  - `src/practice/rubrics/charts.ts:~21` — `read` dimension keys off realized `netMove` sign.
  - These dimensions feed `weightedTotal` → the process score → the rolling skill EMA → tier gating. A lucky win scores higher than an unlucky-but-well-reasoned loss. Fix: grade these dimensions from the **decision + spec + pre-decision context** (direction vs. stated bias, reward:risk set, stop/defined-risk discipline, sizing), never from `outcome.pnl`/realized move. Keep P&L in the outcome for display only. Update rubric tests to assert a well-processed losing trade scores ≥ a poorly-processed winning trade.

## Important
- **I1** — numeric-claim lint bypassable via a model-set `source` field (validateComposed). Harden: ignore/strip model-provided provenance fields; compute `source` server-side.
- **I2** — coach sanitizer only rejects `$`-prefixed numbers; bare numerics/percentages can slip. Broaden the numeric/percent detection against the whitelist.
- **I3** — grader trusts model-supplied `constraints`. Constraints used for grading must come from the validated spec/real data, not free model text.
- **I4** — `as never` casts in `engines.ts` hide the union dispatch from the type-checker. Replace with a typed discriminated dispatch.
- **I5** — charts track is single-decision long/short with no intra-trade management step (design/scope gap vs. richer PRD intent). Deferred as a known limitation (plans intentionally scoped charts to entry+stop+target); track for a future milestone.

## Minor
- 7 minor items (naming, small duplications, comment/label polish) — roll into M6-style polish later; non-blocking.

## Fixes applied

Branch `feat/trading-practice`. Gate after fixes: **179 tests pass** (was 168; +11 new), `tsc -b` clean, `vite build` clean. Core rule upheld: **grade process, not P&L.**

### C1 (CRITICAL) — Realized-P&L removed from every process-score dimension
P&L now influences **display only** (`ProcessScore.pnl`, titles, `detail` strings); no dimension `score` or `weightedTotal` reads `outcome.pnl`/`netMove`.

- **charts `read` (`src/practice/rubrics/charts.ts`)** — was `direction vs realized netMove`. Now grades a **coherent directional plan** from decision + spec + a pre-decision reveal price:
  - stop on the correct side of entry for the chosen direction,
  - target beyond entry in the trade direction,
  - entry within ±2% of the reveal price (the decision-split close) when that price is known.
  Score = fraction of those checks passed. A **skip** is scored neutrally (0.6) — no realized signal is consulted, so it is identical regardless of what the market did.
- **charts `management`** (also found during the audit) — was `outcome.pnl >= 0 ? 0.7 : 0.4`. Now **plan-adherence only**: held to plan = 1.0, early managed exit = 0.6 (graded on the action, not whether it was profitable).
- **options `thesis` (`src/practice/rubrics/options.ts`)** — was `outcome.pnl > 0 ? 0.9 : …`. Now grades a **coherent, defined-risk structure**: (1) finite combined max loss (recognized defined-risk structure), (2) strikes within ~50% of spot when spot is known, (3) every leg's expiry within a sane horizon (0 < DTE ≤ 365). Score = mean of the applicable checks.
- **Pre-decision facts added (setup facts, not realized outcomes):**
  - `src/practice/resolve/charts.ts` → `entryRef` (close at the decision split).
  - `src/practice/resolve/options.ts` → `spotAtEntry` (underlying close at the decision date).
  Both rubrics degrade gracefully if the fact is absent (the dependent check is simply omitted).
- **Audit results:** `src/practice/rubrics/marketMaking.ts` and `src/practice/rubrics/index.ts` (`weightedTotal`) — **no realized-P&L dependence found**. MM dimensions key off process/risk facts (`sigma`, `finalInventory`, `finalMid`, cap/size vs account); `pnl` appears only in the display `detail` string. `weightedTotal` is a pure weighted mean. No change needed.
- **Tests** (`charts.test.ts`, `options.test.ts`) now assert the invariant directly: each rubric proves its ex-P&L dimension is **identical for a win vs a loss**, and a **well-processed LOSING trade scores ≥ a poorly-processed WINNING trade**. All dimensions stay in [0,1]; weights unchanged.

### I1 — Provenance is server-set, not model-set (`src/practice/ai/validateComposed.ts`)
`validateComposed` now **forces `source = 'llm'`** on the normalized spec before any checks, so the numeric-claim lint runs unconditionally for composed output. A model self-declaring `source: 'curated'` can no longer skip the lint. Test added.

### I3 — Grading constraints come from the validated/real path, not model text
**Where constraints originate now:** for **curated** specs, from the curated catalog (trusted, as before). For **LLM-composed** specs, `validateComposed` **discards the model's `constraints`** and rebuilds them via `serverConstraints(track, accountBalance)`, where `accountBalance` is the real paper balance threaded from `ComposeRequest` through `composeScenario` (`src/practice/ai/composer.ts`). The grader (`ScenarioPlayer` → `getRubric(spec.rubricId)(spec, …)`) reads only `spec.constraints`, which is now server-owned for both paths. Values mirror the composer prompt (charts/MM: 2% risk, stop required, R:R ≥ 1.5; options: 5% risk, defined-risk required), so a well-behaved model is unaffected; a malicious one cannot widen limits. Test added.

### I2 — Coach output sanitizer broadened (`src/practice/ai/coachPrompt.ts`)
`sanitizeCoachText` previously only caught `$`-prefixed numbers. It now scans **`$`-prefixed, bare, and percentage** numerals and rejects any not on the whitelist. The whitelist = whitelisted real facts **plus the scaffolding we hand the coach** (its score, the pass bar, the 0–100 scale, and the per-dimension percentages it is shown), so ordinary prose and legitimate score/percentage restatements are not over-rejected. Tests added for a bare-number leak, a percentage leak, an allowed-scaffolding case, and a plain-prose case.

### I4 — Typed discriminated dispatch in engines (`src/practice/engines.ts`)
Removed the `as never` casts. Resolution now flows through a single exhaustive `resolveScenario(spec, data, decision)` that **switches on the `spec.track` discriminant**, with an `assertNever` default so the compiler enforces total track coverage and each branch asserts to the precise decision/data type the resolver expects. Each engine's `resolve` delegates to it; behavior is identical and `engines.test.ts` passes unchanged.

### Out of scope (left as-is, per instructions)
- **I5** (charts intra-trade management *step*) — deferred design item; untouched.
- The 7 **Minor** items — deferred.

### Final gate output
```
npm test       → Test Files 33 passed (33) · Tests 179 passed (179)
npm run typecheck → tsc -b clean
npm run build  → tsc -b && vite build → built OK
```
