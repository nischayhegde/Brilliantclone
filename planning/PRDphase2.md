# PRD — Phase 2: "Trading Practice" Scenario Mode

> **Status:** Draft for review · **Author:** product + research synthesis · **Date:** 2026-06-25
> **Builds on:** `PRD1.md` (MVP), `LESSON_PLAN1.md`, `POLISH_STYLE_GUIDE.md`, `PRODUCT.md`,
> and `educational research/` (the 2025–2026 landscape study).
> **Supersedes:** the one-paragraph Phase 2 seed (kept verbatim in §2.1 for traceability).

---

## 1. Overview

Phase 1 shipped a Brilliant-style **learn** experience: 5 lessons / 84 modules of animated,
manipulable Phaser scenes backed by real, verified market data and exact math. The single
biggest gap users hit everywhere in the research is the **theory → execution bridge**:
*"there is no bridge from watching videos to placing trades."*

Phase 2 adds a **Practice** mode: a persistent paper account in which the learner plays
**scenarios** — self-contained trading exercises built on **real historical market data** —
across three tracks (chart-pattern trading, market making, options strategies). An LLM
**composes and coaches** scenarios; it never fabricates a price, premium, or Greek. The
learner is graded on **process, not P&L**, and scenario **complexity** scales with
demonstrated **skill** (not luck).

This is the white space the research identifies: *no competitor combines Duolingo-grade
gamification, a deep options curriculum, a realistic option-chain simulator, and a
compliant AI tutor that grades process.* Phase 1 is the curriculum; Phase 2 is the
simulator + process-grading + guardrailed AI coach.

---

## 2. Background & the core tension (resolved)

### 2.1 The Phase 2 seed (verbatim, for traceability)

> *In phase 2 we will add a "trading practice" challenge which will use LLM's to generate
> real trading scenarios for the user. The trading scenarios will encompass chart patterns,
> market making, and options strategies. The user will have a starting paper balance of
> $10000 which they can use in these trading scenarios. If they go below $1000 they fail.
> The scenarios will get progressively more technically complex when the user starts growing
> their balance. The difficulty of actually making money in these scenarios should be
> constant because the scenarios should be based on real markets. The only thing that should
> change is the scenario complexity. If their balance falls the scenarios should become much
> simpler.*

### 2.2 The tension and how we resolve it

The seed says **"use LLMs to generate real trading scenarios."** The product's entire trust
premise is the opposite: `PRD1.md` "What Not To Do" forbids *"dynamically AI generate
modules or charts; all charts must come from real stocks,"* `PRODUCT.md` makes **"earned
trust through accuracy"** a core principle, and `POLISH_STYLE_GUIDE.md` §3 is a
non-negotiable accuracy contract.

**Resolution (decided):** the LLM **picks the setup and parameters and writes the coaching
prose**, but **every candle, premium, Greek, and P&L the learner trades against comes from
real bundled/historical data and exact math.** A deterministic validator enforces this
boundary (§8). This is the seed's intent ("scenarios based on real markets") implemented
without breaking the brand.

### 2.3 What the research changed about the seed

| Seed instinct | Research finding | Decision |
|---|---|---|
| Grow balance to level up; **fail < $1k** | "Reward good decisions over lucky P&L"; "highest-return contests incentivize reckless risk"; OSC RCTs: outcome rewards drove ~39% more trades | **Grade process; gate progression on skill.** Keep $10k + adaptive difficulty as a *risk* layer; the $1k floor becomes a coached **reset-and-reflect**, not a hard fail (§11). |
| $10k paper balance | Realistic balances beat $1M fantasy ("real skills, not false confidence") | **Keep $10k** (already research-aligned). |
| Difficulty of making money constant; complexity scales with balance | Short-run P&L is mostly luck → balance is a noisy competence signal | **Complexity scales with rolling *skill score*,** not balance. |
| LLM generates scenarios | "Differentiator is pedagogy, not content"; guardrailed AI that grades *process* is the wedge | LLM = **composer + coach**, deterministic engine = **truth + grader** (§7). |
| (absent) | Contextual in-sim nudges ~**doubled** learning gains (RCT) | **Decision-point nudges + journaling** are first-class (§9, §10). |
| (absent) | Sim-vs-real emotional gap; "overconfidence factory" | **Mandatory micro-journal** (rationale + feeling) and honest framing (§10). |

