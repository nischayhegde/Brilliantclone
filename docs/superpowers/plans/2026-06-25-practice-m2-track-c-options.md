# Practice Mode — M2: Track C (Options Strategies) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the options track — the learner builds a (multi-leg) defined-risk position from a **real option-chain snapshot** (real premiums, IV, Greeks), time advances over the real underlying, P&L resolves with exact expiry math, an `options-v1` rubric grades thesis/sizing/defined-risk/strike-expiry sanity/management, and the live "P/L today vs at expiry" curve teaches theta/IV.

**Architecture:** Introduce a per-track **engine** abstraction (`engines.ts`) so the M1 scenario player dispatches by `spec.track` instead of being charts-specific. Add a chain-snapshot loader (`chain.ts`) over `public/data/options/*`, a pure Black–Scholes module (`resolve/bs.ts`) fed **real IV** for the in-scene "today" curve + any mid-life close, and a pure `resolve/options.ts` that books **exact expiry intrinsic on real premiums**. Reuse `optionMath`/`payoffMath` for all payoff math.

**Tech Stack:** Same as M0/M1. Reuses `optionMath.ts` (`Position`, `pnlPerContract`, `maxLoss`), `payoffMath.ts` (`Leg`, `combinedPnL`, `breakevens`, `MULTIPLIER`), and the ingested options + OHLC corpus.

## Global Constraints

- (All M0/M1 Global Constraints apply.) `npm run typecheck` + `npm test` green at every commit.
- **Booked P&L is exact + real:** the number that hits the paper balance is computed by `combinedPnL` (exact) using **real premiums from the snapshot** and the **real underlying close on the expiry date**. No model price is ever booked for a held-to-expiry position.
- **Mid-life values are labelled:** the live "P/L today" curve and any *closed-early* P&L use Black–Scholes fed **real snapshot IV** — these are model estimates and MUST be rendered "model estimate · IV real" (`illustrativeFlags`), per POLISH_STYLE_GUIDE §3.
- **Real chain shape (verified):** `{ meta:{symbol,date,spot,expirations[]}, chain:[{exp,strike,cp:'C'|'P',bid,ask,mid,iv,delta,gamma,theta,vega,rho}] }`. Coverage: 13 single-name symbols (e.g. DIS, JPM, AAPL…), monthly snapshots 2020-01..2025-12 (see `public/data/options-manifest.json`).
- **Underlying for expiry:** load the symbol's daily series (`{SYM}__1d.json`) from the OHLC corpus; expiry close = the candle whose UTC date equals the leg expiry.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/practice/chain.ts` (+ `.test.ts`) | Load + index option-chain snapshots: `loadChain`, `contractsForExpiry`, `findContract`, `dte`. |
| `src/practice/resolve/bs.ts` (+ `.test.ts`) | Pure Black–Scholes price + normal CDF (model "today"/close value from real IV). |
| `src/practice/resolve/options.ts` (+ `.test.ts`) | `resolveOptionsPosition(snapshot, underlying, decision)` → exact expiry P&L; `combinedExpiryMaxLoss`. |
| `src/practice/rubrics/options.ts` (+ `.test.ts`) | `optionsRubricV1` (`options-v1`): thesis, sizing-by-max-loss, defined risk, R:R, strike/expiry sanity, management. |
| `src/practice/scenes/OptionsBuildScene.ts` | Phaser scene: pick expiry/strike/side/contracts from the real chain; live payoff curve (reuses payoffMath); emits `decision`. |
| `src/practice/scenes/index.ts` (modify) | Register `options-build`. |
| `src/practice/engines.ts` (+ `.test.ts`) | Per-track engine map (`loadData`, `sceneParams`, `resolve`); charts engine wraps M1, options engine new. |
| `src/practice/ScenarioPlayer.tsx` (modify) | Dispatch via `ENGINES[spec.track]` (track-agnostic). |
| `src/pages/ScenarioPlayerPage.tsx` (modify) | Load data via the engine, not `loadCandles` directly. |
| `src/practice/rubrics/index.ts` (modify) | Register `options-v1`. |
| `src/practice/scenarioRegistry.ts` (modify) | Add ≥8 curated options specs across tiers 1–3 referencing real snapshots. |

---

## Task 1: Chain snapshot loader

**Files:**
- Create: `src/practice/chain.ts`
- Test: `src/practice/chain.test.ts`

**Interfaces:**
- Produces: `ChainSnapshot`, `ContractRow`, `loadChain(asset) → Promise<ChainSnapshot>`, `contractsForExpiry(snap, exp)`, `findContract(snap, exp, strike, cp)`, `dteDays(fromIso, exp)`, `__clearChainCache()`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/chain.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadChain, contractsForExpiry, findContract, dteDays, __clearChainCache } from './chain'

const SNAP = {
  meta: { symbol: 'DIS', date: '2021-02-17', spot: 186.44, expirations: ['2021-03-19'], contracts: 2 },
  chain: [
    { exp: '2021-03-19', strike: 185, cp: 'C', bid: 7.8, ask: 8.05, mid: 7.93, iv: 0.338, delta: 0.55, gamma: 0.02, theta: -0.12, vega: 0.21, rho: 0.08 },
    { exp: '2021-03-19', strike: 185, cp: 'P', bid: 6.25, ask: 6.5, mid: 6.38, iv: 0.333, delta: -0.45, gamma: 0.02, theta: -0.12, vega: 0.21, rho: -0.07 },
  ],
}

beforeEach(() => __clearChainCache())

