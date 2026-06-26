# Practice Mode — M0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Practice-mode skeleton — shared types, the deterministic validator + scenario registry, the pure account/skill reducer, the Firestore-backed `PracticeContext`, security rules, and an empty `/practice` route — so later milestones plug tracks into a working, persisted shell.

**Architecture:** Mirror the proven lesson stack one-for-one: a pure domain reducer (`src/practice/account.ts`, tested like `src/domain/progress.ts`), a registry (`src/practice/scenarioRegistry.ts`, tested like `src/lessons/registry.test.ts`), a service of Firestore merge-writes (`src/services/practiceService.ts`, like `userService.ts`), and a React context (`src/state/PracticeContext.tsx`, like `LessonProgressContext.tsx`). The `ScenarioSpec` is the only contract between an LLM composer (M3) and the deterministic engine; M0 builds the validator that guards it.

**Tech Stack:** Vite + React 18 + TypeScript (strict), Phaser 3.90, Firebase 11 (Auth + Firestore), Vitest 2, react-router-dom 6, Tailwind v4.

## Global Constraints

- **Package manager / scripts:** `npm run typecheck` (`tsc -b`), `npm test` (`vitest run`). Both MUST pass at every commit.
- **ESM only** (`"type": "module"`); use `import`/`export`, no `require` in `src/`.
- **Accuracy contract (POLISH_STYLE_GUIDE §3 + PRDphase2 §12):** No traded number (candle, premium, Greek, fill, P&L) may originate from an LLM. All numbers come from real data (`src/data/candles.ts`, `public/data/ohlc/*`, `public/data/options/*`) and pure math (`optionMath.ts`, `payoffMath.ts`, `book.ts`). Any non-real figure is labelled "illustrative; math exact".
- **Read-only math files:** `src/lessons/options/scenes/optionMath.ts`, `src/lessons/volatility/scenes/payoffMath.ts`, `src/lessons/order-book/scenes/book.ts`, `src/data/candles.ts` are NOT edited by Practice. Practice adds new pure modules under `src/practice/`.
- **Additive Firestore only:** never change the legacy `progress`/`bestStreak` fields or their rules; add a `practice` object + `practiceHistory` subcollection so the deployed monotonic rules keep holding.
- **Testing strategy:** Pure modules (`types` consumers: `validator`, `account`, rubric math, `scenarioRegistry`) get full RED→GREEN TDD with real Vitest code. Phaser scenes and React pages are NOT unit-tested directly (canvas needs a real browser); they are covered by registry/wiring smoke tests with `phaser` mocked (exactly as `src/lessons/registry.test.ts` does) plus a manual run. This is the codebase's existing, deliberate approach — a wiring test is the deliverable for scene tasks, not a jsdom render test.
- **Reduced motion:** any new scene must route motion through `ModuleScene` `dur()`/`reduceMotion`/`loop()`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/practice/types.ts` (new) | All shared Practice types: `Track`, `Decision` union, `ScenarioSpec`, `RiskConstraints`, `ProcessScore`, rubric/result types. The contract every later milestone imports. |
| `src/practice/validator.ts` (+ `.test.ts`) | Deterministic trust gate: `validateSpec(spec) → {ok, errors}` (PRDphase2 §8.2). |
| `src/practice/scenarioRegistry.ts` (+ `.test.ts`) | Curated `ScenarioSpec[]` catalog + lookups (`getScenario`, `scenariosFor(track, tier)`), wiring test mirrors lesson registry. |
| `src/practice/account.ts` (+ `.test.ts`) | Pure account reducer: balance, rolling skill (EMA), `tierFor`, ruin detection. |
| `src/practice/rubrics/index.ts` (+ `.test.ts`) | `Rubric` type + `RUBRICS` map + `getRubric(id)`; ships a `noop` rubric for M0 (real rubrics land M1/M2/M5). |
| `src/practice/nudges.ts` (+ `.test.ts`) | Nudge catalog: pure trigger predicates by id (sizing, no-stop, undefined-risk, overtrading). |
| `src/services/practiceService.ts` | Firestore: `getOrCreatePracticeData`, `persistPracticeState`, `appendPracticeRun`. |
| `src/state/PracticeContext.tsx` | Loads/persists account + recent history; exposes `applyResult`, `nextScenario`. |
| `src/pages/PracticePage.tsx` (new) | Empty-but-real Practice landing (account header + track rings + "coming soon" body). |
| `src/App.tsx` (modify) | Wrap routes in `PracticeProvider`; add `/practice` and `/practice/:track`. |
| `src/components/TopNav.tsx` (modify) | Add a "Practice" nav link. |
| `firestore.rules` (modify) | Add `practiceOk` validation to the `users/{uid}` update rule + a `practiceHistory` subcollection rule. |
| `firestore.rules.test` note | Manual emulator/console verification steps (no automated rules test harness exists yet). |

---

## Task 1: Shared Practice types

**Files:**
- Create: `src/practice/types.ts`
- Test: (none — pure type declarations; consumed/typechecked by later tasks)

**Interfaces:**
- Produces: `Track`, `Decision` (union of `ChartsDecision | OptionsDecision | MarketMakingDecision`), `OptionLegDecision`, `RiskConstraints`, `ScenarioObjective`, `NudgeRule`, `DataRef`, `ScenarioSpec`, `DimensionScore`, `ProcessScore`, `ScenarioOutcome`, `Rubric`, `PracticeRun`.

- [ ] **Step 1: Write the types file**

```ts
// src/practice/types.ts
/** The three Practice tracks. */
export type Track = 'charts' | 'market-making' | 'options'

// --- Learner decisions (one shape per track; discriminate on the spec's track) ---

export interface ChartsDecision {
  took: boolean
  direction?: 'long' | 'short'
  shares?: number
  entry?: number
  stop?: number
  target?: number
  /** Index at which the learner chose to exit early (else held to reveal end). */
  managedExitIndex?: number
}

export interface OptionLegDecision {
  type: 'call' | 'put'
  side: 'long' | 'short'
  K: number
  /** ISO expiry date, must exist in the referenced chain snapshot. */
  expiry: string
  /** Real premium per share from the chain snapshot (never learner/LLM invented). */
  premium: number
  contracts: number
}