---

## 3. Goals & non-goals

### 3.1 Goals
- **G1 — Bridge theory → execution.** Every concept from the 5 lessons becomes *playable*
  on real data, one tap from "the trade the lesson just described."
- **G2 — Build *good* habits.** Reward correct reads, sizing, defined risk, and management;
  make reckless "wins" score poorly.
- **G3 — Keep the trust wedge.** No AI-fabricated market data; everything verifiable to the
  cent, same standard as the lessons.
- **G4 — Personalized, near-infinite variety** via LLM composition over a real-data catalog.
- **G5 — Retention via honest gamification** (skill mastery, streaks of good process,
  risk-adjusted progress) — never trade frequency or raw P&L.

### 3.2 Non-goals (YAGNI)
- **N1** — Not a real brokerage; no real money, no order routing, no "go live" handoff in
  Phase 2.
- **N2** — Not live/real-time market data in v1 (uses bundled + curated historical snapshots;
  live fetch is a later increment).
- **N3** — No social leaderboards in v1 (deferred; if added, must be risk-adjusted, never
  raw return — see research §gamification).
- **N4** — No full depth-of-book HFT simulation in v1 market making (simplified
  inventory/spread model first; see §7.3).
- **N5** — No new monetization/paywall logic in this PRD.

---

## 4. Persona & user stories

**Persona** (from `PRODUCT.md`): retail-curious beginners, little/no finance background,
self-directed, want genuine intuition without risking money or being sold to.

**User stories**
- As a learner who finished *Reading the Charts*, I want to **trade a pattern I just learned
  on a fresh real chart** and get told whether my *process* was sound.
- As a learner, I want scenarios that **get more complex as I get better**, and **simpler when
  I'm struggling**, so I'm always challenged but never overwhelmed.
- As a learner, I want a **paper account** that persists, so practice feels consequential.
- As an options-curious user, I want to **build a defined-risk position on a real setup**, watch
  real time/IV decay play out, and learn *why* I was right or wrong.
- As a returning user, I want my **practice progress, skill scores, and journal** saved.
- As a cautious user, I want to **never be lied to**: if a number is illustrative I want it
  labelled; if it's real I want to trust it.

---

## 5. Feature overview & primary flow

```
Dashboard ──▶ Practice (new top-level mode)
                 │
                 ├─ Paper account header: balance $X · tier · skill rings (3 tracks)
                 │
                 ├─ "Next scenario" (adaptive) ── or pick a track
                 │
                 ▼
        ┌──────────────── Scenario lifecycle ────────────────┐
        │ 1. Brief      LLM-written setup + objective (real data loaded)
        │ 2. Decide     learner acts in a Phaser ScenarioScene
        │               (entry/size/stop/target | quotes | legs)
        │ 3. Nudge      decision-point nudges fire on risky inputs
        │ 4. Resolve    real subsequent data plays out (deterministic)
        │ 5. Journal    one-line rationale + feeling (required to finish)
        │ 6. Grade      deterministic process score (0–100) + P&L
        │ 7. Debrief    LLM coach explains the score + the lesson
        └─────────────────────────────────────────────────────┘
                 │
                 ▼
   Update paper balance · rolling skill score · history · adapt next difficulty
```

The lifecycle deliberately mirrors the best loop in the research (TradeSchool AI's
*concept → sim → grade → debrief*) and reuses the **existing self-grading harness**: a
`ScenarioScene` reports `{correct, score, title, detail}` over the same bus the `challenge`
modules already use (`this.report(...)`, `SceneBus`).

