# Practice Mode — M5: Track B (Market Making) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the third track — **market making** — where the learner posts a two-sided quote (bid/ask widths, quote size, inventory cap) and runs a session against a **real price path** with a deterministic, explicitly-labelled order-flow simulation. They earn the spread, eat adverse selection on trends, and are graded on **process** (two-sided quoting, spread sized to volatility, inventory discipline) — never on whether the session happened to print green.

**Architecture:** Mirror M1/M2 exactly, reusing the M2 `TrackEngine` abstraction. The price path comes from **real OHLC** (honest); the order arrivals are a deterministic function of that path's realized volatility — same "deterministic illustrative simulation; arithmetic exact" contract the existing `order-book/book.ts` already declares. Pure modules (`bookStats`, `simulateMarketMaking`, `marketMakingRubricV1`) get full TDD; the Phaser scene gets a wiring smoke test; the engine plugs into the existing player with zero player changes.

**Tech Stack:** Same as M0–M4. Reuses `loadCandles` (M1 corpus), `fmtMoney`/`fmtPrice` (`order-book/book.ts`), the `TrackEngine` interface (M2).

## Global Constraints

- (All M0–M4 Global Constraints apply.) `npm run typecheck` + `npm test` green at every commit.
- **Honest path, labelled flow (PRDphase2 §6, §10):** the **mid path is real** (from OHLC closes). The **order flow is a deterministic simulation** calibrated to that path's realized volatility, surfaced to the learner as "illustrative order flow; spread/inventory math exact." No invented prices.
- **Grade process, not P&L (PRDphase2 §9):** the score of record is the MM process score; session P&L is shown and decomposed (spread captured vs adverse selection) but never gates.
- **Determinism:** `simulateMarketMaking` is a pure function of (decision, real path) — no RNG. Same inputs → identical outputs (the order flow is a closed-form function of the real move at each step).
- **Reuse, don't fork:** use the M2 `TrackEngine`, the M1 `ScenarioPlayer`/`Journal`/debrief, the existing `book.ts` formatters. Only additive files.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/practice/bookStats.ts` (+ `.test.ts`) | Derive `{ mids, sigma, mid0, finalMid }` from real candles (the session path + realized vol). |
| `src/practice/resolve/marketMaking.ts` (+ `.test.ts`) | Pure `simulateMarketMaking(decision, params) → ScenarioOutcome` (spread capture, adverse selection, inventory, mark-to-market). |
| `src/practice/rubrics/marketMaking.ts` (+ `.test.ts`) | `marketMakingRubricV1` (two-sided, spread-vs-vol, inventory discipline, quote size). |
| `src/practice/rubrics/index.ts` (modify) | Register `market-making-v1`. |
| `src/practice/nudges.ts` (modify) + test | Add `spread-too-tight`, `inventory-runaway` MM nudges. |
| `src/practice/engines.ts` (modify) + test | Add `marketMakingEngine: TrackEngine`. |
| `src/practice/scenes/MarketMakeScene.ts` (new) | Phaser scene: set widths/size/cap, visualize ladder + inventory, emit decision. |
| `src/practice/scenes/index.ts` (modify) + test | Register `MarketMakeScene`. |
| `src/practice/scenarioRegistry.ts` (modify) | Add curated market-making scenarios (tiers 1–3). |
| `src/pages/PracticePage.tsx` (modify) | Enable the market-making track card. |

---

## Task 1: Book stats from real candles

**Files:**
- Create: `src/practice/bookStats.ts`
- Test: `src/practice/bookStats.test.ts`

**Interfaces:**
- Consumes: `Candle` from `../engine/scenes/CandleChartScene` (same type M1 uses).
- Produces: `BookStats = { mids: number[]; sigma: number; mid0: number; finalMid: number }`, `bookStatsFromCandles(candles, steps?) → BookStats`. `sigma` is the stdev of consecutive close-to-close moves (price units) over the window; `mids` is the close path resampled to `steps` points.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/bookStats.test.ts
import { describe, it, expect } from 'vitest'
import { bookStatsFromCandles } from './bookStats'

const candle = (c: number) => ({ t: 0, o: c, h: c, l: c, c })