export interface OptionsDecision {
  legs: OptionLegDecision[]
  /** How the learner managed before expiry. */
  managed?: 'hold' | 'closed-early' | 'rolled'
}

export interface MarketMakingDecision {
  /** Half-spread below mid for the bid, in price units. */
  bidWidth: number
  /** Half-spread above mid for the ask, in price units. */
  askWidth: number
  quoteSize: number
  /** Absolute inventory cap the learner commits to hold. */
  maxInventory: number
}

export type Decision = ChartsDecision | OptionsDecision | MarketMakingDecision

// --- Risk + objective the rubric/nudges read ---

export interface RiskConstraints {
  /** Account balance at scenario start — basis for % sizing checks. */
  accountBalance: number
  /** Soft risk-per-trade ceiling, e.g. 2 (% of account). */
  maxRiskPct: number
  /** Charts: a stop is expected. */
  requireStop?: boolean
  /** Options: no naked short legs (loss must be defined). */
  requireDefinedRisk?: boolean
  /** Charts: minimum reward:risk to score the R:R dimension full marks. */
  minRewardRisk?: number
}

export interface ScenarioObjective {
  /** v1: the score of record is the process score; P&L is shown, never gates. */
  kind: 'process'
  /** Process score (0..100) considered a pass for telemetry/progression. */
  passScore: number
}

/** A decision-point nudge by id; triggers live in src/practice/nudges.ts. */
export interface NudgeRule {
  id: string
}

/** The ONLY link to market truth: references real data by key, never literals. */
export interface DataRef {
  /** Key into bundled CANDLES (src/data/candles.ts) — Track A/C underlying. */
  candlesKey?: string
  /** Asset path under public/data/ohlc, e.g. "data/ohlc/AAPL__1d.json" (corpus). */
  ohlcAsset?: string
  /** Key into curated option-chain snapshots (Track C). */
  chainSnapshotKey?: string
  /** Asset path under public/data/options, e.g. "data/options/AAPL__2021-02-17.json". */
  chainAsset?: string
  /** Key into real spread/vol stats (Track B). */
  bookStatsKey?: string
  /** Decision point index (Track A). */
  splitIndex?: number
  /** Resolution window end index (Track A). */
  revealToIndex?: number
  /** Snapshot/decision date (Track C). */
  decisionDate?: string
}

export interface ScenarioSpec {
  id: string
  track: Track
  /** 1..N difficulty tier — scales complexity, never P&L odds. */
  tier: number
  title: string
  brief: string
  dataRef: DataRef
  objective: ScenarioObjective
  constraints: RiskConstraints
  /** Which rubric grades this (must exist in RUBRICS). */
  rubricId: string
  nudges: NudgeRule[]
  /** Real facts the debrief LLM may cite (M3). */
  coachContextKeys: string[]
  /** Fields rendered "illustrative; math exact". */
  illustrativeFlags?: string[]
  source: 'curated' | 'llm'
}

// --- Grading ---

export interface DimensionScore {
  id: string
  label: string
  /** Relative weight within the rubric (weights need not sum to 1; normalised). */
  weight: number
  /** 0..1 quality on this dimension. */
  score: number
  note: string
}

export interface ProcessScore {
  /** 0..100 weighted process score — the score of record. */
  total: number
  dimensions: DimensionScore[]
  /** Realized dollars from real data; display + history only, never gates. */
  pnl: number
  title: string
  detail: string
}

/** What the deterministic resolver produced from real subsequent data. */
export interface ScenarioOutcome {
  pnl: number
  /** Free-form real facts for the rubric/coach, e.g. { exit: 412.3, hit: 'tp' }. */
  facts: Record<string, number | string | boolean>
}

/** A rubric grades a (spec, decision, outcome) → ProcessScore. Pure, no LLM. */
export type Rubric = (
  spec: ScenarioSpec,
  decision: Decision,
  outcome: ScenarioOutcome,
) => ProcessScore

/** One completed scenario run, persisted to practiceHistory. */
export interface PracticeRun {
  specId: string
  track: Track
  tier: number
  decision: Decision
  nudgesFired: string[]
  score: number
  breakdown: DimensionScore[]
  pnl: number
  journal: { rationale: string; feeling: Feeling }
  createdAt: number
}

export type Feeling = 'confident' | 'anxious' | 'fomo' | 'revenge' | 'calm'
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (no consumers yet; the file is self-contained).

- [ ] **Step 3: Commit**

```bash
git add src/practice/types.ts
git commit -m "feat(practice): add shared ScenarioSpec/Decision/grading types"
```

---

## Task 2: Pure account + skill reducer

**Files:**
- Create: `src/practice/account.ts`
- Test: `src/practice/account.test.ts`

**Interfaces:**
- Consumes: `Track`, `ProcessScore` from `./types`.
- Produces: `PracticeAccount`, `initialAccount()`, `accountReducer(state, action)`, `tierFor(skill)`, `isRuined(account)`, `SKILL_ALPHA`, `STARTING_BALANCE`, `RUIN_FLOOR`, `TIER_THRESHOLDS`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/account.test.ts
import { describe, it, expect } from 'vitest'
import {
  initialAccount,
  accountReducer,
  tierFor,
  isRuined,
  STARTING_BALANCE,
  RUIN_FLOOR,
  type PracticeAccount,
} from './account'

const apply = (a: PracticeAccount, track: 'charts' | 'options' | 'market-making', score: number, pnl: number) =>
  accountReducer(a, { type: 'APPLY_RESULT', track, score, pnl })

describe('initialAccount', () => {
  it('starts at $10,000, tier 1, zero skill, no ruin events', () => {
    const a = initialAccount()
    expect(a.balance).toBe(STARTING_BALANCE)
    expect(a.balance).toBe(10000)
    expect(a.tier).toEqual({ charts: 1, 'market-making': 1, options: 1 })
    expect(a.skill).toEqual({ charts: 0, 'market-making': 0, options: 0 })
    expect(a.ruinEvents).toBe(0)
  })
})