---

## 6. Research grounding → concrete principles

Distilled from `educational research/` (README, 05-simulators, 07-options, 09-apps):

1. **Embed learning inside the sim.** Contextual nudges roughly **doubled** knowledge gains
   in an RCT → §9 nudges are mandatory at decision points.
2. **Grade process, not P&L.** → §10 deterministic rubric is the score of record.
3. **Make realism honest.** Model spread/slippage/fees; label anything illustrative;
   show "what your fill really was." → §7, §12 accuracy contract.
4. **Address the emotional gap.** Paper ≠ live; "overconfidence factory." → §10 journal +
   honest framing; debrief calls out self-attribution bias.
5. **Scaffold complexity by competence, not time/luck.** → §11 difficulty ladder.
6. **Options is the blind spot;** teach the Greeks/IV/POP by *manipulation*. → §7.4 reuses
   `PayoffScene`/`optionMath`; nudges target IV crush, theta, undefined risk, sizing.
7. **Guardrailed AI that explains the *why*.** Never predicts prices / picks stocks / gives
   advice. → §13 system prompt + validation.

---

## 7. The three scenario tracks

All three ship in Phase 2 (per decision), each grounded in an existing lesson's engine so we
**reuse, not rebuild**. Each track defines: the real-data source, what the learner does, the
process dimensions graded, and how the outcome resolves deterministically.

### 7.1 Shared scenario contract
Every scenario, regardless of track, is described by a **`ScenarioSpec`** (§8.1) and played
in a **`ScenarioScene`** (a `ModuleScene` subclass) that:
- loads only **referenced real data** (by key) — never numbers from the LLM,
- collects the learner's **decisions** (typed actions),
- fires **nudges** on risky inputs,
- on Submit, runs the **deterministic resolver** over real subsequent data,
- emits a graded `result` (process score + P&L + title + detail) via the bus.

### 7.2 Track A — Chart-pattern trading
- **Builds on:** `reading-charts` (L1) + `short-selling` (L3); reuses `CandleChartScene` and
  the existing quiz "mask at split → reveal" mechanic (already a candle-by-candle replay).
- **Real data:** windows from `src/data/candles.ts` (and the curated catalog), each tagged
  with verified pattern, decision-split index, and the *actual* outcome (the LESSON_PLAN
  already encodes "completes vs fakeout" with exact levels).
- **Learner does:** at the split, decide **take / skip**; if taking, set **direction, position
  size, stop, and target**; then the hidden candles play out and the learner may **manage**
  (exit early / hold).
- **Resolves:** P&L from the **real** subsequent OHLC; stop/target fills modeled honestly
  (gap-through fills at the open, not the level; spread/fee applied).
- **Process graded (§10):** valid setup at the split · sizing within risk budget · stop
  defined and sane · reward:risk ≥ threshold · management/plan-adherence. A "win" from an
  unsized, stopless trade scores **low** even if profitable.

### 7.3 Track B — Market making
- **Builds on:** `order-book` (L2): `scenes/book.ts` matching engine, `WalkBookScene`,
  `SpreadCostScene`, `MatchingEngineScene`.
- **v1 model (simplified, honest):** a single-name **inventory + spread-capture** sim seeded
  from **real spread, volatility, and volume stats** of a real historical window. The learner
  posts a **two-sided quote** (bid/ask width + size) and manages **inventory** as simulated
  flow + the real underlying drift hit their quotes. Captures spread when filled; suffers
  **adverse selection** when the real price runs through inventory.
- **Explicitly labelled** "Simulated flow · spread/inventory math exact" (per accuracy
  contract). We do **not** claim a real L2 book in v1.
- **Later increment (within Phase 2):** depth-of-book replay if a real L2 dataset is sourced.
- **Process graded:** spread width appropriate to real volatility · inventory kept within
  limit · skewing quotes to reduce risk · not "leaning" into a trend · drawdown control. P&L
  is secondary to **risk-adjusted spread capture**.