describe('bookStatsFromCandles', () => {
  it('reports a flat path with zero volatility', () => {
    const s = bookStatsFromCandles(Array.from({ length: 10 }, () => candle(100)))
    expect(s.sigma).toBe(0)
    expect(s.mid0).toBe(100)
    expect(s.finalMid).toBe(100)
    expect(s.mids.every((m) => m === 100)).toBe(true)
  })
  it('computes a positive sigma for a moving path and preserves endpoints', () => {
    const closes = [100, 101, 99, 102, 98, 103]
    const s = bookStatsFromCandles(closes.map(candle))
    expect(s.sigma).toBeGreaterThan(0)
    expect(s.mid0).toBe(100)
    expect(s.finalMid).toBe(103)
  })
  it('resamples to the requested number of steps', () => {
    const closes = Array.from({ length: 200 }, (_, i) => 100 + i)
    const s = bookStatsFromCandles(closes.map(candle), 20)
    expect(s.mids.length).toBe(20)
    expect(s.mids[0]).toBe(100)
    expect(s.finalMid).toBe(closes[closes.length - 1])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/bookStats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/bookStats.ts
import type { Candle } from '../engine/scenes/CandleChartScene'

export interface BookStats {
  /** Real mid path the session walks (close prices, resampled to `steps`). */
  mids: number[]
  /** Realized volatility: stdev of consecutive mid moves, in price units. */
  sigma: number
  mid0: number
  finalMid: number
}

/** Resample an array to exactly n points (linear index pick, endpoints preserved). */
function resample(xs: number[], n: number): number[] {
  if (xs.length <= n) return xs.slice()
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(xs[Math.round((i * (xs.length - 1)) / (n - 1))])
  return out
}

export function bookStatsFromCandles(candles: Candle[], steps = 30): BookStats {
  const closes = candles.map((c) => c.c)
  const diffs: number[] = []
  for (let i = 1; i < closes.length; i++) diffs.push(closes[i] - closes[i - 1])
  const mean = diffs.reduce((a, b) => a + b, 0) / (diffs.length || 1)
  const variance = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (diffs.length || 1)
  const mids = resample(closes, steps)
  return {
    mids,
    sigma: Math.sqrt(variance),
    mid0: closes[0],
    finalMid: closes[closes.length - 1],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/bookStats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/bookStats.ts src/practice/bookStats.test.ts
git commit -m "feat(practice): real-path book stats (mids + realized vol) for market making"
```

---

## Task 2: Pure market-making session simulator

**Files:**
- Create: `src/practice/resolve/marketMaking.ts`
- Test: `src/practice/resolve/marketMaking.test.ts`

**Interfaces:**
- Consumes: `MarketMakingDecision`, `ScenarioOutcome` from `../types`; `BookStats`.
- Produces: `simulateMarketMaking(decision, params) → ScenarioOutcome`, `MMParams = { mids, sigma, orderRate? }`, `REACH_K`, `DEFAULT_ORDER_RATE`. Deterministic, RNG-free.

**Model (deterministic, labelled illustrative):** at each step `t` with mid `m_t` and next mid `m_{t+1}`:
- `reach = REACH_K * sigma` (how far a quote can be from mid and still get hit).
- Per-side fill fraction `askFill = clamp01(1 - askWidth/reach)`, `bidFill = clamp01(1 - bidWidth/reach)`.
- Trend tilt `tilt = clamp(move/reach, -1, 1)`; `buyFlow = orderRate·(0.5+0.5·tilt)`, `sellFlow = orderRate·(0.5−0.5·tilt)` (up-moves lift the ask, down-moves hit the bid).
- Ask hit shares `= min(quoteSize, round(buyFlow·askFill))`, bid hit `= min(quoteSize, round(sellFlow·bidFill))`, each clamped so inventory never exceeds `±maxInventory`.
- Sells at `m_t+askWidth` (inv−), buys at `m_t−bidWidth` (inv+); accrue cash + `spreadCaptured += askWidth·askShares + bidWidth·bidShares`.
- End: `pnl = cash + inventory·finalMid`; `adverseSelection = pnl − spreadCaptured` (≤0 on trends, 0 on a flat path).

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/resolve/marketMaking.test.ts
import { describe, it, expect } from 'vitest'
import { simulateMarketMaking } from './marketMaking'
import type { MarketMakingDecision } from '../types'

const flat: MarketMakingDecision = { bidWidth: 0.5, askWidth: 0.5, quoteSize: 100, maxInventory: 1000 }

describe('simulateMarketMaking', () => {
  it('captures pure spread with no adverse selection on a flat path', () => {
    // mids=[100,100]: one step, no move. reach=1, fill=0.5, flow=2 each side, fills=1 each.
    const out = simulateMarketMaking(flat, { mids: [100, 100], sigma: 1, orderRate: 4 })
    expect(out.facts.spreadCaptured).toBeCloseTo(1.0, 6)
    expect(out.facts.adverseSelection).toBeCloseTo(0, 6)
    expect(out.facts.finalInventory).toBe(0)
    expect(out.pnl).toBeCloseTo(1.0, 6)
  })

  it('is deterministic — identical inputs give identical outputs', () => {
    const p = { mids: [100, 101, 99, 102, 98], sigma: 1.5, orderRate: 5 }
    expect(simulateMarketMaking(flat, p)).toEqual(simulateMarketMaking(flat, p))
  })

  it('a strong uptrend produces adverse selection (pnl below spread captured)', () => {
    const out = simulateMarketMaking(flat, { mids: [100, 102, 104, 106, 108], sigma: 1, orderRate: 5 })
    expect(out.facts.adverseSelection as number).toBeLessThan(0)
  })

  it('respects the inventory cap', () => {
    const tight = { bidWidth: 0.1, askWidth: 5, quoteSize: 100, maxInventory: 50 } // bids fill, asks rarely
    const out = simulateMarketMaking(tight, { mids: [100, 99, 98, 97, 96], sigma: 1, orderRate: 8 })
    expect(Math.abs(out.facts.finalInventory as number)).toBeLessThanOrEqual(50)
    expect(out.facts.maxInventoryHeld as number).toBeLessThanOrEqual(50)
  })

  it('tighter spreads fill more than wider spreads on the same path', () => {
    const path = { mids: [100, 100, 100, 100], sigma: 2, orderRate: 6 }
    const tight = simulateMarketMaking({ ...flat, bidWidth: 0.2, askWidth: 0.2 }, path)
    const wide = simulateMarketMaking({ ...flat, bidWidth: 1.8, askWidth: 1.8 }, path)
    expect(tight.facts.fills as number).toBeGreaterThan(wide.facts.fills as number)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/resolve/marketMaking.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/resolve/marketMaking.ts
import type { MarketMakingDecision, ScenarioOutcome } from '../types'

export const REACH_K = 1
export const DEFAULT_ORDER_RATE = 4

export interface MMParams {
  /** Real mid path (from bookStatsFromCandles). */
  mids: number[]
  /** Realized volatility (price units). */
  sigma: number
  /** Baseline order arrivals per step (illustrative). */
  orderRate?: number
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

/**
 * Deterministic market-making session over a REAL mid path. Order flow is an
 * illustrative closed-form function of the real move each step; spread/inventory
 * arithmetic is exact. No RNG → reproducible.
 */
export function simulateMarketMaking(decision: MarketMakingDecision, params: MMParams): ScenarioOutcome {
  const { mids } = params
  const orderRate = params.orderRate ?? DEFAULT_ORDER_RATE
  const reach = Math.max(1e-9, REACH_K * params.sigma)
  const askFill = clamp01(1 - decision.askWidth / reach)
  const bidFill = clamp01(1 - decision.bidWidth / reach)

  let cash = 0
  let inv = 0
  let spreadCaptured = 0
  let fills = 0
  let maxInventoryHeld = 0

  for (let t = 0; t < mids.length - 1; t++) {
    const m = mids[t]
    const move = mids[t + 1] - m
    const tilt = clamp(move / reach, -1, 1)
    const buyFlow = orderRate * (0.5 + 0.5 * tilt) // lifts our ask
    const sellFlow = orderRate * (0.5 - 0.5 * tilt) // hits our bid

    // Ask side: we sell (inv decreases), capped at -maxInventory.
    let askShares = Math.min(decision.quoteSize, Math.round(buyFlow * askFill))
    askShares = Math.min(askShares, inv + decision.maxInventory) // inv - askShares >= -max
    askShares = Math.max(0, askShares)
    if (askShares > 0) {
      const px = m + decision.askWidth
      cash += px * askShares
      inv -= askShares
      spreadCaptured += decision.askWidth * askShares
      fills += askShares
    }

    // Bid side: we buy (inv increases), capped at +maxInventory.
    let bidShares = Math.min(decision.quoteSize, Math.round(sellFlow * bidFill))
    bidShares = Math.min(bidShares, decision.maxInventory - inv) // inv + bidShares <= +max
    bidShares = Math.max(0, bidShares)
    if (bidShares > 0) {
      const px = m - decision.bidWidth
      cash -= px * bidShares
      inv += bidShares
      spreadCaptured += decision.bidWidth * bidShares
      fills += bidShares
    }

    maxInventoryHeld = Math.max(maxInventoryHeld, Math.abs(inv))
  }

  const finalMid = mids[mids.length - 1]
  const pnl = cash + inv * finalMid
  const round2 = (x: number) => Math.round(x * 100) / 100
  return {
    pnl: round2(pnl),
    facts: {
      spreadCaptured: round2(spreadCaptured),
      adverseSelection: round2(pnl - spreadCaptured),
      finalInventory: inv,
      maxInventoryHeld,
      fills,
      finalMid,
    },
  }
}
```

> NOTE on the flat-path hand-check: `reach=1`, `askFill=bidFill=0.5`, `tilt=0`, `buyFlow=sellFlow=2`, ask/bid shares `=round(2·0.5)=1`. Sell @100.5, buy @99.5 → `cash=1.0`, `inv=0`, `spreadCaptured=0.5+0.5=1.0`, `pnl=1.0`, `adverse=0`. Matches the test exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/resolve/marketMaking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/resolve/marketMaking.ts src/practice/resolve/marketMaking.test.ts
git commit -m "feat(practice): deterministic market-making session simulator (real path)"
```

---

## Task 3: Market-making rubric

**Files:**
- Create: `src/practice/rubrics/marketMaking.ts`
- Test: `src/practice/rubrics/marketMaking.test.ts`
- Modify: `src/practice/rubrics/index.ts` (register `market-making-v1`)

**Interfaces:**
- Consumes: `Rubric`, `MarketMakingDecision`, `ScenarioOutcome`, `weightedTotal` (M0).
- Produces: `marketMakingRubricV1: Rubric`. Dimensions (process-first): `two-sided` (both sides quoted), `spread-vs-vol` (width sized to realized vol; the spec passes target vol via `coachContextKeys`/`facts.sigma` — see below), `inventory-discipline` (ended near flat + respected a sane cap), `quote-size` (size sane vs account). P&L shown, never gates.

The rubric needs the session's realized `sigma` to judge spread sizing. The simulator already returns `facts.finalMid`; **add `sigma` to the outcome facts** so the rubric is self-contained. Update `simulateMarketMaking` to also emit `facts.sigma = params.sigma` (one-line addition; extend the Task 2 flat-path test to assert `out.facts.sigma === 1`).

- [ ] **Step 1: Add `sigma` to outcome facts (extend Task 2)**

In `simulateMarketMaking`, add to `facts`: `sigma: params.sigma`. Add to `resolve/marketMaking.test.ts`:

```ts
it('echoes realized sigma in facts for the rubric', () => {
  expect(simulateMarketMaking(flat, { mids: [100, 100], sigma: 1, orderRate: 4 }).facts.sigma).toBe(1)
})
```

Run: `npx vitest run src/practice/resolve/marketMaking.test.ts` → PASS.

- [ ] **Step 2: Write the failing rubric test**

```ts
// src/practice/rubrics/marketMaking.test.ts
import { describe, it, expect } from 'vitest'
import { marketMakingRubricV1 } from './marketMaking'
import type { MarketMakingDecision, ScenarioOutcome, ScenarioSpec } from '../types'

const spec = {
  id: 'mm', track: 'market-making', tier: 1, title: 't', brief: 'b',
  dataRef: { bookStatsKey: 'X' }, objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 5 },
  rubricId: 'market-making-v1', nudges: [], coachContextKeys: [], source: 'curated',
} as ScenarioSpec

const outcome = (over: Partial<ScenarioOutcome['facts']> = {}): ScenarioOutcome => ({
  pnl: 50,
  facts: { spreadCaptured: 60, adverseSelection: -10, finalInventory: 0, maxInventoryHeld: 200, fills: 400, finalMid: 100, sigma: 1, ...over },
})

const good: MarketMakingDecision = { bidWidth: 1, askWidth: 1, quoteSize: 100, maxInventory: 500 }

describe('marketMakingRubricV1', () => {
  it('rewards two-sided quoting, vol-sized spread, and flat finish', () => {
    const s = marketMakingRubricV1(spec, good, outcome())
    expect(s.total).toBeGreaterThanOrEqual(75)
    expect(s.dimensions.map((d) => d.id).sort()).toEqual(['inventory-discipline', 'quote-size', 'spread-vs-vol', 'two-sided'])
  })
  it('penalises one-sided quoting (no two-sided market)', () => {
    const oneSided = { ...good, askWidth: 0 }
    expect(marketMakingRubricV1(spec, oneSided, outcome()).dimensions.find((d) => d.id === 'two-sided')!.score).toBeLessThan(0.5)
  })
  it('penalises a spread far too tight for the volatility (adverse selection)', () => {
    const tooTight = { ...good, bidWidth: 0.05, askWidth: 0.05 } // << sigma=1
    expect(marketMakingRubricV1(spec, tooTight, outcome({ sigma: 1 })).dimensions.find((d) => d.id === 'spread-vs-vol')!.score).toBeLessThan(0.6)
  })
  it('penalises ending far from flat (inventory ran away)', () => {
    const s = marketMakingRubricV1(spec, good, outcome({ finalInventory: 480, maxInventoryHeld: 500 }))
    expect(s.dimensions.find((d) => d.id === 'inventory-discipline')!.score).toBeLessThan(0.6)
  })
  it('never lets P&L gate the score (a loss with good process still scores well)', () => {
    expect(marketMakingRubricV1(spec, good, outcome({ ...{}, })).total).toBeGreaterThanOrEqual(75) // pnl irrelevant to total
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/practice/rubrics/marketMaking.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/practice/rubrics/marketMaking.ts
import type { DimensionScore, MarketMakingDecision, ProcessScore, Rubric } from '../types'
import { weightedTotal } from './index'

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export const marketMakingRubricV1: Rubric = (spec, decision, outcome): ProcessScore => {
  const d = decision as MarketMakingDecision
  const sigma = (outcome.facts.sigma as number) || 1
  const avgWidth = (d.bidWidth + d.askWidth) / 2
  const finalInv = Math.abs(outcome.facts.finalInventory as number)
  const cap = Math.max(1, d.maxInventory)

  // Two-sided: both sides must be live and not absurdly asymmetric.
  const bothLive = d.bidWidth > 0 && d.askWidth > 0
  const symmetry = 1 - clamp01(Math.abs(d.bidWidth - d.askWidth) / (avgWidth || 1))
  const twoSided = bothLive ? 0.6 + 0.4 * symmetry : 0.2

  // Spread vs vol: ideal half-width ≈ sigma; too tight → adverse selection, too wide → no fills.
  const ratio = avgWidth / sigma // 1 is ideal
  const spreadVsVol = clamp01(ratio <= 1 ? ratio : 1 / ratio) // peaks at 1, falls either side

  // Inventory discipline: ended near flat AND held a sane cap relative to account.
  const flatness = 1 - clamp01(finalInv / cap)
  const capNotional = cap * (outcome.facts.finalMid as number)
  const saneCap = clamp01(1 - Math.max(0, capNotional - spec.constraints.accountBalance) / spec.constraints.accountBalance)
  const inventory = 0.6 * flatness + 0.4 * saneCap

  // Quote size sane vs account (a single fill shouldn't be a huge fraction of capital).
  const sizeNotional = d.quoteSize * (outcome.facts.finalMid as number)
  const quoteSize = clamp01(1 - Math.max(0, sizeNotional - spec.constraints.accountBalance * 0.25) / (spec.constraints.accountBalance * 0.25))

  const dimensions: DimensionScore[] = [
    { id: 'two-sided', label: 'Two-sided market', weight: 2, score: twoSided, note: bothLive ? 'Quoted both sides.' : 'You only quoted one side — that is not market making.' },
    { id: 'spread-vs-vol', label: 'Spread sized to volatility', weight: 3, score: spreadVsVol, note: ratio < 0.5 ? 'Spread too tight for the vol — adverse selection eats you.' : ratio > 2 ? 'Spread too wide — you barely get filled.' : 'Spread reasonably sized to volatility.' },
    { id: 'inventory-discipline', label: 'Inventory discipline', weight: 3, score: inventory, note: flatness > 0.7 ? 'Finished near flat.' : 'Inventory ran away from you — manage your skew.' },
    { id: 'quote-size', label: 'Quote size vs capital', weight: 1, score: quoteSize, note: 'Quote size relative to account.' },
  ]

  const total = weightedTotal(dimensions)
  const pass = total >= spec.objective.passScore
  return {
    total,
    dimensions,
    pnl: outcome.pnl,
    title: pass ? 'Solid market making' : 'Process needs work',
    detail: `Spread captured ${outcome.facts.spreadCaptured}, adverse selection ${outcome.facts.adverseSelection}.`,
  }
}
```

- [ ] **Step 5: Register the rubric**

In `src/practice/rubrics/index.ts` add:

```ts
import { marketMakingRubricV1 } from './marketMaking'
// in RUBRICS:
'market-making-v1': marketMakingRubricV1,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/practice/rubrics/marketMaking.test.ts src/practice/rubrics/index.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/practice/rubrics/marketMaking.ts src/practice/rubrics/marketMaking.test.ts src/practice/rubrics/index.ts
git commit -m "feat(practice): market-making process rubric (two-sided, spread-vs-vol, inventory)"
```

---

## Task 4: Market-making nudges

**Files:**
- Modify: `src/practice/nudges.ts`
- Extend: `src/practice/nudges.test.ts`

**Interfaces:**
- Produces: two new `NUDGES` entries — `spread-too-tight` (avg width ≪ sigma) and `inventory-runaway` (maxInventory huge vs account). Reuses the M0 `NudgeContext` (extend it with optional `mm?: { sigma?: number }` if needed; keep additive).

- [ ] **Step 1: Add failing nudge tests**

```ts
// append to src/practice/nudges.test.ts
import { NUDGES, evaluateNudges } from './nudges'

describe('market-making nudges', () => {
  const base = { constraints: { accountBalance: 10000, maxRiskPct: 5 } } as never
  it('fires spread-too-tight when half-spread is far below realized vol', () => {
    const ctx = { ...base, decision: { bidWidth: 0.05, askWidth: 0.05, quoteSize: 100, maxInventory: 200 }, sigma: 1 } as never
    expect(NUDGES['spread-too-tight'].triggered(ctx)).toBe(true)
  })
  it('fires inventory-runaway when the cap notional dwarfs the account', () => {
    const ctx = { ...base, decision: { bidWidth: 1, askWidth: 1, quoteSize: 100, maxInventory: 100000 }, finalMid: 100 } as never
    expect(NUDGES['inventory-runaway'].triggered(ctx)).toBe(true)
  })
  it('returns fired ids via evaluateNudges', () => {
    const ctx = { ...base, decision: { bidWidth: 0.05, askWidth: 0.05, quoteSize: 100, maxInventory: 200 }, sigma: 1 } as never
    expect(evaluateNudges(['spread-too-tight'], ctx)).toContain('spread-too-tight')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/nudges.test.ts`
Expected: FAIL — keys not present.

- [ ] **Step 3: Add the nudges (extend NUDGES + NudgeContext)**

In `src/practice/nudges.ts`, extend `NudgeContext` additively and add entries:

```ts
// NudgeContext (add optional fields):
//   sigma?: number; finalMid?: number
'spread-too-tight': {
  id: 'spread-too-tight',
  copy: 'Your spread is much tighter than this name’s volatility — you’ll get picked off (adverse selection). Widen it.',
  triggered: (ctx) => {
    const d = ctx.decision as { bidWidth?: number; askWidth?: number }
    const sigma = (ctx as { sigma?: number }).sigma
    if (sigma == null || d.bidWidth == null || d.askWidth == null) return false
    return (d.bidWidth + d.askWidth) / 2 < 0.25 * sigma
  },
},
'inventory-runaway': {
  id: 'inventory-runaway',
  copy: 'Your inventory cap is huge relative to your account — one trend and you’re carrying risk you can’t cover.',
  triggered: (ctx) => {
    const d = ctx.decision as { maxInventory?: number }
    const mid = (ctx as { finalMid?: number }).finalMid ?? 100
    if (d.maxInventory == null) return false
    return d.maxInventory * mid > ctx.constraints.accountBalance * 2
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/nudges.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/nudges.ts src/practice/nudges.test.ts
git commit -m "feat(practice): market-making nudges (spread-too-tight, inventory-runaway)"
```

---

## Task 5: Market-making engine (TrackEngine)

**Files:**
- Modify: `src/practice/engines.ts`
- Extend: `src/practice/engines.test.ts`

**Interfaces:**
- Consumes: `TrackEngine` (M2), `loadCandles` (M1 corpus), `bookStatsFromCandles`, `simulateMarketMaking`.
- Produces: `marketMakingEngine: TrackEngine`, registered in the engines map under `'market-making'`.

- [ ] **Step 1: Add failing engine test**

```ts
// append to src/practice/engines.test.ts
import { getEngine } from './engines'

describe('marketMakingEngine', () => {
  it('is registered for the market-making track', () => {
    expect(getEngine('market-making').track).toBe('market-making')
  })
  it('builds scene params from loaded book stats and resolves a decision', async () => {
    const eng = getEngine('market-making')
    const spec = {
      id: 'mm1', track: 'market-making', tier: 1, title: 't', brief: 'b',
      dataRef: { candlesKey: Object.keys((await import('../data/candles')).CANDLES)[0] },
      objective: { kind: 'process', passScore: 70 }, constraints: { accountBalance: 10000, maxRiskPct: 5 },
      rubricId: 'market-making-v1', nudges: [], coachContextKeys: [], source: 'curated',
    } as never
    const data = await eng.loadData(spec)
    const params = eng.sceneParams(spec, data)
    expect(params.sceneKey).toBeTruthy()
    const outcome = eng.resolve(spec, { bidWidth: 0.5, askWidth: 0.5, quoteSize: 100, maxInventory: 500 } as never, data)
    expect(typeof outcome.pnl).toBe('number')
    expect(outcome.facts.sigma).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/engines.test.ts`
Expected: FAIL — `market-making` engine not registered.

- [ ] **Step 3: Add the engine**

In `src/practice/engines.ts`:

```ts
import { bookStatsFromCandles, type BookStats } from './bookStats'
import { simulateMarketMaking } from './resolve/marketMaking'
import { loadCandles } from './corpus'

export const marketMakingEngine: TrackEngine = {
  track: 'market-making',
  async loadData(spec) {
    const candles = await loadCandles(spec.dataRef)
    return bookStatsFromCandles(candles) as BookStats & Record<string, unknown>
  },
  sceneParams(spec, data) {
    const s = data as BookStats
    return { sceneKey: 'MarketMakeScene', mids: s.mids, sigma: s.sigma, mid0: s.mid0, constraints: spec.constraints }
  },
  resolve(spec, decision, data) {
    const s = data as BookStats
    return simulateMarketMaking(decision as never, { mids: s.mids, sigma: s.sigma })
  },
}
```

Register it in the engines map: `'market-making': marketMakingEngine`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/engines.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/engines.ts src/practice/engines.test.ts
git commit -m "feat(practice): market-making TrackEngine (book stats + simulator)"
```

---

## Task 6: MarketMakeScene (Phaser) + registration

**Files:**
- Create: `src/practice/scenes/MarketMakeScene.ts`
- Modify: `src/practice/scenes/index.ts`
- Extend: `src/practice/scenes/index.test.ts`

**Interfaces:**
- Extends: `ModuleScene` (uses `emitDecision`/`emitNudge` from M1).
- Produces: `MarketMakeScene` keyed `'MarketMakeScene'`. Renders a compact ladder around `mid0`, sliders/steppers for bid width, ask width, quote size, inventory cap; live nudge emits on tighten/oversize; emits a `MarketMakingDecision` on submit. Wiring smoke-tested with mocked Phaser (same pattern as `ChartTradeScene`/`OptionsBuildScene`).

- [ ] **Step 1: Write the scene**

```ts
// src/practice/scenes/MarketMakeScene.ts
import { ModuleScene } from '../../engine/ModuleScene'
import { fmtPrice } from '../../lessons/order-book/scenes/book'
import type { MarketMakingDecision } from '../types'

export interface MarketMakeParams {
  mids: number[]
  sigma: number
  mid0: number
  constraints: { accountBalance: number; maxRiskPct: number }
}

/**
 * Two-sided quoting setup. The mid path is REAL (from OHLC); the live ladder is an
 * illustrative snapshot. Emits a MarketMakingDecision; the deterministic session runs
 * in the resolver (src/practice/resolve/marketMaking.ts).
 */
export class MarketMakeScene extends ModuleScene {
  static readonly KEY = 'MarketMakeScene'
  private decision: MarketMakingDecision = { bidWidth: 0, askWidth: 0, quoteSize: 0, maxInventory: 0 }
  private p!: MarketMakeParams

  constructor() {
    super(MarketMakeScene.KEY)
  }

  init(data: MarketMakeParams): void {
    this.p = data
    // Sensible defaults seeded from realized vol so the learner starts in a sane place.
    this.decision = {
      bidWidth: Math.max(0.01, Math.round(data.sigma * 100) / 100),
      askWidth: Math.max(0.01, Math.round(data.sigma * 100) / 100),
      quoteSize: 100,
      maxInventory: 500,
    }
  }

  create(): void {
    this.drawLadder()
    this.drawControls()
    this.emitReady()
  }

  /** Called by the controls; re-evaluates live nudges and re-renders. */
  private update_(patch: Partial<MarketMakingDecision>): void {
    this.decision = { ...this.decision, ...patch }
    const avg = (this.decision.bidWidth + this.decision.askWidth) / 2
    if (avg < 0.25 * this.p.sigma) this.emitNudge('spread-too-tight')
    if (this.decision.maxInventory * this.p.mid0 > this.p.constraints.accountBalance * 2) this.emitNudge('inventory-runaway')
    this.drawLadder()
  }

  private drawLadder(): void {
    /* draw mid0, bid=mid0-bidWidth, ask=mid0+askWidth, quoteSize, inventory cap; labels via fmtPrice. */
  }
  private drawControls(): void {
    /* steppers for bidWidth, askWidth, quoteSize, maxInventory calling this.update_(...) ;
       a Submit button → this.emitDecision(this.decision as unknown as Record<string, unknown>). */
  }
}
```

> NOTE: implement `drawLadder`/`drawControls` with the same Phaser primitives used in `ChartTradeScene`/`OptionsBuildScene` (rectangles, text, zone-based steppers). Keep them visual-only; all math lives in the resolver. Honor `prefers-reduced-motion` (M6) by avoiding tweened motion here.

- [ ] **Step 2: Register + extend the scenes smoke test**

In `src/practice/scenes/index.ts`:

```ts
import { MarketMakeScene } from './MarketMakeScene'
export const PRACTICE_SCENES = { ChartTradeScene, OptionsBuildScene, MarketMakeScene } as const
```

Append to `src/practice/scenes/index.test.ts` (mirrors the existing mocked-Phaser wiring test):

```ts
it('MarketMakeScene constructs with its key and exposes lifecycle hooks', () => {
  const s = new MarketMakeScene()
  expect(MarketMakeScene.KEY).toBe('MarketMakeScene')
  expect(typeof s.create).toBe('function')
  expect(typeof s.init).toBe('function')
})
it('is registered in PRACTICE_SCENES', () => {
  expect(Object.keys(PRACTICE_SCENES)).toContain('MarketMakeScene')
})
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/practice/scenes/index.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/practice/scenes/MarketMakeScene.ts src/practice/scenes/index.ts src/practice/scenes/index.test.ts
git commit -m "feat(practice): MarketMakeScene (two-sided quoting) + registration"
```

---

## Task 7: Curated market-making scenarios + enable the track

**Files:**
- Modify: `src/practice/scenarioRegistry.ts`, `src/pages/PracticePage.tsx`

**Interfaces:**
- Produces: ≥3 curated `market-making` scenarios (tiers 1–3) referencing real candle keys via `dataRef.candlesKey`; the Practice page's market-making card becomes active.

- [ ] **Step 1: Add curated MM scenarios**

In `src/practice/scenarioRegistry.ts` add entries (each must pass `validateSpec`):
- Tier 1: a calm, range-bound name — "Make a market in a quiet session." `requireDefinedRisk`/`requireStop` not applicable; `maxRiskPct: 5`.
- Tier 2: a moderately volatile session — spread sizing matters more.
- Tier 3: a trending session — inventory/adverse-selection management is the lesson.

All use `rubricId: 'market-making-v1'`, `nudges: [{ id: 'spread-too-tight' }, { id: 'inventory-runaway' }]`, `coachContextKeys: ['spreadCaptured', 'adverseSelection', 'finalInventory', 'sigma']`, `illustrativeFlags: ['orderFlow']`.

- [ ] **Step 2: Enable the track card**

In `src/pages/PracticePage.tsx`, remove any "coming soon" guard on the `market-making` card so it routes to `/practice/market-making` and starts scenarios (the engine/scene now exist).

- [ ] **Step 3: Run the registry + adaptive coverage contracts**

Run: `npx vitest run src/practice/scenarioRegistry.test.ts`
Add to that test:

```ts
it('market-making covers tiers 1..3', () => {
  for (const t of [1, 2, 3]) expect(scenariosFor('market-making', t).length).toBeGreaterThan(0)
})
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/practice/scenarioRegistry.ts src/practice/scenarioRegistry.test.ts src/pages/PracticePage.tsx
git commit -m "feat(practice): curated market-making scenarios + enable Track B"
```

---

## Task 8: M5 exit check

**Files:** (none — verification)

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 2: Manual exit criteria (PRDphase2 §17 M5 row)**

1. From `/practice`, the market-making card is active → pick a tier-1 session.
2. Set bid/ask widths, quote size, inventory cap; tightening the spread below ~¼ of the name's vol fires the `spread-too-tight` nudge live; a huge cap fires `inventory-runaway`.
3. Submit → journal → the session resolves deterministically over the **real** path; the debrief shows spread captured vs adverse selection and an inventory comment; **score is process-based** (a green session with reckless inventory still scores poorly; a small-loss session with disciplined two-sided quoting scores well).
4. Re-running the same scenario with the same inputs yields the identical outcome (determinism).

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(practice): M5 Track B market making green"
```

---

## Self-Review

**1. Spec coverage (PRDphase2 §6 Track B, §9 grading, §10 honesty):** Two-sided quoting over a **real** mid path; order flow a deterministic, labelled illustrative sim; spread/inventory math exact. Process rubric (two-sided, spread-vs-vol, inventory discipline, quote size) with P&L shown not gating; spread-captured vs adverse-selection decomposition. Live nudges. Tiered scenarios. Deterministic + reproducible. ✓

**2. Placeholder scan:** Only the Phaser `drawLadder`/`drawControls` bodies are described rather than pixel-coded — explicitly delegated to the established `ChartTradeScene`/`OptionsBuildScene` primitives, with all math in the (fully tested) resolver. No logic TBDs. ✓

**3. Type consistency:** Reuses M0 `MarketMakingDecision` exactly (`bidWidth`/`askWidth`/`quoteSize`/`maxInventory`). `simulateMarketMaking(decision, {mids,sigma,orderRate?}) → ScenarioOutcome` consumed by `marketMakingEngine.resolve`; `facts.sigma` added so `marketMakingRubricV1` is self-contained. `TrackEngine` (M2) interface matched (`loadData`/`sceneParams`/`resolve`). `Rubric`/`weightedTotal`/`DimensionScore` (M0) reused. `loadCandles`/`Candle` (M1) reused. `ModuleScene.emitDecision`/`emitNudge` (M1) reused. ✓

**Carried interfaces M6 relies on:** `marketMakingEngine`, `MarketMakeScene`, `market-making-v1` rubric, MM nudges, curated MM scenarios; the `illustrativeFlags`/`facts` decomposition the M6 copy/analytics pass surfaces.