describe('accountReducer APPLY_RESULT', () => {
  it('adds P&L to the balance (P&L can be negative)', () => {
    let a = apply(initialAccount(), 'charts', 80, 250)
    expect(a.balance).toBe(10250)
    a = apply(a, 'charts', 40, -400)
    expect(a.balance).toBe(9850)
  })

  it('moves the per-track skill toward the latest score (EMA), leaving other tracks untouched', () => {
    const a = apply(initialAccount(), 'charts', 100, 0)
    // EMA from 0 toward 100 with alpha 0.3 → 30
    expect(a.skill.charts).toBeCloseTo(30, 5)
    expect(a.skill.options).toBe(0)
  })

  it('raises the per-track tier as rolling skill crosses thresholds', () => {
    let a = initialAccount()
    for (let i = 0; i < 12; i++) a = apply(a, 'charts', 100, 0) // skill → ~100
    expect(a.skill.charts).toBeGreaterThan(70)
    expect(a.tier.charts).toBeGreaterThan(1)
    expect(a.tier.options).toBe(1) // independent per track
  })

  it('is immutable: returns a new object, never mutates input', () => {
    const a0 = initialAccount()
    const a1 = apply(a0, 'charts', 50, 100)
    expect(a1).not.toBe(a0)
    expect(a0.balance).toBe(10000)
  })
})

describe('tierFor', () => {
  it('maps rolling skill to a tier monotonically', () => {
    expect(tierFor(0)).toBe(1)
    expect(tierFor(100)).toBeGreaterThanOrEqual(tierFor(50))
    expect(tierFor(50)).toBeGreaterThanOrEqual(tierFor(0))
  })
})