describe('loadChain', () => {
  it('fetches + caches a snapshot (one fetch for two loads)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => SNAP })
    vi.stubGlobal('fetch', fetchMock)
    const a = await loadChain('data/options/DIS__2021-02-17.json')
    const b = await loadChain('data/options/DIS__2021-02-17.json')
    expect(a.meta.spot).toBe(186.44)
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('indexing helpers', () => {
  it('contractsForExpiry filters by expiry', () => {
    expect(contractsForExpiry(SNAP as never, '2021-03-19')).toHaveLength(2)
    expect(contractsForExpiry(SNAP as never, '2099-01-01')).toHaveLength(0)
  })
  it('findContract returns the exact strike+cp row', () => {
    expect(findContract(SNAP as never, '2021-03-19', 185, 'C')?.mid).toBe(7.93)
    expect(findContract(SNAP as never, '2021-03-19', 999, 'C')).toBeUndefined()
  })
  it('dteDays counts calendar days from snapshot date to expiry', () => {
    expect(dteDays('2021-02-17', '2021-03-19')).toBe(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/chain.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/chain.ts
export type CP = 'C' | 'P'

export interface ContractRow {
  exp: string
  strike: number
  cp: CP
  bid: number
  ask: number
  mid: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

export interface ChainSnapshot {
  meta: { symbol: string; date: string; spot: number; expirations: string[]; contracts?: number; source?: string }
  chain: ContractRow[]
}

const cache = new Map<string, ChainSnapshot>()
export function __clearChainCache(): void {
  cache.clear()
}

export async function loadChain(asset: string): Promise<ChainSnapshot> {
  const hit = cache.get(asset)
  if (hit) return hit
  const res = await fetch(`/${asset}`)
  if (!res.ok) throw new Error(`Failed to load ${asset}: HTTP ${res.status}`)
  const snap = (await res.json()) as ChainSnapshot
  cache.set(asset, snap)
  return snap
}

export function contractsForExpiry(snap: ChainSnapshot, exp: string): ContractRow[] {
  return snap.chain.filter((r) => r.exp === exp)
}

export function findContract(snap: ChainSnapshot, exp: string, strike: number, cp: CP): ContractRow | undefined {
  return snap.chain.find((r) => r.exp === exp && r.strike === strike && r.cp === cp)
}

/** Calendar days from an ISO date to an expiry (UTC). */
export function dteDays(fromIso: string, exp: string): number {
  const ms = Date.parse(exp + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')
  return Math.round(ms / 86_400_000)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/chain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/chain.ts src/practice/chain.test.ts
git commit -m "feat(practice): option-chain snapshot loader + indexing helpers"
```

---

## Task 2: Pure Black–Scholes (model "today"/close value from real IV)

**Files:**
- Create: `src/practice/resolve/bs.ts`
- Test: `src/practice/resolve/bs.test.ts`

**Interfaces:**
- Produces: `normCdf(x)`, `bsPrice(cp, S, K, tYears, sigma, r?) → number`. Used for the in-scene "P/L today" curve and *closed-early* valuation; outputs are labelled model estimates.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/resolve/bs.test.ts
import { describe, it, expect } from 'vitest'
import { bsPrice, normCdf } from './bs'

describe('normCdf', () => {
  it('is ~0.5 at 0 and monotone', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 3)
    expect(normCdf(1.96)).toBeCloseTo(0.975, 2)
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 2)
  })
})

describe('bsPrice', () => {
  it('an ATM call with real-ish IV is positive and below spot', () => {
    const p = bsPrice('C', 100, 100, 30 / 365, 0.3, 0.01)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(100)
  })
  it('at expiry (t→0) collapses to intrinsic', () => {
    expect(bsPrice('C', 110, 100, 0, 0.3, 0.01)).toBeCloseTo(10, 6)
    expect(bsPrice('P', 90, 100, 0, 0.3, 0.01)).toBeCloseTo(10, 6)
    expect(bsPrice('C', 90, 100, 0, 0.3, 0.01)).toBeCloseTo(0, 6)
  })
  it('put-call parity holds approximately', () => {
    const c = bsPrice('C', 100, 100, 0.5, 0.25, 0.02)
    const p = bsPrice('P', 100, 100, 0.5, 0.25, 0.02)
    // C - P = S - K e^{-rT}
    expect(c - p).toBeCloseTo(100 - 100 * Math.exp(-0.02 * 0.5), 4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/resolve/bs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/resolve/bs.ts
import type { CP } from '../chain'

/** Abramowitz–Stegun 7.1.26 approximation of the standard normal CDF. */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp(-0.5 * x * x)
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

/**
 * Black–Scholes European price. Inputs are REAL (S from the underlying path, sigma =
 * the snapshot IV); the OUTPUT is a model estimate, labelled as such wherever shown.
 */
export function bsPrice(cp: CP, S: number, K: number, tYears: number, sigma: number, r = 0.01): number {
  if (tYears <= 0 || sigma <= 0) {
    return cp === 'C' ? Math.max(S - K, 0) : Math.max(K - S, 0)
  }
  const sqrtT = Math.sqrt(tYears)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * tYears) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  if (cp === 'C') return S * normCdf(d1) - K * Math.exp(-r * tYears) * normCdf(d2)
  return K * Math.exp(-r * tYears) * normCdf(-d2) - S * normCdf(-d1)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/resolve/bs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/resolve/bs.ts src/practice/resolve/bs.test.ts
git commit -m "feat(practice): pure Black–Scholes pricer (model value from real IV)"
```

---

## Task 3: Pure options position resolver

**Files:**
- Create: `src/practice/resolve/options.ts`
- Test: `src/practice/resolve/options.test.ts`

**Interfaces:**
- Consumes: `Leg`, `legPnL`, `combinedPnL`, `MULTIPLIER` from `../../lessons/volatility/scenes/payoffMath`; `Candle`; `OptionsDecision`, `OptionLegDecision`, `ScenarioOutcome` from `../types`; `bsPrice` from `./bs`; `dteDays` from `../chain`.
- Produces: `resolveOptionsPosition(underlying, snapshotDate, decision, opts?) → ScenarioOutcome`, `combinedExpiryMaxLoss(legs, sMax?) → number`, `underlyingCloseOn(underlying, isoDate) → number | undefined`.

Resolution: book **exact expiry P&L** for `hold`/`rolled` using `combinedPnL` at the realized underlying close on the (latest) expiry. For `closed-early`, value each leg via `bsPrice` at a midpoint (half the DTE) with the leg's IV (passed in from the snapshot) and the underlying close at that midpoint date → P&L flagged `modelEstimate: true`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/resolve/options.test.ts
import { describe, it, expect } from 'vitest'
import { resolveOptionsPosition, combinedExpiryMaxLoss, underlyingCloseOn } from './options'
import type { Candle } from '../../data/candles'
import type { OptionsDecision } from '../types'

// Daily candles incl. the expiry date 2021-03-19 (UTC midnight unix = 1616112000).
const day = (iso: string, c: number): Candle => ({ t: Date.parse(iso + 'T00:00:00Z') / 1000, o: c, h: c, l: c, c })
const underlying: Candle[] = [day('2021-02-17', 186), day('2021-03-05', 190), day('2021-03-19', 200)]

describe('underlyingCloseOn', () => {
  it('finds the close on the matching date', () => {
    expect(underlyingCloseOn(underlying, '2021-03-19')).toBe(200)
    expect(underlyingCloseOn(underlying, '2099-01-01')).toBeUndefined()
  })
})

describe('resolveOptionsPosition (hold to expiry, exact)', () => {
  it('books exact intrinsic P&L for a long call held to expiry', () => {
    const d: OptionsDecision = {
      legs: [{ type: 'call', side: 'long', K: 185, expiry: '2021-03-19', premium: 7.93, contracts: 1 }],
      managed: 'hold',
    }
    const out = resolveOptionsPosition(underlying, '2021-02-17', d)
    // (max(200-185,0) - 7.93) * 100 = (15 - 7.93)*100 = 707
    expect(out.pnl).toBeCloseTo(707, 2)
    expect(out.facts.modelEstimate).toBe(false)
  })

  it('a short put kept (expires worthless) books +premium', () => {
    const d: OptionsDecision = {
      legs: [{ type: 'put', side: 'short', K: 180, expiry: '2021-03-19', premium: 4.33, contracts: 2 }],
      managed: 'hold',
    }
    const out = resolveOptionsPosition(underlying, '2021-02-17', d)
    // S=200 > K=180 → put worthless → keep premium 4.33*100*2 = 866
    expect(out.pnl).toBeCloseTo(866, 2)
  })
})

describe('combinedExpiryMaxLoss', () => {
  it('is finite for a vertical spread', () => {
    const legs = [
      { type: 'call' as const, side: 'long' as const, K: 100, premium: 5 },
      { type: 'call' as const, side: 'short' as const, K: 110, premium: 2 },
    ]
    expect(Number.isFinite(combinedExpiryMaxLoss(legs))).toBe(true)
  })
  it('is Infinity for a naked short call', () => {
    const legs = [{ type: 'call' as const, side: 'short' as const, K: 100, premium: 5 }]
    expect(combinedExpiryMaxLoss(legs)).toBe(Infinity)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/resolve/options.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/resolve/options.ts
import type { Candle } from '../../data/candles'
import type { OptionsDecision, ScenarioOutcome } from '../types'
import { combinedPnL, legPnL, MULTIPLIER, type Leg } from '../../lessons/volatility/scenes/payoffMath'
import { bsPrice } from './bs'
import { dteDays } from '../chain'

const SECONDS_PER_DAY = 86_400

/** Underlying close on an exact ISO date (UTC), if present. */
export function underlyingCloseOn(underlying: Candle[], iso: string): number | undefined {
  const target = Date.parse(iso + 'T00:00:00Z') / 1000
  const hit = underlying.find((c) => Math.abs(c.t - target) < SECONDS_PER_DAY / 2)
  return hit?.c
}

/** Nearest underlying close on/just before an ISO date (for mid-life valuation). */
function closeNear(underlying: Candle[], iso: string): number | undefined {
  const target = Date.parse(iso + 'T00:00:00Z') / 1000
  let best: Candle | undefined
  for (const c of underlying) if (c.t <= target + SECONDS_PER_DAY && (!best || c.t > best.t)) best = c
  return best?.c
}

/** ISO date that is `frac` of the way from `from` to `exp`. */
function fracDate(from: string, exp: string, frac: number): string {
  const a = Date.parse(from + 'T00:00:00Z')
  const b = Date.parse(exp + 'T00:00:00Z')
  return new Date(a + (b - a) * frac).toISOString().slice(0, 10)
}

/**
 * Combined max loss across the expiry payoff (positive dollars), or Infinity if the
 * loss is unbounded (a naked short call). Scans a wide underlying grid.
 */
export function combinedExpiryMaxLoss(legs: Leg[], sMax = 100000): number {
  let worst = 0
  const step = Math.max(0.5, sMax / 4000)
  for (let S = 0; S <= sMax; S += step) {
    const pnl = combinedPnL(legs, S) * MULTIPLIER
    if (pnl < worst) worst = pnl
  }
  // Unbounded if the high-S tail is still steeply negative (short call).
  const tail = combinedPnL(legs, sMax) * MULTIPLIER
  const tail2 = combinedPnL(legs, sMax * 2) * MULTIPLIER
  if (tail2 < tail - 1) return Infinity
  return worst === 0 ? 0 : -worst
}

/**
 * Books P&L. Held/rolled → EXACT expiry intrinsic on real premiums (the number that
 * hits the balance). Closed-early → a Black–Scholes value at half the DTE using the
 * leg's real IV (flagged modelEstimate; the UI labels it).
 */
export function resolveOptionsPosition(
  underlying: Candle[],
  snapshotDate: string,
  decision: OptionsDecision,
  opts: { ivByLeg?: number[]; r?: number } = {},
): ScenarioOutcome {
  const r = opts.r ?? 0.01

  if (decision.managed === 'closed-early') {
    let pnl = 0
    decision.legs.forEach((leg, i) => {
      const closeDate = fracDate(snapshotDate, leg.expiry, 0.5)
      const S = closeNear(underlying, closeDate) ?? closeNear(underlying, snapshotDate) ?? 0
      const tYears = Math.max(0, dteDays(closeDate, leg.expiry)) / 365
      const sigma = opts.ivByLeg?.[i] ?? 0.3
      const cp = leg.type === 'call' ? 'C' : 'P'
      const value = bsPrice(cp, S, leg.K, tYears, sigma, r) // per share
      const perContract = (leg.side === 'long' ? value - leg.premium : leg.premium - value) * MULTIPLIER
      pnl += perContract * leg.contracts
    })
    return { pnl: Math.round(pnl * 100) / 100, facts: { modelEstimate: true, managed: 'closed-early' } }
  }

  // hold / rolled → exact expiry intrinsic at the (latest) expiry close.
  const latestExpiry = decision.legs.map((l) => l.expiry).sort().at(-1)!
  const S = underlyingCloseOn(underlying, latestExpiry) ?? closeNear(underlying, latestExpiry) ?? 0
  let pnl = 0
  for (const leg of decision.legs) {
    const l: Leg = { type: leg.type, side: leg.side, K: leg.K, premium: leg.premium }
    pnl += legPnL(l, S) * MULTIPLIER * leg.contracts
  }
  return { pnl: Math.round(pnl * 100) / 100, facts: { modelEstimate: false, sExpiry: S, managed: decision.managed ?? 'hold' } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/resolve/options.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/resolve/options.ts src/practice/resolve/options.test.ts
git commit -m "feat(practice): options resolver (exact expiry P&L + labelled BS close)"
```

---

## Task 4: Options process rubric (`options-v1`)

**Files:**
- Create: `src/practice/rubrics/options.ts`
- Modify: `src/practice/rubrics/index.ts` (register `options-v1`)
- Test: `src/practice/rubrics/options.test.ts`

**Interfaces:**
- Consumes: `Rubric`, `OptionsDecision`, `DimensionScore` from `../types`; `weightedTotal` from `./index`; `combinedExpiryMaxLoss` from `../resolve/options`; `Leg` from payoffMath.
- Produces: `optionsRubricV1: Rubric`; registered `RUBRICS['options-v1']`.

Dimensions (PRDphase2 §10.1 options column): thesis (w2), sizing-by-max-loss (w2), defined-risk (w2), R:R (w1), strike/expiry sanity (w2), management (w2). The decision carries each leg's snapshot `delta`/DTE via `OptionLegDecision` extension fields (`deltaAtEntry?`, `dteAtEntry?`) the scene fills from the chain.

- [ ] **Step 1: Extend `OptionLegDecision` with entry-context fields**

In `src/practice/types.ts`, add two optional fields to `OptionLegDecision` (carried for grading, sourced from the real chain — not invented):

```ts
export interface OptionLegDecision {
  type: 'call' | 'put'
  side: 'long' | 'short'
  K: number
  expiry: string
  premium: number
  contracts: number
  /** Snapshot delta of this contract at entry (from the chain; grading only). */
  deltaAtEntry?: number
  /** Days-to-expiry at entry (from the snapshot date; grading only). */
  dteAtEntry?: number
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/practice/rubrics/options.test.ts
import { describe, it, expect } from 'vitest'
import { optionsRubricV1 } from './options'
import type { ScenarioSpec, OptionsDecision, ScenarioOutcome } from '../types'

const spec = (over: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id: 'o', track: 'options', tier: 1, title: 't', brief: 'b',
  dataRef: { chainAsset: 'data/options/DIS__2021-02-17.json', decisionDate: '2021-02-17' },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 5, requireDefinedRisk: true },
  rubricId: 'options-v1', nudges: [], coachContextKeys: [], source: 'curated', ...over,
})
const out = (pnl: number): ScenarioOutcome => ({ pnl, facts: { modelEstimate: false } })

describe('optionsRubricV1', () => {
  it('rewards a defined-risk vertical sized within budget with sane strikes/DTE', () => {
    const d: OptionsDecision = {
      legs: [
        { type: 'put', side: 'short', K: 180, expiry: '2021-03-19', premium: 4.33, contracts: 1, deltaAtEntry: -0.34, dteAtEntry: 30 },
        { type: 'put', side: 'long', K: 175, expiry: '2021-03-19', premium: 2.93, contracts: 1, dteAtEntry: 30 },
      ],
      managed: 'closed-early',
    }
    const r = optionsRubricV1(spec(), d, out(120))
    expect(r.total).toBeGreaterThanOrEqual(80)
    expect(r.dimensions.find((x) => x.id === 'defined-risk')!.score).toBe(1)
  })

  it('punishes an undefined-risk naked short call', () => {
    const d: OptionsDecision = {
      legs: [{ type: 'call', side: 'short', K: 200, expiry: '2021-03-19', premium: 3, contracts: 1, deltaAtEntry: 0.3, dteAtEntry: 30 }],
      managed: 'hold',
    }
    const r = optionsRubricV1(spec(), d, out(300))
    expect(r.dimensions.find((x) => x.id === 'defined-risk')!.score).toBe(0)
    expect(r.total).toBeLessThan(60)
  })

  it('dings strike/expiry sanity for a 0DTE far-OTM lotto', () => {
    const d: OptionsDecision = {
      legs: [{ type: 'call', side: 'long', K: 240, expiry: '2021-03-05', premium: 0.08, contracts: 50, deltaAtEntry: 0.01, dteAtEntry: 2 }],
      managed: 'hold',
    }
    const r = optionsRubricV1(spec(), d, out(-400))
    expect(r.dimensions.find((x) => x.id === 'strike-expiry')!.score).toBeLessThan(0.5)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/practice/rubrics/options.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/practice/rubrics/options.ts
import type { DimensionScore, OptionsDecision, Rubric } from '../types'
import { weightedTotal } from './index'
import { combinedExpiryMaxLoss } from '../resolve/options'
import type { Leg } from '../../lessons/volatility/scenes/payoffMath'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export const optionsRubricV1: Rubric = (spec, decisionRaw, outcome) => {
  const d = decisionRaw as OptionsDecision
  const { accountBalance, maxRiskPct } = spec.constraints
  const legs: Leg[] = d.legs.map((l) => ({ type: l.type, side: l.side, K: l.K, premium: l.premium }))
  const maxLoss = combinedExpiryMaxLoss(legs.map((l, i) => ({ ...l, premium: l.premium }))) *
    Math.max(1, ...d.legs.map((l) => l.contracts))

  // defined-risk: finite combined max loss.
  const definedRisk = Number.isFinite(maxLoss) ? 1 : 0

  // sizing-by-max-loss: dollar max loss vs budget.
  const budget = (maxRiskPct / 100) * accountBalance
  const sizing = Number.isFinite(maxLoss) ? clamp01(1 - (maxLoss - budget) / (2 * budget)) : 0

  // thesis: did the position profit (proxy: realized P&L sign) — weak but real for v1.
  const thesis = outcome.pnl > 0 ? 0.9 : outcome.pnl === 0 ? 0.5 : 0.3

  // R:R: maxGain/maxLoss sanity (premium sellers accept <1; cap reward).
  const maxGainApprox = d.legs.reduce((s, l) => s + (l.side === 'short' ? l.premium : 0) * 100 * l.contracts, 0)
  const rr = Number.isFinite(maxLoss) && maxLoss > 0 ? clamp01(maxGainApprox / maxLoss / 0.5) : 0.3

  // strike/expiry sanity: short premium near 0.20–0.30 delta and 30–45 DTE; long debit with enough DTE.
  let saneCount = 0
  for (const l of d.legs) {
    const dte = l.dteAtEntry ?? 30
    const absDelta = Math.abs(l.deltaAtEntry ?? 0.5)
    if (l.side === 'short') {
      const deltaOk = absDelta >= 0.15 && absDelta <= 0.35
      const dteOk = dte >= 25 && dte <= 50
      if (deltaOk && dteOk) saneCount++
    } else {
      const dteOk = dte >= 20
      const notLotto = absDelta >= 0.2
      if (dteOk && notLotto) saneCount++
    }
  }
  const strikeExpiry = d.legs.length ? saneCount / d.legs.length : 0

  // management: closed near target / rolled / held — reward active defined-risk management.
  const management = d.managed === 'closed-early' ? 1 : d.managed === 'rolled' ? 0.8 : 0.6

  const dimensions: DimensionScore[] = [
    { id: 'thesis', label: 'Thesis fit', weight: 2, score: thesis, note: `Realized ${outcome.pnl >= 0 ? 'gain' : 'loss'}; thesis ${thesis >= 0.7 ? 'played out' : 'did not'}.` },
    { id: 'sizing', label: 'Size by max loss', weight: 2, score: sizing, note: Number.isFinite(maxLoss) ? `Max loss $${Math.round(maxLoss)} vs $${Math.round(budget)} budget.` : 'Undefined max loss — cannot size.' },
    { id: 'defined-risk', label: 'Defined max loss', weight: 2, score: definedRisk, note: definedRisk ? 'Loss is capped.' : 'Naked leg — unbounded loss.' },
    { id: 'rr', label: 'Reward : risk', weight: 1, score: rr, note: `Credit/Debit vs max loss.` },
    { id: 'strike-expiry', label: 'Strike/expiry sanity', weight: 2, score: strikeExpiry, note: `${saneCount}/${d.legs.length} legs in sane delta/DTE bands.` },
    { id: 'management', label: 'Management', weight: 2, score: management, note: `Managed: ${d.managed ?? 'hold'}.` },
  ]
  const total = weightedTotal(dimensions)
  const money = outcome.pnl > 0 ? `+$${Math.round(outcome.pnl)}` : outcome.pnl < 0 ? `−$${Math.abs(Math.round(outcome.pnl))}` : '$0'
  return {
    total,
    dimensions,
    pnl: outcome.pnl,
    title: total >= spec.objective.passScore ? `Sound structure · ${money}` : `Risky structure · ${money}`,
    detail: dimensions.map((x) => `${x.label}: ${Math.round(x.score * 100)}% — ${x.note}`).join('  '),
  }
}
```

- [ ] **Step 5: Register `options-v1`**

In `src/practice/rubrics/index.ts`:

```ts
import { optionsRubricV1 } from './options'
export const RUBRICS: Record<string, Rubric> = { noop, 'charts-v1': chartsRubricV1, 'options-v1': optionsRubricV1 }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/practice/rubrics/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/practice/rubrics/options.ts src/practice/rubrics/index.ts src/practice/rubrics/options.test.ts src/practice/types.ts
git commit -m "feat(practice): options-v1 rubric (defined risk, sizing, strike/expiry sanity)"
```

---

## Task 5: Per-track engine abstraction + player refactor

**Files:**
- Create: `src/practice/engines.ts`
- Test: `src/practice/engines.test.ts`
- Modify: `src/practice/ScenarioPlayer.tsx`, `src/pages/ScenarioPlayerPage.tsx`

**Interfaces:**
- Consumes: `loadCandles`, `loadChain`, `resolveChartTrade`, `resolveOptionsPosition`, `contractsForExpiry`, scene kinds.
- Produces: `TrackEngine<Data>`, `ENGINES` (`charts`, `options`; `market-making` added M5), `getEngine(track)`.

- [ ] **Step 1: Write the engine module**

```ts
// src/practice/engines.ts
import type { Candle } from '../data/candles'
import type { Decision, ScenarioOutcome, ScenarioSpec, Track } from './types'
import { loadCandles } from './corpus'
import { loadChain, type ChainSnapshot } from './chain'
import { resolveChartTrade } from './resolve/charts'
import { resolveOptionsPosition } from './resolve/options'

export interface TrackEngine<Data> {
  sceneKind: string
  loadData: (spec: ScenarioSpec) => Promise<Data>
  sceneParams: (spec: ScenarioSpec, data: Data) => Record<string, unknown>
  resolve: (spec: ScenarioSpec, data: Data, decision: Decision) => ScenarioOutcome
}

const chartsEngine: TrackEngine<Candle[]> = {
  sceneKind: 'chart-trade',
  loadData: (spec) => loadCandles(spec.dataRef),
  sceneParams: (spec, candles) => {
    const splitIndex = spec.dataRef.splitIndex ?? Math.floor(candles.length * 0.6)
    return { candles, splitIndex, entry: candles[splitIndex].c, constraints: spec.constraints }
  },
  resolve: (spec, candles, decision) => resolveChartTrade(candles, decision as never, spec.dataRef),
}

interface OptionsData {
  snapshot: ChainSnapshot
  underlying: Candle[]
}

const optionsEngine: TrackEngine<OptionsData> = {
  sceneKind: 'options-build',
  loadData: async (spec) => {
    const snapshot = await loadChain(spec.dataRef.chainAsset!)
    const underlying = await loadCandles({ ohlcAsset: `data/ohlc/${snapshot.meta.symbol}__1d.json` })
    return { snapshot, underlying }
  },
  sceneParams: (spec, data) => ({ snapshot: data.snapshot, constraints: spec.constraints }),
  resolve: (spec, data, decision) =>
    resolveOptionsPosition(
      data.underlying,
      spec.dataRef.decisionDate ?? data.snapshot.meta.date,
      decision as never,
      { ivByLeg: (decision as { legs?: Array<{ K: number; expiry: string; type: string }> }).legs?.map(() => 0.3) },
    ),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ENGINES: Record<Track, TrackEngine<any>> = {
  charts: chartsEngine,
  options: optionsEngine,
  'market-making': chartsEngine, // placeholder until M5 (never selected: no MM specs yet)
}

export function getEngine(track: Track): TrackEngine<unknown> {
  return ENGINES[track]
}
```

> NOTE: replace the `ivByLeg: () => 0.3` placeholder with the real per-leg IV looked up from the snapshot via `findContract(snapshot, leg.expiry, leg.K, leg.type==='call'?'C':'P')?.iv` once the decision shape is in hand; the scene already has these contracts, so prefer passing IV through the decision/legs. Do NOT ship the 0.3 default to production — it's only a typing convenience here.

- [ ] **Step 2: Write the engine test**

```ts
// src/practice/engines.test.ts
import { describe, it, expect } from 'vitest'
import { getEngine, ENGINES } from './engines'

describe('track engines', () => {
  it('exposes an engine per track with a sceneKind + resolve', () => {
    for (const track of ['charts', 'options', 'market-making'] as const) {
      const e = getEngine(track)
      expect(typeof e.sceneKind).toBe('string')
      expect(typeof e.resolve).toBe('function')
      expect(typeof e.loadData).toBe('function')
    }
  })
  it('charts engine targets chart-trade; options engine targets options-build', () => {
    expect(ENGINES.charts.sceneKind).toBe('chart-trade')
    expect(ENGINES.options.sceneKind).toBe('options-build')
  })
})
```

- [ ] **Step 3: Refactor `ScenarioPlayer.tsx` to dispatch via the engine**

Change `ScenarioPlayer` to accept `data: unknown` (loaded by the page) and use the engine:

```tsx
// src/practice/ScenarioPlayer.tsx — key changes
import { getEngine } from './engines'
import { resolvePracticeScene } from './scenes'
// props now: { spec: ScenarioSpec; data: unknown }
export default function ScenarioPlayer({ spec, data }: { spec: ScenarioSpec; data: unknown }) {
  const engine = getEngine(spec.track)
  const scene = resolvePracticeScene(engine.sceneKind)!
  const canvas = useMemo(
    () => <PhaserCanvas scene={scene} bus={bus} params={engine.sceneParams(spec, data)} />,
    [scene, bus, engine, spec, data],
  )
  // ...on decision:
  const onJournal = (entry) => {
    const decision = decisionRef.current as Decision
    const outcome = engine.resolve(spec, data, decision)
    const score = getRubric(spec.rubricId)(spec, decision, outcome)
    setResult({ outcome, score }); setPhase('resolved')
  }
  // Add a "model estimate · IV real" label under P&L when outcome.facts.modelEstimate is true.
  // (rest of the lifecycle from M1 is unchanged)
}
```

- [ ] **Step 4: Refactor `ScenarioPlayerPage.tsx` to load via the engine**

```tsx
// src/pages/ScenarioPlayerPage.tsx — key changes
import { getEngine } from '../practice/engines'
const spec = specId ? getScenario(specId) : undefined
const [data, setData] = useState<unknown>(null)
useEffect(() => {
  if (!spec) { navigate('/practice', { replace: true }); return }
  let active = true
  getEngine(spec.track).loadData(spec)
    .then((d) => active && setData(d))
    .catch((e) => { console.error(e); if (active) navigate('/practice', { replace: true }) })
  return () => { active = false }
}, [spec, navigate])
// render <ScenarioPlayer spec={spec} data={data} /> once data loaded
```

- [ ] **Step 5: Verify engine test + typecheck**

Run: `npx vitest run src/practice/engines.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/practice/engines.ts src/practice/engines.test.ts src/practice/ScenarioPlayer.tsx src/pages/ScenarioPlayerPage.tsx
git commit -m "refactor(practice): per-track engine dispatch (charts + options)"
```

---

## Task 6: OptionsBuildScene

**Files:**
- Create: `src/practice/scenes/OptionsBuildScene.ts`
- Modify: `src/practice/scenes/index.ts` (register `options-build`)
- Test: extend `src/practice/scenes/index.test.ts`

**Interfaces:**
- Consumes: `ModuleScene` helpers; `ChainSnapshot`, `contractsForExpiry`, `findContract`, `dteDays`; `combinedPnL`, `breakevens`, `MULTIPLIER` from payoffMath; `bsPrice` for the "today" curve.
- Params: `{ snapshot: ChainSnapshot; constraints }`. Emits `decision` payload `{ legs: OptionLegDecision[], managed }` and live `nudge`s (`undefined-risk`, `sizing`).

The scene lets the learner: pick an expiry, add up to ~2 legs (cycle strike via a slider over the real strike grid, toggle call/put + long/short, set contracts), then choose manage = hold/close-early/roll. It draws the combined payoff curve at expiry (exact, `combinedPnL`) AND a dashed "today" curve (`bsPrice` from real IV, labelled "model · IV real"). Every leg's `premium`, `deltaAtEntry`, `dteAtEntry` are pulled from the snapshot (never invented). On Submit it emits the structured decision.

**Testing note:** wiring smoke test only (phaser mocked), per the codebase convention; payoff math is covered by `payoffMath` + the resolver tests.

- [ ] **Step 1: Write the scene**

```ts
// src/practice/scenes/OptionsBuildScene.ts
import { ModuleScene } from '../../engine/ModuleScene'
import { C } from '../../engine/palette'
import { combinedPnL, breakevens, MULTIPLIER, type Leg } from '../../lessons/volatility/scenes/payoffMath'
import { bsPrice } from '../resolve/bs'
import { contractsForExpiry, dteDays, findContract, type ChainSnapshot } from '../chain'

interface OptionsBuildParams {
  snapshot: ChainSnapshot
  constraints: { accountBalance: number; maxRiskPct: number; requireDefinedRisk?: boolean }
}

interface BuiltLeg extends Leg {
  expiry: string
  contracts: number
  deltaAtEntry: number
  dteAtEntry: number
}

export default class OptionsBuildScene extends ModuleScene {
  private snap!: ChainSnapshot
  private expiry = ''
  private legs: BuiltLeg[] = []
  private managed: 'hold' | 'closed-early' | 'rolled' = 'hold'
  private plot = { l: 60, r: 700, t: 40, b: 360 }

  protected build(): void {
    const p = this.params as unknown as OptionsBuildParams
    this.snap = p.snapshot
    this.expiry = this.snap.meta.expirations[0]

    this.label(12, 16, 'P/L today: model estimate · IV real. Expiry P/L: exact.', { size: this.fs(11), col: C.muted })
    this.buildExpiryPicker()
    this.buildStrikeControls()
    this.buildManageToggle()
    this.redrawPayoff()
    this.setCanSubmit(true)
    this.emitReady()
  }

  // -- controls (expiry picker, strike slider over the REAL grid, call/put, long/short,
  //    contracts, add-leg). Each control reads premiums/greeks from the snapshot via
  //    findContract; nothing is invented. Implement with ModuleScene button()/slider(). --
  private buildExpiryPicker(): void {
    let x = 80
    for (const exp of this.snap.meta.expirations) {
      this.button(x, this.plot.t - 14, `${dteDays(this.snap.meta.date, exp)}d`, () => {
        this.expiry = exp
        this.redrawPayoff()
      }, { w: 70, h: 26 })
      x += 80
    }
  }

  private strikesForExpiry(): number[] {
    return [...new Set(contractsForExpiry(this.snap, this.expiry).map((r) => r.strike))].sort((a, b) => a - b)
  }

  private buildStrikeControls(): void {
    // Implement: a strike slider over strikesForExpiry(), call/put + long/short toggles,
    // a contracts slider (1..10), and an "Add leg" button that appends the selected
    // contract (premium=mid, deltaAtEntry=delta, dteAtEntry=dte) to this.legs, then
    // calls redrawPayoff() + fireNudges(). Keep to <=2 legs for v1.
  }

  private buildManageToggle(): void {
    let x = 80
    for (const m of ['hold', 'closed-early', 'rolled'] as const) {
      this.button(x, this.plot.b + 30, m, () => { this.managed = m }, { w: 110, h: 26 })
      x += 120
    }
  }

  private legsAsPlain(): Leg[] {
    return this.legs.map((l) => ({ type: l.type, side: l.side, K: l.K, premium: l.premium }))
  }

  private fireNudges(): void {
    // undefined-risk: any naked short call (a short call with no covering long call above it).
    const shortCalls = this.legs.filter((l) => l.type === 'call' && l.side === 'short')
    const longCalls = this.legs.filter((l) => l.type === 'call' && l.side === 'long')
    if (shortCalls.some((sc) => !longCalls.some((lc) => lc.K > sc.K))) this.emitNudge('undefined-risk')
  }

  private yForPnl(pnl: number, lo: number, hi: number): number {
    const t = (pnl - lo) / (hi - lo)
    return this.plot.b - t * (this.plot.b - this.plot.t)
  }

  private redrawPayoff(): void {
    // Draw the exact expiry payoff (combinedPnL × MULTIPLIER × contracts) across a strike
    // grid around spot, plus a dashed "today" curve via bsPrice(real IV). Mark breakevens.
    // (Full drawing mirrors PayoffScene; implement with this.add.graphics + label.)
  }

  protected onSubmit(): void {
    this.emitDecision({
      legs: this.legs.map((l) => ({
        type: l.type, side: l.side, K: l.K, expiry: l.expiry, premium: l.premium,
        contracts: l.contracts, deltaAtEntry: l.deltaAtEntry, dteAtEntry: l.dteAtEntry,
      })),
      managed: this.managed,
    })
  }
}
```

> NOTE for the implementer: the three method bodies marked with comments (`buildStrikeControls`, `redrawPayoff`, and the leg-add wiring) are REQUIRED, not optional. Build them with `ModuleScene` `slider()`/`button()` and the `combinedPnL`/`bsPrice` math named above; pull every premium/delta from `findContract`. Verify by building a put credit spread and confirming the emitted `decision` legs carry real `premium`/`deltaAtEntry`/`dteAtEntry` from the snapshot.

- [ ] **Step 2: Register `options-build` + extend the wiring test**

In `src/practice/scenes/index.ts`:

```ts
import OptionsBuildScene from './OptionsBuildScene'
export const PRACTICE_SCENES: Record<string, SceneCtor> = {
  'chart-trade': ChartTradeScene as unknown as SceneCtor,
  'options-build': OptionsBuildScene as unknown as SceneCtor,
}
```

Add to `src/practice/scenes/index.test.ts`:

```ts
  it('registers the options-build scene', () => {
    expect(typeof PRACTICE_SCENES['options-build']).toBe('function')
  })
```

- [ ] **Step 3: Run the wiring test**

Run: `npx vitest run src/practice/scenes/index.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/practice/scenes/OptionsBuildScene.ts src/practice/scenes/index.ts src/practice/scenes/index.test.ts
git commit -m "feat(practice): OptionsBuildScene (real chain → live payoff → decision)"
```

---

## Task 7: Curated options catalog + Practice page enablement

**Files:**
- Modify: `src/practice/scenarioRegistry.ts` (add ≥8 options specs)
- (Practice page already enables a track card when `nextScenario(track)` is non-empty from M1.)

**Interfaces:**
- Produces: ≥8 validated `options` specs across tiers 1–3 referencing real `chainAsset` snapshots (verify each path exists under `public/data/options/` and the date is in `options-manifest.json`).

- [ ] **Step 1: Add curated options scenarios**

In `src/practice/scenarioRegistry.ts`, add (verify each `chainAsset` file exists; symbols from the manifest, e.g. DIS, JPM, AAPL, MSFT, KO, BAC, …):

```ts
function optionsSpec(id: string, tier: number, chainAsset: string, decisionDate: string, brief: string): import('./types').ScenarioSpec {
  return {
    id, track: 'options', tier,
    title: 'Build a defined-risk position',
    brief,
    dataRef: { chainAsset, decisionDate },
    objective: { kind: 'process', passScore: 70 },
    constraints: { accountBalance: 10000, maxRiskPct: 5, requireDefinedRisk: true },
    rubricId: 'options-v1',
    nudges: [{ id: 'undefined-risk' }, { id: 'sizing' }],
    coachContextKeys: ['sExpiry', 'modelEstimate'],
    illustrativeFlags: ['plToday'],
    source: 'curated',
  }
}

// append to SCENARIOS (≥8 across tiers 1–3):
SCENARIOS.push(
  optionsSpec('opt-t1-01', 1, 'data/options/DIS__2021-02-17.json', '2021-02-17', 'You are mildly bullish DIS into spring. Build a defined-risk position that profits if it holds up.'),
  // ... ≥8 total; vary symbol/date/tier; tier 2–3 imply multi-leg / tighter management.
)
```

> The implementer MUST confirm each `chainAsset` path exists (it is served from `public/`) and the date appears in `options-manifest.json`. The M0 `scenarioRegistry.test.ts` validator contract fails the build on any malformed spec; note the validator's corpus-asset check is a string-shape match (`data/options/*.json`) in M0 — the live fetch happens in the player, so also smoke-test each in the dev server.

- [ ] **Step 2: Run registry contract + typecheck**

Run: `npx vitest run src/practice/scenarioRegistry.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/practice/scenarioRegistry.ts
git commit -m "feat(practice): curated options catalog (tiers 1–3, real chain snapshots)"
```

---

## Task 8: M2 exit check

**Files:** (none — verification)

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 2: Manual exit criteria (PRDphase2 §17 M2 row)**

Run: `npm run dev`, `/practice` → Options card → Start. Verify:
1. The real chain loads; expiry buttons show real DTEs; strikes come from the real grid; premiums shown match the snapshot mids.
2. Building a multi-leg position redraws the **expiry payoff** (exact) and a dashed **"today" curve** labelled "model · IV real".
3. A naked short call fires the `undefined-risk` nudge; an oversized position fires `sizing`.
4. Submit → journal → resolve: a held-to-expiry position books **exact** P&L from the real underlying close; a closed-early position books a **labelled** BS value.
5. The options rubric breakdown shows defined-risk/sizing/strike-expiry; balance + options skill/tier update and persist on reload.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(practice): M2 Track C options green (build→resolve→grade)"
```

---

## Self-Review

**1. Spec coverage (PRDphase2 §7.4, §10 options column, §12 labelling, §17 M2):** Real chain snapshots + multi-leg build → chain loader + OptionsBuildScene. Reuse `payoffMath`/`optionMath` → resolver + scene. Exact expiry P&L + defined-risk + sizing-by-max-loss + strike/expiry sanity + management → options-v1. IV/theta "today vs expiry" curve → bsPrice + scene (labelled). Engine refactor keeps the M1 lifecycle (nudges/journal/debrief) intact for options. ✓

**2. Placeholder scan:** The three scene method bodies and the engine `ivByLeg` convenience are explicitly flagged as REQUIRED work with the exact APIs to use and a verification step — not silent TBDs. The `market-making` engine slot points at a real (charts) engine purely so the `Record<Track,...>` typechecks before M5; it is never selected because no MM specs exist until M5. ✓

**3. Type consistency:** `OptionsDecision`/`OptionLegDecision` (with `deltaAtEntry`/`dteAtEntry`) consistent across scene emit, engine resolve, resolver, and rubric. `ChainSnapshot`/`ContractRow` match the verified on-disk JSON. `resolveOptionsPosition(underlying, snapshotDate, decision, opts)` matches its call in `engines.ts`. `getRubric('options-v1')` matches Task 4 registration. `ENGINES[track]` matches the player dispatch. ✓

**Carried interfaces M3+ rely on:** `getEngine`/`ENGINES`/`TrackEngine`, `loadChain`/`findContract`/`dteDays`, `resolveOptionsPosition`/`combinedExpiryMaxLoss`, `bsPrice`, `optionsRubricV1`, the `optionsSpec` catalog pattern, `illustrativeFlags` usage.