- **Risk flag:** this is the most novel track with the least existing scaffolding — it is the
  **last** of the three to reach polish (see milestones §16).

### 7.4 Track C — Options strategies
- **Builds on:** `options` (L4) + `volatility` (L5); reuses `PayoffScene`, `optionMath.ts`
  (`Position`, `pnlPerContract`, `breakeven`, `maxLoss`, `maxGain`, `moneyness`), and
  `volatility/scenes/payoffMath.ts`.
- **Real data:** real underlying windows from `candles.ts` + **curated real option-chain
  snapshots** (strike grid, expiries, premiums, IV at a real date). Where a premium is a
  reconstructed/illustrative example, it is **labelled** exactly as the lessons do
  ("Premium illustrative; math exact").
- **Learner does:** given a thesis + a real chain context, **build a (multi-leg) position**
  (long call/put, vertical, covered call, CSP, iron condor…), choosing **strike/expiry/size**;
  then **time advances** through the real underlying path with an IV path, and the learner can
  **roll / close / hold**.
- **Resolves:** P&L via `optionMath` against the realized underlying + IV; assignment modeled
  for short legs; theta/IV effects shown on the live `PayoffScene` curve (the "P/L today vs at
  expiry" gap the research calls the killer feature).
- **Process graded:** strategy fits the thesis/IV regime · **defined max loss** · sizing by
  max-loss (not premium) · strike/expiry sanity (e.g., ~0.20–0.30 delta, 30–45 DTE for
  premium selling) · management at ~50% profit / roll discipline.

---

## 8. Architecture — the pipeline

```
                 ┌─────────────┐   ScenarioSpec (JSON, refs real data by key)
   adaptive  ──▶ │ LLM Composer│ ───────────────────────────────────────────┐
   request       └─────────────┘                                             ▼
                                                                      ┌──────────────┐
   curated catalog (fallback/cache) ───────────────────────────────▶ │  Validator   │
                                                                      │ (deterministic)│
                                                                      └──────┬───────┘
                                                          reject/regenerate ◀┘  pass
                                                                                 ▼
                                                                      ┌──────────────┐
                                              real data (candles.ts, │  Sim engine  │
                                              chain snapshots, book) │ (ScenarioScene)│
                                                                      └──────┬───────┘
                                                       learner decisions      ▼
                                                                      ┌──────────────┐
                                                                      │ Process Grader│  (deterministic rubric)
                                                                      └──────┬───────┘
                                                            score+P&L         ▼
                                                                      ┌──────────────┐
                                                                      │  LLM Coach   │  (prose only: debrief/explain score)
                                                                      └──────────────┘
```

**Invariant:** numbers flow LLM → (text + references) → validator → **real data** → sim →
grader → LLM (text). The LLM is upstream of validation and downstream of grading; it is
**never** the source of a traded number.

### 8.1 `ScenarioSpec` (proposed schema)

```ts
// src/practice/types.ts (new)
export type Track = 'charts' | 'market-making' | 'options'

export interface ScenarioSpec {
  id: string                 // stable id (catalog) or generated uuid
  track: Track
  tier: number               // 1..N difficulty tier (drives complexity, not P&L odds)
  title: string              // LLM prose
  brief: string              // LLM prose: setup + objective (no traded numbers)
  // --- the ONLY link to market truth: references, never literals the LLM invented ---
  dataRef: {
    candlesKey?: string                 // key into CANDLES (Track A/C underlying)
    chainSnapshotKey?: string           // key into curated option-chain snapshots (Track C)
    bookStatsKey?: string               // key into real spread/vol stats (Track B)
    splitIndex?: number                 // decision point (Track A)
    revealToIndex?: number              // resolution window end
  }
  objective: ScenarioObjective          // machine-checkable success target
  constraints: RiskConstraints          // sizing/loss limits the rubric reads
  rubricId: string                      // which deterministic rubric grades this
  nudges: NudgeRule[]                    // decision-point checks (id + trigger + copy)
  coachContextKeys: string[]            // which real facts the debrief LLM may cite
  illustrativeFlags?: string[]          // fields to label "illustrative; math exact"
}
```

The composer's job is to emit a **valid `ScenarioSpec`**; it has no other power.

### 8.2 Validator rules (deterministic — the trust gate)
A spec is **rejected** (→ regenerate, then → curated fallback) unless **all** hold:
1. Every `dataRef.*Key` resolves to existing real data; indices in range.
2. Every numeric fact the brief/objective references is **derivable from real data within
   tolerance** (re-computed, compared — the `LESSON_PLAN` adversarial pass, automated).
3. The `objective` is **achievable** given the real outcome (no impossible targets).
4. `rubricId` exists; `constraints` are well-formed; `nudges[].id` are known.
5. The brief contains **no disallowed claims** (no price prediction, no "advice," no
   guaranteed outcome) — a lint pass + the LLM guardrail prompt.
6. Anything not provable from real data must be in `illustrativeFlags` and rendered labelled.

This mirrors `src/lessons/registry.test.ts` (a build-time contract) — we add a
`scenarioRegistry.test.ts` + a runtime validator for generated specs.

---

## 9. Decision-point nudges (the RCT lever)

Nudges are short, contextual pop-ups fired by the `ScenarioScene` when a learner's *input*
(not outcome) is risky — the intervention the research shows ~doubles learning gains. They
**inform, never block**, and each is logged for the debrief.

Examples (deterministic triggers):
- **Sizing:** position risk > X% of account → *"This risks {pct}% of your account on one
  trade. Pros risk 1–2%."*
- **No stop (charts):** taking a trade with no stop → *"No stop set — your max loss is
  undefined."*
- **Undefined-risk options:** naked short leg → *"This leg has unbounded loss. Want to define
  it with a spread?"*
- **IV crush (options):** opening a long premium into earnings/high IV → the
  umbrella-surge analogy from the style guide.
- **Overtrading:** rapid repeated entries → *"You've taken {n} trades in {t}. Overtrading is
  the #1 account killer."* (OSC finding.)

Nudge copy follows `POLISH_STYLE_GUIDE.md` voice (plain, warm, one analogy, no hype).

---

## 10. Scoring — process first (deterministic)

The **score of record is a deterministic Process Score (0–100)**, computed by a pure module
(`src/practice/grading/*`, no LLM, fully unit-tested like `domain/progress.ts`). P&L is
displayed and tracked but **does not gate progression**.

### 10.1 Dimensions (weighted per track)
| Dimension | Charts | Market making | Options |
|---|---|---|---|
| Correct read / thesis | ✓✓ | ✓ | ✓✓ |
| Position sizing / risk-per-trade | ✓✓ | ✓✓ | ✓✓ |
| Defined max loss (stop / defined-risk) | ✓✓ | ✓ (inventory limit) | ✓✓ |
| Reward:risk / spread vs vol | ✓ | ✓✓ | ✓ |
| Management / plan adherence | ✓ | ✓✓ | ✓✓ |
| IV / strike / expiry sanity | — | — | ✓✓ |

A profitable but reckless trade (no stop, oversized) **scores low**; a sound, well-managed
loss scores **well** ("good process, unlucky outcome"). This is the explicit anti-gambling
design from the research.

### 10.2 Journal (required to finish)
Before grading, the learner writes a **one-line rationale + a feeling tag** (confident /
anxious / fomo / revenge / calm). Stored in history; surfaced in the debrief to confront
**self-attribution bias** ("you called this 'fomo' and it scored 38 — notice the pattern").

### 10.3 Debrief (LLM, prose only)
The LLM receives the **deterministic score, the decisions, the nudges fired, the journal, and
the whitelisted real facts** (`coachContextKeys`) and writes the explanation. It may not
restate or invent numbers outside that whitelist; it explains the *why* and the lesson.

---

## 11. Difficulty ladder, paper account & the $10k/$1k reframe

### 11.1 Paper account
- Starts at **$10,000**. Persisted per user (§15). One account spanning all tracks (with
  per-track skill rings).
- Realistic frictions modeled (spread, fees, slippage/gap fills) so P&L is honest.

### 11.2 Complexity tiers (scale with **skill**, not balance)
- Each track has tiers `1..N`. **Tier up** when the **rolling Process Score** over recent
  scenarios crosses a threshold (competence-gated, per research). **Tier down** when it falls.
- Tier raises **complexity only** (more legs, tighter management windows, noisier patterns,
  wider inventory swings) — **not** the odds of making money, which stay market-realistic
  (honoring the seed's "constant making-money difficulty").

### 11.3 The $1,000 floor → "reset & reflect" (not a hard fail)
- Hitting **< $1,000** triggers a **coached reset**: a mandatory debrief on *what blew up the
  account* (oversizing? no stops? revenge trades from the journal?), then the account resets to
  $10,000 at a **lower tier**. The drawdown lesson (the seed's intent) is preserved; the
  retention-killing permanent "fail" is removed (research: beginners are the cohort that
  matters; punishing variance churns them).
- A **"ruin events"** counter is kept (honest signal of risk discipline), shown in history.

---

## 12. Accuracy contract (extends `POLISH_STYLE_GUIDE.md` §3)

All §3 rules apply unchanged. Additions for Practice:
- **No traded number originates from the LLM.** Candles, premiums, Greeks, fills, and P&L come
  from `candles.ts`, curated chain snapshots, `optionMath.ts`, `payoffMath.ts`, `book.ts`.
- **Every illustrative field is labelled** in-scene (reuse the existing "Premium illustrative;
  math exact" / "Simulated flow · math exact" patterns).
- **Honest fills:** stops/targets that gap are filled at the **real open through the level**,
  not the level; spread + fee always applied; the debrief may show "your fill vs the level."
- **Math source files stay read-only** (`book.ts`, `optionMath.ts`, `payoffMath.ts`,
  `candles.ts`). Practice adds new pure modules; it does not edit the lesson math.

---

## 13. LLM integration & guardrails

- **Provider:** Firebase AI Logic (Gemini) to fit the existing Firebase stack
  (`src/lib/firebase.ts`), called behind a **server boundary** (Cloud Function / callable) so
  keys are never client-side and **every output passes the validator** before reaching the UI.
- **Two call sites only:** (1) **Composer** → returns a `ScenarioSpec` (validated); (2)
  **Coach** → returns debrief prose (constrained to whitelisted facts). An optional **Q&A
  tutor** is a later increment, same guardrails.
- **System prompt guardrails (the "Rex" model from research §07/§09):** *never predicts
  prices, never picks stocks, never gives financial advice, never invents market numbers,
  always teaches the why, always defers traded numbers to provided real data.*
- **Cost control:** the **curated catalog is the cache + offline fallback** — onboarding and
  the first scenarios are instant and free; live composition fills in variety. If the LLM is
  unavailable or fails validation twice, serve a curated scenario seamlessly.
- **Determinism for tests:** composer/coach are mockable; all grading/sim is deterministic so
  CI never depends on the model.

---

## 14. Telemetry & analytics (privacy-respecting)
Track (per scenario): track type, tier, decisions, nudges fired, process score + per-dimension
breakdown, P&L, journal feeling tag, ruin events, completion/abandon. Purpose: tune rubrics,
nudges, and the difficulty ladder; measure whether process scores improve over time (the real
success metric). No third-party ad trackers (anti-reference: no gambling/hype mechanics).

---

## 15. Data model & security rules impact

### 15.1 Firestore
Add an **additive** practice namespace so the deployed monotonic rules on the legacy
`progress`/`bestStreak` fields keep holding (see `services/userService.ts` notes):

```
users/{uid}
  ├─ (existing) lessonProgress, bestStreak, profile fields
  └─ practice: {                      // new sub-object (single doc) or subdoc
       account: { balance: number, tier: { charts:number, marketMaking:number, options:number },
                  startedAt, ruinEvents: number },
       skill:   { charts:number, marketMaking:number, options:number },  // rolling 0..100
       updatedAt
     }
users/{uid}/practiceHistory/{scenarioRunId}    // subcollection (one doc per completed run)
     { specId, track, tier, decisions, nudgesFired[], score, breakdown, pnl,
       journal:{ rationale, feeling }, createdAt }
```

- Mirror the existing pattern: a **pure reducer** (`src/practice/account.ts`, unit-tested like
  `domain/progress.ts`) computes new balance/skill/tier; a **service**
  (`src/services/practiceService.ts`) persists via merge writes (like `persistLessonProgress`).
- **New `firestore.rules`:** scope `practice`/`practiceHistory` to the owning uid; validate
  shapes/ranges; keep legacy rules untouched. (Requires a rules redeploy — called out in §16.)

### 15.2 React state
A `PracticeContext` (sibling to `LessonProgressContext`) loads/persists the account + recent
history and exposes the adaptive "next scenario" selector.

---

## 16. Engine reuse map & new surface

**Reuse (no edits):** `ModuleScene` (helpers: `slider`, `button`, `report`, `setCanSubmit`,
`fs`, `dur`, reduced-motion), `SceneBus`/`bus.ts` events (`submit`/`canSubmit`/`result`/
`reveal`/`set`), `CandleChartScene`, `PayoffScene`, `optionMath.ts`, `payoffMath.ts`,
`book.ts`, `palette.ts`, `PhaserCanvas`, `ModuleRenderer`/`ModuleShell` patterns.

**New code:**
- `src/practice/types.ts` — `ScenarioSpec`, actions, rubric types.
- `src/practice/scenarioRegistry.ts` (+ `.test.ts`) — curated catalog + lookup (mirrors
  `lessons/registry.ts`).
- `src/practice/validator.ts` (+ `.test.ts`) — the trust gate (§8.2).
- `src/practice/grading/*` (+ tests) — deterministic process rubrics (§10).
- `src/practice/account.ts` (+ `.test.ts`) — pure account/skill/tier reducer (§15).
- `src/engine/scenes/ScenarioScene.ts` — base for playable scenarios (extends `ModuleScene`).
- Track scenes: `ChartTradeScene`, `MarketMakeScene`, `OptionsBuildScene` (compose existing
  scenes where possible).
- `src/services/practiceService.ts`, `src/services/aiComposer.ts`/`aiCoach.ts` (server-bound).
- `src/state/PracticeContext.tsx`.
- `src/pages/PracticePage.tsx` (+ scenario player), dashboard entry, routes in `App.tsx`
  (`/practice`, `/practice/:track?`).

---

## 17. Milestones (phased within Phase 2)

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| **M0** | Foundations | `ScenarioSpec`, validator, registry, account reducer, `PracticeContext`, routes, Firestore rules + redeploy | typecheck + tests green; empty Practice page loads; account persists |
| **M1** | Track A (charts) curated | `ChartTradeScene`, charts rubric, nudges, journal, debrief (curated specs, no LLM) | a learner can play 10 curated chart scenarios end-to-end; process score correct; honest fills |
| **M2** | Track C (options) curated | `OptionsBuildScene` reusing `PayoffScene`/`optionMath`, options rubric, chain snapshots | multi-leg build + time/IV resolve + management; defined-risk nudges fire |
| **M3** | LLM composer + coach | server boundary, guardrail prompt, validation loop, catalog fallback/cache | generated specs always pass validation or fall back; debrief constrained to whitelist |
| **M4** | Adaptive difficulty | tiers, rolling skill, $1k reset-and-reflect | tier up/down verified; reset flow coached |
| **M5** | Track B (market making) | simplified inventory/spread sim on real stats, MM rubric | playable, labelled "simulated flow", risk-adjusted scoring |
| **M6** | Polish | analytics, a11y/reduced-motion pass, copy pass vs style guide | meets the craft floor; research-traceability check (§19) |

(Ordering reflects engine-reuse leverage: charts/options reuse the most existing scenes;
market making is newest and last, per §7.3 risk flag.)

---

## 18. Risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM fabricates/leaks a traded number | Validator rejects any unprovable figure; LLM output is text+refs only; debrief whitelisted |
| LLM cost/latency | Curated catalog as cache+fallback; ≤2 calls/scenario; instant first-run |
| Market-making realism oversold | Label "simulated flow · math exact"; ship simplified model first; no L2 claim |
| Process rubric feels arbitrary | Deterministic, documented, unit-tested; per-dimension breakdown shown; tune via telemetry |
| Difficulty ladder frustrates | Skill-gated + adaptive down; reset-and-reflect not hard fail |
| Firestore rules regression | Additive namespace; keep legacy fields/rules; explicit rules test + staged redeploy |
| Scope creep (3 tracks at once) | Milestones gate tracks; A & C first; B last; leaderboards/live-data explicitly out (N2–N5) |
| Overconfidence ("paper ≠ live") | Honest framing + journal + debrief on self-attribution; realistic balance + frictions |

---

## 19. Traceability

### 19.1 To the Phase 2 seed
| Seed requirement | Where satisfied |
|---|---|
| LLM-generated trading scenarios | §7–§8 LLM composer (validated, real-data-backed) |
| Chart patterns, market making, options | §7.2 / §7.3 / §7.4 (all three) |
| $10,000 starting paper balance | §11.1 |
| Below $1,000 → fail | §11.3 reframed to coached **reset & reflect** (research-justified) |
| Complexity rises as the user grows | §11.2 — tied to **skill**, not luck (research-justified) |
| Making-money difficulty constant / real-market-based | §7, §11.2, §12 (real data; tiers change complexity only) |
| Falling balance → simpler scenarios | §11.2 tier-down + §11.3 reset |

### 19.2 To the research (`educational research/`)
| Research principle | Where |
|---|---|
| Bridge theory→execution | §1, §5, G1 |
| Embed nudges (≈2× learning) | §9 |
| Grade process, not P&L | §10 |
| Honest realism (fills/fees/labels) | §12 |
| Emotional gap / journaling | §10.2, §18 |
| Scaffold by competence | §11.2 |
| Options visualization (Greeks/IV/POP) | §7.4 |
| Guardrailed AI ("Rex" model) | §13 |
| Avoid overtrading/herding gamification | §9, §10, N3 |

### 19.3 To Phase-1 product principles (`PRODUCT.md`, `PRD1.md`, `POLISH_STYLE_GUIDE.md`)
| Principle | Where |
|---|---|
| No AI-generated market data | §2.2, §8, §12 |
| Earned trust through accuracy | §8.2 validator, §12 |
| Show, don't tell / one idea per module | §5, §7 (manipulable scenes) |
| Calm confidence, no hype/gambling | §9 copy, §10 (no raw-P&L reward), N3 |
| Reuse engine, keep tests green | §16, scenarioRegistry.test, reduced-motion |

---

## 20. Open questions
1. **Option-chain data source** for Track C: curate static real snapshots (chosen for v1) vs
   reconstruct from an options dataset later? (affects breadth of options scenarios)
2. **LLM budget/quota** per user (rate limits, anonymous vs signed-in caps).
3. **Skill thresholds** for tier up/down — seed with reasonable defaults, then tune from §14
   telemetry.
4. **Market-making realism ceiling** — is the simplified inventory/spread model enough for v1
   pedagogy, or is a real L2 dataset worth sourcing during Phase 2?
5. **Leaderboards** — keep deferred (N3), or add a **risk-adjusted** one early for retention?