describe('isRuined', () => {
  it('is true only at or below the $1,000 floor', () => {
    expect(isRuined({ ...initialAccount(), balance: RUIN_FLOOR })).toBe(true)
    expect(isRuined({ ...initialAccount(), balance: RUIN_FLOOR + 1 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/account.test.ts`
Expected: FAIL — "Cannot find module './account'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/account.ts
import type { Track } from './types'

export const STARTING_BALANCE = 10000
export const RUIN_FLOOR = 1000
/** EMA weight on the newest score; smaller = smoother, slower to react. */
export const SKILL_ALPHA = 0.3
/** Rolling-skill cutoffs → tier. Index i means "tier i+1 starts at this skill". */
export const TIER_THRESHOLDS = [0, 35, 55, 72, 88] as const

export type TrackMap<T> = Record<Track, T>

export interface PracticeAccount {
  balance: number
  tier: TrackMap<number>
  /** Rolling 0..100 process-skill EMA per track. */
  skill: TrackMap<number>
  ruinEvents: number
}

export function initialAccount(): PracticeAccount {
  return {
    balance: STARTING_BALANCE,
    tier: { charts: 1, 'market-making': 1, options: 1 },
    skill: { charts: 0, 'market-making': 0, options: 0 },
    ruinEvents: 0,
  }
}

/** Lowest tier whose threshold the rolling skill has reached (1..TIER_THRESHOLDS.length). */
export function tierFor(skill: number): number {
  let tier = 1
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (skill >= TIER_THRESHOLDS[i]) tier = i + 1
  }
  return tier
}

export function isRuined(a: PracticeAccount): boolean {
  return a.balance <= RUIN_FLOOR
}

type AccountAction = { type: 'APPLY_RESULT'; track: Track; score: number; pnl: number }

/**
 * Pure: applies a completed scenario's outcome. Balance += P&L (may go negative —
 * the < $1,000 reset is an M4 concern). Skill is an EMA of process scores; the
 * track's tier follows from the new skill. M0 raises tier with skill; M4 adds the
 * down-hysteresis + ruin reset action.
 */
export function accountReducer(state: PracticeAccount, action: AccountAction): PracticeAccount {
  switch (action.type) {
    case 'APPLY_RESULT': {
      const { track, score, pnl } = action
      const prevSkill = state.skill[track]
      const nextSkill = prevSkill + SKILL_ALPHA * (score - prevSkill)
      return {
        ...state,
        balance: Math.round((state.balance + pnl) * 100) / 100,
        skill: { ...state.skill, [track]: nextSkill },
        tier: { ...state.tier, [track]: tierFor(nextSkill) },
      }
    }
    default:
      return state
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/account.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/practice/account.ts src/practice/account.test.ts
git commit -m "feat(practice): pure account/skill/tier reducer with tests"
```

---

## Task 3: Nudge catalog (pure trigger predicates)

**Files:**
- Create: `src/practice/nudges.ts`
- Test: `src/practice/nudges.test.ts`

**Interfaces:**
- Consumes: `RiskConstraints`, `ChartsDecision`, `OptionsDecision` from `./types`.
- Produces: `NUDGES` (record id → `{ id, copy, triggered(ctx) }`), `evaluateNudges(ids, ctx)`, `NudgeContext`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/nudges.test.ts
import { describe, it, expect } from 'vitest'
import { NUDGES, evaluateNudges, type NudgeContext } from './nudges'

const base: NudgeContext = {
  constraints: { accountBalance: 10000, maxRiskPct: 2 },
  riskDollars: 0,
  hasStop: true,
  hasUndefinedRiskLeg: false,
  tradesInWindow: 1,
}

describe('sizing nudge', () => {
  it('fires when risk exceeds maxRiskPct of the account', () => {
    const ctx = { ...base, riskDollars: 500 } // 5% of 10k > 2%
    expect(NUDGES['sizing'].triggered(ctx)).toBe(true)
  })
  it('stays quiet within the risk budget', () => {
    const ctx = { ...base, riskDollars: 150 } // 1.5%
    expect(NUDGES['sizing'].triggered(ctx)).toBe(false)
  })
})

describe('no-stop and undefined-risk nudges', () => {
  it('no-stop fires when a trade is taken without a stop', () => {
    expect(NUDGES['no-stop'].triggered({ ...base, hasStop: false })).toBe(true)
  })
  it('undefined-risk fires on a naked short leg', () => {
    expect(NUDGES['undefined-risk'].triggered({ ...base, hasUndefinedRiskLeg: true })).toBe(true)
  })
})

describe('evaluateNudges', () => {
  it('returns only the fired ids, in catalog order, ignoring unknown ids', () => {
    const ctx = { ...base, riskDollars: 800, hasStop: false }
    expect(evaluateNudges(['no-stop', 'sizing', 'nope'], ctx)).toEqual(['sizing', 'no-stop'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/nudges.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/nudges.ts
import type { RiskConstraints } from './types'

export interface NudgeContext {
  constraints: RiskConstraints
  /** Dollars at risk on the trade being set up (entry→stop × shares, or option max loss). */
  riskDollars: number
  hasStop: boolean
  hasUndefinedRiskLeg: boolean
  /** Trades taken in the recent window (overtrading signal). */
  tradesInWindow: number
}

export interface Nudge {
  id: string
  /** Voice per POLISH_STYLE_GUIDE: plain, warm, one analogy, no hype. */
  copy: string
  triggered: (ctx: NudgeContext) => boolean
}

/** Insertion order is the display/priority order. */
export const NUDGES: Record<string, Nudge> = {
  sizing: {
    id: 'sizing',
    copy: 'This risks more than 2% of your account on one trade. Pros usually risk 1–2%.',
    triggered: (c) => c.riskDollars > (c.constraints.maxRiskPct / 100) * c.constraints.accountBalance,
  },
  'no-stop': {
    id: 'no-stop',
    copy: 'No stop set — your max loss is undefined. Decide where you are wrong before you enter.',
    triggered: (c) => !c.hasStop,
  },
  'undefined-risk': {
    id: 'undefined-risk',
    copy: 'This leg has unbounded loss. Want to define it with a spread?',
    triggered: (c) => c.hasUndefinedRiskLeg,
  },
  overtrading: {
    id: 'overtrading',
    copy: 'Several trades in quick succession. Overtrading is the #1 account killer.',
    triggered: (c) => c.tradesInWindow >= 4,
  },
}

/** Fired nudge ids from `requested`, in catalog order; unknown ids are ignored. */
export function evaluateNudges(requested: string[], ctx: NudgeContext): string[] {
  return Object.keys(NUDGES).filter((id) => requested.includes(id) && NUDGES[id].triggered(ctx))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/nudges.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/nudges.ts src/practice/nudges.test.ts
git commit -m "feat(practice): nudge catalog with pure trigger predicates"
```

---

## Task 4: Rubric registry + noop rubric

**Files:**
- Create: `src/practice/rubrics/index.ts`
- Test: `src/practice/rubrics/index.test.ts`

**Interfaces:**
- Consumes: `Rubric`, `ProcessScore`, `DimensionScore` from `../types`.
- Produces: `RUBRICS` (record id → `Rubric`), `getRubric(id)`, `weightedTotal(dimensions)`. (Real rubrics `charts-v1`, `options-v1`, `mm-v1` are added in M1/M2/M5.)

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/rubrics/index.test.ts
import { describe, it, expect } from 'vitest'
import { getRubric, weightedTotal, RUBRICS } from './index'
import type { DimensionScore } from '../types'

describe('weightedTotal', () => {
  it('normalises weighted dimension scores to 0..100', () => {
    const dims: DimensionScore[] = [
      { id: 'a', label: 'A', weight: 2, score: 1, note: '' },
      { id: 'b', label: 'B', weight: 1, score: 0, note: '' },
    ]
    expect(weightedTotal(dims)).toBe(67) // (2*1 + 1*0) / 3 * 100, rounded
  })
  it('is 0 for no dimensions', () => {
    expect(weightedTotal([])).toBe(0)
  })
})

describe('getRubric', () => {
  it('returns a registered rubric', () => {
    expect(typeof getRubric('noop')).toBe('function')
  })
  it('throws on an unknown rubric id', () => {
    expect(() => getRubric('does-not-exist')).toThrow()
  })
  it('every registered rubric id is a function', () => {
    for (const id of Object.keys(RUBRICS)) expect(typeof RUBRICS[id]).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/rubrics/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/rubrics/index.ts
import type { DimensionScore, Rubric } from '../types'

/** Weighted average of dimension scores (0..1), scaled to a 0..100 integer. */
export function weightedTotal(dimensions: DimensionScore[]): number {
  const wsum = dimensions.reduce((s, d) => s + d.weight, 0)
  if (wsum === 0) return 0
  const num = dimensions.reduce((s, d) => s + d.weight * d.score, 0)
  return Math.round((num / wsum) * 100)
}

/**
 * M0 placeholder so the pipeline runs end-to-end before any track ships. Real
 * rubrics (charts-v1, options-v1, mm-v1) are registered here in M1/M2/M5.
 */
const noop: Rubric = (_spec, _decision, outcome) => {
  const dimensions: DimensionScore[] = [
    { id: 'placeholder', label: 'Process', weight: 1, score: 0.5, note: 'No rubric yet for this track.' },
  ]
  return {
    total: weightedTotal(dimensions),
    dimensions,
    pnl: outcome.pnl,
    title: 'Scenario complete',
    detail: 'A real process rubric for this track lands in a later milestone.',
  }
}

export const RUBRICS: Record<string, Rubric> = { noop }

export function getRubric(id: string): Rubric {
  const r = RUBRICS[id]
  if (!r) throw new Error(`Unknown rubricId: ${id}`)
  return r
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/rubrics/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/rubrics/index.ts src/practice/rubrics/index.test.ts
git commit -m "feat(practice): rubric registry + weightedTotal + noop rubric"
```

---

## Task 5: Deterministic spec validator (the trust gate)

**Files:**
- Create: `src/practice/validator.ts`
- Test: `src/practice/validator.test.ts`

**Interfaces:**
- Consumes: `ScenarioSpec`, `Track` from `./types`; `RUBRICS` from `./rubrics`; `NUDGES` from `./nudges`; `CANDLES` from `../data/candles`.
- Produces: `validateSpec(spec, opts?) → ValidationResult`, `ValidationResult = { ok: boolean; errors: string[] }`, `DISALLOWED_CLAIM_PATTERNS`.

**Note on data-ref resolution:** M0 validates bundled `candlesKey` against `CANDLES` synchronously. Corpus assets (`ohlcAsset`, `chainAsset`) are validated by *shape of the reference string* in M0 (must match `data/(ohlc|options)/...json`); their on-disk existence is checked at load time by the loader added in M1/M2, and the LLM loop (M3) passes a resolver that confirms the asset is in the manifest.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/validator.test.ts
import { describe, it, expect } from 'vitest'
import { validateSpec } from './validator'
import type { ScenarioSpec } from './types'

const candlesKey = Object.keys(
  // a known bundled key; pick the first available at test time
  (await import('../data/candles')).CANDLES,
)[0]

const valid: ScenarioSpec = {
  id: 'charts-tier1-0001',
  track: 'charts',
  tier: 1,
  title: 'A clean breakout retest',
  brief: 'Price has pushed to a level and pulled back. Decide whether to take it.',
  dataRef: { candlesKey, splitIndex: 30, revealToIndex: 60 },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
  rubricId: 'noop',
  nudges: [{ id: 'sizing' }, { id: 'no-stop' }],
  coachContextKeys: ['outcome', 'exit'],
  source: 'curated',
}

describe('validateSpec', () => {
  it('accepts a well-formed spec referencing real bundled data', () => {
    expect(validateSpec(valid)).toEqual({ ok: true, errors: [] })
  })

  it('rejects an unknown candlesKey', () => {
    const r = validateSpec({ ...valid, dataRef: { ...valid.dataRef, candlesKey: 'NOT_A_KEY' } })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/candlesKey/)
  })

  it('rejects an out-of-range splitIndex', () => {
    const r = validateSpec({ ...valid, dataRef: { ...valid.dataRef, splitIndex: 999999 } })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/splitIndex/)
  })

  it('rejects an unknown rubricId', () => {
    expect(validateSpec({ ...valid, rubricId: 'ghost' }).ok).toBe(false)
  })

  it('rejects an unknown nudge id', () => {
    expect(validateSpec({ ...valid, nudges: [{ id: 'made-up' }] }).ok).toBe(false)
  })

  it('rejects a brief that makes a disallowed claim (prediction/advice/guarantee)', () => {
    expect(validateSpec({ ...valid, brief: 'This stock will definitely go up — buy now.' }).ok).toBe(false)
    expect(validateSpec({ ...valid, brief: 'Guaranteed profit if you follow this advice.' }).ok).toBe(false)
  })

  it('requires a corpus asset ref to look like a data/ path', () => {
    const r = validateSpec({ ...valid, dataRef: { ohlcAsset: 'http://evil/x', splitIndex: 1, revealToIndex: 2 } })
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/validator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/validator.ts
import type { ScenarioSpec } from './types'
import { RUBRICS } from './rubrics'
import { NUDGES } from './nudges'
import { CANDLES } from '../data/candles'

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/** Phrases an LLM brief must NOT contain — predictions, advice, guarantees. */
export const DISALLOWED_CLAIM_PATTERNS: RegExp[] = [
  /\bwill (?:definitely |certainly )?(?:go|rise|fall|drop|moon|crash)\b/i,
  /\bguarantee(?:d|s)?\b/i,
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\b(?:financial )?advice\b/i,
  /\bsure thing\b/i,
  /\bcan'?t lose\b/i,
  /\brisk[- ]free\b/i,
]

const ASSET_RE = /^data\/(ohlc|options)\/[\w.-]+\.json$/

/**
 * The deterministic trust gate (PRDphase2 §8.2). A spec is rejected unless every
 * rule holds. `opts.resolveCandles`/`opts.assetExists` let M3 inject corpus-aware
 * resolvers; M0 defaults to bundled CANDLES + a string-shape check for assets.
 */
export function validateSpec(
  spec: ScenarioSpec,
  opts: { resolveCandles?: (key: string) => unknown[] | undefined; assetExists?: (path: string) => boolean } = {},
): ValidationResult {
  const errors: string[] = []
  const resolveCandles = opts.resolveCandles ?? ((k: string) => CANDLES[k])
  const assetExists = opts.assetExists ?? ((p: string) => ASSET_RE.test(p))

  // Rule 1: data refs resolve; indices in range.
  const { candlesKey, ohlcAsset, chainAsset, splitIndex, revealToIndex } = spec.dataRef
  let series: unknown[] | undefined
  if (candlesKey) {
    series = resolveCandles(candlesKey)
    if (!series) errors.push(`dataRef.candlesKey "${candlesKey}" does not resolve to real data`)
  }
  if (ohlcAsset && !assetExists(ohlcAsset)) errors.push(`dataRef.ohlcAsset "${ohlcAsset}" is not a known data/ asset`)
  if (chainAsset && !assetExists(chainAsset)) errors.push(`dataRef.chainAsset "${chainAsset}" is not a known data/ asset`)
  if (spec.track === 'charts' && !candlesKey && !ohlcAsset)
    errors.push('charts spec must reference candlesKey or ohlcAsset')

  if (series) {
    const n = series.length
    if (splitIndex !== undefined && (splitIndex < 1 || splitIndex >= n))
      errors.push(`dataRef.splitIndex ${splitIndex} out of range [1, ${n - 1}]`)
    if (revealToIndex !== undefined && (revealToIndex <= (splitIndex ?? 0) || revealToIndex > n))
      errors.push(`dataRef.revealToIndex ${revealToIndex} must be > splitIndex and <= ${n}`)
  }

  // Rule 3: objective achievable (process objective is always achievable; sanity-check bounds).
  if (spec.objective.kind !== 'process') errors.push('objective.kind must be "process" in v1')
  if (spec.objective.passScore < 0 || spec.objective.passScore > 100)
    errors.push('objective.passScore must be 0..100')

  // Rule 4: rubric + nudges + constraints well-formed.
  if (!RUBRICS[spec.rubricId]) errors.push(`unknown rubricId "${spec.rubricId}"`)
  for (const n of spec.nudges) if (!NUDGES[n.id]) errors.push(`unknown nudge id "${n.id}"`)
  if (spec.constraints.accountBalance <= 0) errors.push('constraints.accountBalance must be > 0')
  if (spec.constraints.maxRiskPct <= 0 || spec.constraints.maxRiskPct > 100)
    errors.push('constraints.maxRiskPct must be in (0, 100]')
  if (!Number.isInteger(spec.tier) || spec.tier < 1) errors.push('tier must be an integer >= 1')

  // Rule 5: brief makes no disallowed claim.
  for (const re of DISALLOWED_CLAIM_PATTERNS)
    if (re.test(spec.brief) || re.test(spec.title))
      errors.push(`brief/title contains a disallowed claim: ${re}`)

  return { ok: errors.length === 0, errors }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/validator.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/practice/validator.ts src/practice/validator.test.ts
git commit -m "feat(practice): deterministic ScenarioSpec validator (trust gate)"
```

---

## Task 6: Curated scenario registry + wiring test

**Files:**
- Create: `src/practice/scenarioRegistry.ts`
- Test: `src/practice/scenarioRegistry.test.ts`

**Interfaces:**
- Consumes: `ScenarioSpec`, `Track` from `./types`; `validateSpec` from `./validator`.
- Produces: `SCENARIOS: ScenarioSpec[]`, `getScenario(id)`, `scenariosFor(track, tier?)`, `allTracks`.

**Note:** M0 ships ONE seed `charts` spec (referencing a real bundled `candlesKey`) so the registry and validator are exercised end-to-end; M1/M2/M5 add the real curated catalogs. Pick a real key by reading `src/data/candles.ts` exports (e.g. a `*_quiz_*` key used by reading-charts) at implementation time.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/scenarioRegistry.test.ts
import { describe, it, expect } from 'vitest'
import { SCENARIOS, getScenario, scenariosFor } from './scenarioRegistry'
import { validateSpec } from './validator'

describe('scenario registry', () => {
  it('has at least one curated scenario', () => {
    expect(SCENARIOS.length).toBeGreaterThan(0)
  })

  it('every curated spec passes the validator (build-time trust contract)', () => {
    for (const s of SCENARIOS) {
      const r = validateSpec(s)
      expect(r.ok, `${s.id}: ${r.errors.join('; ')}`).toBe(true)
    }
  })

  it('ids are unique', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
  })

  it('getScenario finds by id and returns undefined otherwise', () => {
    expect(getScenario(SCENARIOS[0].id)?.id).toBe(SCENARIOS[0].id)
    expect(getScenario('nope')).toBeUndefined()
  })

  it('scenariosFor filters by track and optional tier', () => {
    const first = SCENARIOS[0]
    const byTrack = scenariosFor(first.track)
    expect(byTrack.every((s) => s.track === first.track)).toBe(true)
    const byTier = scenariosFor(first.track, first.tier)
    expect(byTier.every((s) => s.tier === first.tier)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/scenarioRegistry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/scenarioRegistry.ts
import type { ScenarioSpec, Track } from './types'
import { CANDLES } from '../data/candles'

/** A real bundled key to anchor the M0 seed scenario (any existing quiz window works). */
const SEED_KEY = Object.keys(CANDLES)[0]

/**
 * Curated catalog. M0 seeds one charts scenario so the pipeline is exercised end to
 * end; M1 (charts), M2 (options), M5 (market-making) extend this array. Every entry
 * MUST pass validateSpec — enforced by scenarioRegistry.test.ts.
 */
export const SCENARIOS: ScenarioSpec[] = [
  {
    id: 'charts-tier1-seed',
    track: 'charts',
    tier: 1,
    title: 'Take it or skip it?',
    brief:
      'Real price action up to a decision point. If the setup is sound, set your size, stop, and target; otherwise stay out.',
    dataRef: {
      candlesKey: SEED_KEY,
      splitIndex: Math.max(1, Math.floor((CANDLES[SEED_KEY]?.length ?? 60) * 0.6)),
      revealToIndex: CANDLES[SEED_KEY]?.length ?? 60,
    },
    objective: { kind: 'process', passScore: 70 },
    constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
    rubricId: 'noop',
    nudges: [{ id: 'sizing' }, { id: 'no-stop' }],
    coachContextKeys: ['outcome', 'exit'],
    source: 'curated',
  },
]

export const allTracks: Track[] = ['charts', 'options', 'market-making']

export function getScenario(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export function scenariosFor(track: Track, tier?: number): ScenarioSpec[] {
  return SCENARIOS.filter((s) => s.track === track && (tier === undefined || s.tier === tier))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/scenarioRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/scenarioRegistry.ts src/practice/scenarioRegistry.test.ts
git commit -m "feat(practice): curated scenario registry + build-time validator contract"
```

---

## Task 7: Firestore practice service

**Files:**
- Create: `src/services/practiceService.ts`
- Test: (none — thin Firebase I/O wrapper, mirrors untested `userService.ts`; covered by manual run + rules verification in Task 11)

**Interfaces:**
- Consumes: `db` from `../lib/firebase`; `PracticeAccount`, `initialAccount` from `../practice/account`; `PracticeRun` from `../practice/types`.
- Produces: `getOrCreatePracticeData(uid) → Promise<{ account: PracticeAccount }>`, `persistPracticeState(uid, account) → Promise<void>`, `appendPracticeRun(uid, run) → Promise<void>`, `loadRecentRuns(uid, n) → Promise<PracticeRun[]>`.

- [ ] **Step 1: Write the implementation**

```ts
// src/services/practiceService.ts
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { initialAccount, type PracticeAccount } from '../practice/account'
import type { PracticeRun } from '../practice/types'

const USERS = 'users'

/**
 * Reads the additive `practice` object from the user doc (created lazily). Never
 * creates the user doc itself — getOrCreateUserDoc (userService) owns creation, so
 * this stays a pure merge-reader and the legacy create rule is untouched.
 */
export async function getOrCreatePracticeData(uid: string): Promise<{ account: PracticeAccount }> {
  const ref = doc(db, USERS, uid)
  const snap = await getDoc(ref)
  const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {}
  const practice = data.practice as { account?: PracticeAccount } | undefined
  return { account: practice?.account ?? initialAccount() }
}

/** Merge-write the account under `practice.account`; leaves legacy fields untouched. */
export async function persistPracticeState(uid: string, account: PracticeAccount): Promise<void> {
  const ref = doc(db, USERS, uid)
  await setDoc(ref, { practice: { account, updatedAt: serverTimestamp() } }, { merge: true })
}

/** Append one completed run to the practiceHistory subcollection. */
export async function appendPracticeRun(uid: string, run: PracticeRun): Promise<void> {
  const col = collection(db, USERS, uid, 'practiceHistory')
  await addDoc(col, { ...run, createdAt: serverTimestamp() })
}

/** Most-recent runs for the debrief/history view. */
export async function loadRecentRuns(uid: string, n = 20): Promise<PracticeRun[]> {
  const col = collection(db, USERS, uid, 'practiceHistory')
  const q = query(col, orderBy('createdAt', 'desc'), limit(n))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => d.data() as PracticeRun)
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/practiceService.ts
git commit -m "feat(practice): Firestore practice service (account + history)"
```

---

## Task 8: PracticeContext (React state)

**Files:**
- Create: `src/state/PracticeContext.tsx`
- Test: (none — provider I/O like `LessonProgressContext.tsx`; the pure reducer is tested in Task 2)

**Interfaces:**
- Consumes: `useAuth` from `../auth/AuthContext`; practiceService functions; `accountReducer`, `initialAccount`, `tierFor` from `../practice/account`; `getScenario`, `scenariosFor` from `../practice/scenarioRegistry`; `ScenarioSpec`, `Track`, `PracticeRun`, `ProcessScore` from `../practice/types`.
- Produces: `PracticeProvider`, `usePractice() → { loading, account, nextScenario(track?), applyResult(spec, run), recentRuns }`.

- [ ] **Step 1: Write the implementation**

```tsx
// src/state/PracticeContext.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  appendPracticeRun,
  getOrCreatePracticeData,
  loadRecentRuns,
  persistPracticeState,
} from '../services/practiceService'
import { accountReducer, initialAccount, type PracticeAccount } from '../practice/account'
import { getScenario, scenariosFor } from '../practice/scenarioRegistry'
import type { PracticeRun, ScenarioSpec, Track } from '../practice/types'

interface PracticeValue {
  loading: boolean
  account: PracticeAccount
  recentRuns: PracticeRun[]
  /** Pick the next scenario for a track at the account's current tier (adaptive in M4). */
  nextScenario: (track?: Track) => ScenarioSpec | undefined
  /** Apply a graded run: update balance/skill/tier, persist, append to history. */
  applyResult: (run: PracticeRun) => void
}

const Ctx = createContext<PracticeValue | undefined>(undefined)

export function PracticeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState<PracticeAccount>(initialAccount())
  const [recentRuns, setRecentRuns] = useState<PracticeRun[]>([])
  const accountRef = useRef<PracticeAccount>(initialAccount())

  useEffect(() => {
    let active = true
    accountRef.current = initialAccount()
    setAccount(initialAccount())
    setRecentRuns([])
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([getOrCreatePracticeData(user.uid), loadRecentRuns(user.uid)])
      .then(([{ account }, runs]) => {
        if (!active) return
        accountRef.current = account
        setAccount(account)
        setRecentRuns(runs)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load practice data', err)
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  const nextScenario = useCallback(
    (track: Track = 'charts'): ScenarioSpec | undefined => {
      const tier = accountRef.current.tier[track]
      const atTier = scenariosFor(track, tier)
      const pool = atTier.length ? atTier : scenariosFor(track)
      // Avoid immediate repeats where possible.
      const recentIds = new Set(recentRuns.slice(0, 5).map((r) => r.specId))
      return pool.find((s) => !recentIds.has(s.id)) ?? pool[0]
    },
    [recentRuns],
  )

  const applyResult = useCallback(
    (run: PracticeRun) => {
      if (!user) return
      const spec = getScenario(run.specId)
      const track = spec?.track ?? run.track
      const next = accountReducer(accountRef.current, {
        type: 'APPLY_RESULT',
        track,
        score: run.score,
        pnl: run.pnl,
      })
      accountRef.current = next
      setAccount(next)
      setRecentRuns((prev) => [run, ...prev].slice(0, 20))
      // Optimistic: persistence failures never block play.
      persistPracticeState(user.uid, next).catch((e) => console.error('persist account', e))
      appendPracticeRun(user.uid, run).catch((e) => console.error('append run', e))
    },
    [user],
  )

  return (
    <Ctx.Provider value={{ loading, account, recentRuns, nextScenario, applyResult }}>{children}</Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePractice(): PracticeValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePractice must be used within a PracticeProvider')
  return ctx
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/state/PracticeContext.tsx
git commit -m "feat(practice): PracticeContext loads/persists account + history"
```

---

## Task 9: Practice landing page + routes + nav

**Files:**
- Create: `src/pages/PracticePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/TopNav.tsx`

**Interfaces:**
- Consumes: `usePractice` from `../state/PracticeContext`; `PracticeProvider`.
- Produces: routes `/practice` and `/practice/:track`; a "Practice" nav link.

- [ ] **Step 1: Write the page**

```tsx
// src/pages/PracticePage.tsx
import { useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Spinner from '../components/ui/Spinner'
import { usePractice } from '../state/PracticeContext'
import { allTracks } from '../practice/scenarioRegistry'
import type { Track } from '../practice/types'

const TRACK_LABEL: Record<Track, string> = {
  charts: 'Chart patterns',
  options: 'Options',
  'market-making': 'Market making',
}

export default function PracticePage() {
  const { track } = useParams<{ track?: Track }>()
  const { loading, account } = usePractice()

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-4xl font-bold">Practice</h1>
                <p className="mt-2 text-ink-soft">
                  Trade real historical setups. Graded on process, not luck.
                </p>
              </div>
              <div className="rounded-2xl bg-ink px-5 py-3 text-white">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Paper balance</div>
                <div className="font-display text-2xl font-bold">${account.balance.toLocaleString('en-US')}</div>
              </div>
            </header>

            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              {allTracks.map((t) => (
                <div key={t} className="rounded-2xl border border-hairline bg-white p-5">
                  <div className="text-sm font-bold uppercase tracking-wide text-muted">{TRACK_LABEL[t]}</div>
                  <div className="mt-2 text-3xl font-bold">Tier {account.tier[t]}</div>
                  <div className="mt-1 text-sm text-muted">Skill {Math.round(account.skill[t])}/100</div>
                  <p className="mt-4 text-sm text-ink-soft">Scenario player arrives in the next milestone.</p>
                </div>
              ))}
            </section>

            {track && (
              <p className="mt-6 text-sm text-muted">
                Selected track: <span className="font-bold text-ink">{TRACK_LABEL[track as Track] ?? track}</span>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Wire routes + provider in App.tsx**

Replace the contents of `src/App.tsx` with:

```tsx
// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { LessonProgressProvider } from './state/LessonProgressContext'
import { PracticeProvider } from './state/PracticeContext'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LessonPage from './pages/LessonPage'
import CongratsPage from './pages/CongratsPage'
import PracticePage from './pages/PracticePage'

export default function App() {
  return (
    <LessonProgressProvider>
      <PracticeProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/lesson/:lessonId/:moduleId" element={<LessonPage />} />
            <Route path="/congrats/:lessonId" element={<CongratsPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/practice/:track" element={<PracticePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PracticeProvider>
    </LessonProgressProvider>
  )
}
```

- [ ] **Step 3: Add a Practice link in TopNav.tsx**

Open `src/components/TopNav.tsx`, find the primary nav links, and add a link to `/practice` labelled "Practice" using the same styling as the existing links (match the surrounding `<Link>`/`NavLink` pattern in that file). If TopNav has no link list yet, add one `<Link to="/practice" className="text-sm font-semibold text-ink-soft hover:text-ink">Practice</Link>` beside the brand.

- [ ] **Step 4: Verify build + typecheck**

Run: `npm run typecheck`
Expected: PASS.
Run: `npm run dev`, open `/practice`.
Expected: Practice landing renders with $10,000 balance and three Tier 1 / Skill 0 track cards.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PracticePage.tsx src/App.tsx src/components/TopNav.tsx
git commit -m "feat(practice): /practice route, provider wiring, nav link, landing shell"
```

---

## Task 10: Firestore rules — additive practice namespace

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Produces: an updated `users/{uid}` update rule that additionally validates `practice` (when present) and a `practiceHistory` subcollection rule. Legacy `progress`/`bestStreak` rules unchanged.

- [ ] **Step 1: Update the rules**

Replace `firestore.rules` with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    function progressOk(p) {
      return p.lastCompletedModule is int
             && p.lastCompletedModule >= 0
             && p.lastCompletedModule <= 24
             && p.completedModules is list
             && p.completedModules.size() <= 24;
    }

    // practice.account shape: balance a number, three integer tiers, three numeric skills.
    function practiceOk(p) {
      return p.account.balance is number
             && p.account.balance >= 0
             && p.account.ruinEvents is int
             && p.account.ruinEvents >= 0
             && p.account.tier.charts is int
             && p.account.tier.options is int
             && p.account.tier['market-making'] is int;
    }

    match /users/{uid} {
      allow read: if isOwner(uid);

      allow create: if isOwner(uid)
                    && request.resource.data.keys().hasAll(
                         ['email', 'displayName', 'photoURL', 'progress', 'bestStreak', 'createdAt'])
                    && request.resource.data.bestStreak is int
                    && request.resource.data.bestStreak >= 0
                    && progressOk(request.resource.data.progress);

      // Legacy invariants unchanged; if a `practice` object is present it must be well-formed.
      allow update: if isOwner(uid)
                    && progressOk(request.resource.data.progress)
                    && request.resource.data.progress.lastCompletedModule
                         >= resource.data.progress.lastCompletedModule
                    && request.resource.data.bestStreak is int
                    && request.resource.data.bestStreak >= resource.data.bestStreak
                    && (!('practice' in request.resource.data) || practiceOk(request.resource.data.practice));

      allow delete: if false;

      // Append-only completed-run history, owner-scoped. No edits/deletes.
      match /practiceHistory/{runId} {
        allow read: if isOwner(uid);
        allow create: if isOwner(uid)
                      && request.resource.data.score is number
                      && request.resource.data.track is string;
        allow update, delete: if false;
      }
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Manually verify the rules (no automated harness exists)**

Run the emulator OR test against the live project per the firebase skill. Confirm:
1. A `persistLessonProgress` merge write (no `practice`) still succeeds (legacy path unbroken).
2. A `persistPracticeState` merge write with a valid `practice.account` succeeds.
3. A write with `practice.account.balance` missing/non-numeric is rejected.
4. A `practiceHistory` create with `score`+`track` succeeds; an update/delete is rejected.

Document the commands you ran and their PASS/REJECT outcomes in the commit message body.

- [ ] **Step 3: Deploy the rules**

Run: `npx -y firebase-tools@latest deploy --only firestore:rules`
Expected: deploy succeeds.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(practice): additive Firestore rules for practice account + history"
```

---

## Task 11: Full suite green + M0 exit check

**Files:** (none — verification task)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all existing lesson/domain tests PASS plus the new `account`, `nudges`, `rubrics`, `validator`, `scenarioRegistry` suites PASS.

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`, sign in, open `/practice`.
Expected (M0 exit criteria): the page loads, shows a persisted $10,000 balance and three Tier 1 track cards; reloading the page keeps the balance (proves the `practice` doc round-trips through Firestore).

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "chore(practice): M0 foundations green (typecheck + tests + build)"
```

---

## Self-Review

**1. Spec coverage (PRDphase2 §8.1, §8.2, §10, §15, §16 M0 row):**
- `ScenarioSpec` schema → Task 1. Validator rules 1/3/4/5/6 → Task 5 (rule 2 numeric-derivation is wired in M3 where the LLM produces figures; M0 has the hook via `opts`). Account/skill/tier reducer → Task 2. Nudge catalog → Task 3. Rubric registry → Task 4. Curated registry + build-time contract → Task 6. Firestore model + service + context → Tasks 7–8. Rules + redeploy → Task 10. Routes/page → Task 9. ✓ All M0 deliverables mapped.

**2. Placeholder scan:** The `noop` rubric and single seed scenario are intentional, named, working stubs (not TBDs) that later milestones replace; every other module is complete. ✓

**3. Type consistency:** `Track` is `'charts' | 'market-making' | 'options'` everywhere (types, account `TrackMap`, registry `allTracks`, rules `tier['market-making']`). `accountReducer` action `{ type:'APPLY_RESULT', track, score, pnl }` matches its use in `PracticeContext.applyResult` and Task 2 tests. `Rubric` signature `(spec, decision, outcome) → ProcessScore` matches Task 4. `validateSpec(spec, opts?)` matches Task 5/6 usage. ✓

**Carried interfaces later milestones rely on:** `ScenarioSpec`, `Decision`, `ScenarioOutcome`, `Rubric`, `ProcessScore`, `DimensionScore`, `PracticeRun`, `NudgeContext`/`evaluateNudges`, `RUBRICS`/`getRubric`/`weightedTotal`, `validateSpec`, `SCENARIOS`/`getScenario`/`scenariosFor`, `usePractice().applyResult`, `accountReducer`/`tierFor`/`isRuined`.
