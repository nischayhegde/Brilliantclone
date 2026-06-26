# Practice Mode — M1: Track A (Chart-Pattern Trading) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first fully-playable track — the learner trades a real historical chart window (take/skip → direction/size/stop/target → manage), the outcome resolves deterministically over real OHLC, a pure rubric grades *process*, decision-point nudges fire, a journal is required, and a (curated) debrief explains the score — all wired into the M0 account/persistence shell.

**Architecture:** Keep market truth + grading in pure, unit-tested modules: a corpus loader (`corpus.ts`) turns bundled `CANDLES` or `public/data/ohlc/*` assets into `Candle[]`; `resolve/charts.ts` replays the hidden candles into a `ScenarioOutcome` with honest fills; `rubrics/charts.ts` grades the decision+outcome. A new `ChartTradeScene` only collects the learner's inputs and emits a structured `decision` over the bus; a React `ScenarioPlayer` orchestrates mount → nudges → resolve → grade → journal → debrief → `applyResult`.

**Tech Stack:** Same as M0. Reuses `ModuleScene` helpers, `PhaserCanvas`, `SceneBus`, the `CandleChartScene` drawing patterns, and `src/data/candles.ts` + the ingested OHLC corpus.

## Global Constraints

- (All M0 Global Constraints apply.) `npm run typecheck` + `npm test` green at every commit.
- **No traded number from an LLM.** The debrief in M1 is curated/templated prose built from real outcome facts; the LLM coach lands in M3.
- **Honest fills (PRDphase2 §12):** a stop/target that gaps is filled at the **bar's open through the level**, not the level; spread + per-share fee always applied. The same pure resolver drives both the scene's reveal animation and the graded score (single source of truth).
- **Grade process, not P&L (PRDphase2 §10):** a profitable but unsized/stopless trade must score low; a sound, well-managed loss scores well.
- **Corpus is a runtime asset:** OHLC JSON lives under `public/data/ohlc/` (served, not bundled). The loader fetches it on demand and caches in-memory.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/bus.ts` (modify) | Add generic `decision` + `nudge` events (no engine→practice type coupling). |
| `src/practice/corpus.ts` (+ `.test.ts`) | `loadCandles(dataRef)`: bundled `CANDLES[key]` or fetch+decode an `ohlcAsset` (columnar→`Candle[]`), in-memory cache. |
| `src/practice/resolve/charts.ts` (+ `.test.ts`) | `resolveChartTrade(candles, decision, dataRef, frictions)` → `ScenarioOutcome` (honest fills). |
| `src/practice/rubrics/charts.ts` (+ `.test.ts`) | `chartsRubricV1` (registered `charts-v1`): read, sizing, stop, R:R, management. |
| `src/practice/scenes/ChartTradeScene.ts` | Phaser scene: candles to split, draggable TP/SL, size slider, take/skip toggle; emits `decision` + live `nudge`s. |
| `src/practice/scenes/index.ts` (+ `.test.ts`) | Practice scene registry (`kind`→ctor), wiring smoke test (phaser mocked). |
| `src/practice/debrief.ts` (+ `.test.ts`) | `curatedDebrief(spec, decision, outcome, score)` → prose (LLM replaces in M3). |
| `src/practice/ScenarioPlayer.tsx` | Orchestrates the scenario lifecycle (mount→nudge→resolve→grade→journal→debrief). |
| `src/practice/Journal.tsx` | Required one-line rationale + feeling tag before grading. |
| `src/pages/ScenarioPlayerPage.tsx` (new) | Route target `/practice/play/:specId`; loads spec + candles, renders `ScenarioPlayer`. |
| `src/App.tsx` (modify) | Add `/practice/play/:specId`. |
| `src/pages/PracticePage.tsx` (modify) | Track cards → "Start scenario" → navigate to the player. |
| `src/practice/scenarioRegistry.ts` (modify) | Add ≥10 curated charts specs across tiers 1–3 referencing real data. |

---

## Task 1: Extend the bus with `decision` + `nudge` events

**Files:**
- Modify: `src/engine/bus.ts`

**Interfaces:**
- Produces: two new `SceneEvent` variants — `{ type: 'decision'; payload: Record<string, unknown> }` and `{ type: 'nudge'; id: string }`. Generic payload keeps `engine/` decoupled from `practice/` types.

- [ ] **Step 1: Add the events**

In `src/engine/bus.ts`, extend the `SceneEvent` union (after the `result` variant):

```ts
  // scene -> React: the graded outcome (shown as a banner + explanation).
  | { type: 'result'; correct: boolean; title: string; detail: string }
  // --- Practice mode ---
  // scene -> React: the learner's structured decision (cast to a Decision by the player).
  | { type: 'decision'; payload: Record<string, unknown> }
  // scene -> React: a decision-point nudge id fired live as the learner sets up.
  | { type: 'nudge'; id: string }
```

Also extend `ModuleScene` helpers so scenes can emit them. In `src/engine/ModuleScene.ts`, after `readout(...)`:

```ts
  /** Practice: emit the learner's structured decision (payload is cast by the player). */
  protected emitDecision(payload: Record<string, unknown>): void {
    this.bus.emit({ type: 'decision', payload })
  }
  /** Practice: fire a decision-point nudge by id. */
  protected emitNudge(id: string): void {
    this.bus.emit({ type: 'nudge', id })
  }
```

- [ ] **Step 2: Verify typecheck + existing tests still pass**

Run: `npm run typecheck && npx vitest run src/lessons/registry.test.ts`
Expected: PASS (additive union variants don't break existing handlers — they ignore unknown types).

- [ ] **Step 3: Commit**

```bash
git add src/engine/bus.ts src/engine/ModuleScene.ts
git commit -m "feat(practice): bus decision/nudge events + ModuleScene emitters"
```

---

## Task 2: Corpus loader

**Files:**
- Create: `src/practice/corpus.ts`
- Test: `src/practice/corpus.test.ts`

**Interfaces:**
- Consumes: `CANDLES`, `Candle` from `../data/candles`; `DataRef` from `./types`.
- Produces: `loadCandles(dataRef) → Promise<Candle[]>`, `decodeColumnarOhlc(json) → Candle[]`, `__clearCorpusCache()` (test helper).

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/corpus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decodeColumnarOhlc, loadCandles, __clearCorpusCache } from './corpus'

beforeEach(() => __clearCorpusCache())

describe('decodeColumnarOhlc', () => {
  it('maps columnar arrays to Candle[] {t,o,h,l,c}', () => {
    const json = { meta: { ticker: 'AAPL' }, t: [1, 2], o: [10, 11], h: [12, 13], l: [9, 10], c: [11, 12], v: [100, 200] }
    expect(decodeColumnarOhlc(json)).toEqual([
      { t: 1, o: 10, h: 12, l: 9, c: 11 },
      { t: 2, o: 11, h: 13, l: 10, c: 12 },
    ])
  })
})

describe('loadCandles', () => {
  it('returns bundled candles synchronously-resolved for a candlesKey', async () => {
    const key = Object.keys((await import('../data/candles')).CANDLES)[0]
    const out = await loadCandles({ candlesKey: key })
    expect(out.length).toBeGreaterThan(0)
    expect(out[0]).toHaveProperty('c')
  })

  it('fetches + decodes an ohlcAsset and caches it (one fetch for two loads)', async () => {
    const fakeJson = { t: [1], o: [1], h: [1], l: [1], c: [1], v: [1] }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson })
    vi.stubGlobal('fetch', fetchMock)
    const a = await loadCandles({ ohlcAsset: 'data/ohlc/AAPL__1d.json' })
    const b = await loadCandles({ ohlcAsset: 'data/ohlc/AAPL__1d.json' })
    expect(a).toEqual(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('throws a clear error when neither ref is present', async () => {
    await expect(loadCandles({})).rejects.toThrow(/candlesKey or ohlcAsset/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/corpus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/corpus.ts
import { CANDLES, type Candle } from '../data/candles'
import type { DataRef } from './types'

interface ColumnarOhlc {
  t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v?: number[]
}

export function decodeColumnarOhlc(json: ColumnarOhlc): Candle[] {
  const out: Candle[] = []
  for (let i = 0; i < json.t.length; i++) {
    out.push({ t: json.t[i], o: json.o[i], h: json.h[i], l: json.l[i], c: json.c[i] })
  }
  return out
}

const cache = new Map<string, Candle[]>()
export function __clearCorpusCache(): void {
  cache.clear()
}

/** Bundled CANDLES by key, or fetch+decode a public/data/ohlc asset (cached). */
export async function loadCandles(ref: DataRef): Promise<Candle[]> {
  if (ref.candlesKey) {
    const c = CANDLES[ref.candlesKey]
    if (!c) throw new Error(`Unknown candlesKey: ${ref.candlesKey}`)
    return c
  }
  if (ref.ohlcAsset) {
    const cached = cache.get(ref.ohlcAsset)
    if (cached) return cached
    const res = await fetch(`/${ref.ohlcAsset}`)
    if (!res.ok) throw new Error(`Failed to load ${ref.ohlcAsset}: HTTP ${res.status}`)
    const decoded = decodeColumnarOhlc((await res.json()) as ColumnarOhlc)
    cache.set(ref.ohlcAsset, decoded)
    return decoded
  }
  throw new Error('dataRef needs a candlesKey or ohlcAsset')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/corpus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/corpus.ts src/practice/corpus.test.ts
git commit -m "feat(practice): OHLC corpus loader (bundled + fetched assets, cached)"
```

---

## Task 3: Pure chart-trade resolver (honest fills)

**Files:**
- Create: `src/practice/resolve/charts.ts`
- Test: `src/practice/resolve/charts.test.ts`

**Interfaces:**
- Consumes: `Candle` from `../../data/candles`; `ChartsDecision`, `DataRef`, `ScenarioOutcome` from `../types`.
- Produces: `resolveChartTrade(candles, decision, ref, frictions?) → ScenarioOutcome`, `DEFAULT_FRICTIONS = { feePerShare: 0.005, spreadFrac: 0.0005 }`.

Resolver rules: simulate from `ref.splitIndex` to `ref.revealToIndex`. Entry = `decision.entry ?? candles[splitIndex].c`, adjusted by half-spread against the learner. Within each bar, **stop is checked before target** (conservative); a level that gaps (bar open already beyond it) fills at the **open**, else at the level. Per-share fee applied on entry and exit. `facts`: `{ took, hit, exit, exitIndex, netMove }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/resolve/charts.test.ts
import { describe, it, expect } from 'vitest'
import { resolveChartTrade, DEFAULT_FRICTIONS } from './charts'
import type { Candle } from '../../data/candles'
import type { ChartsDecision } from '../types'

// candles: index 0..3. Split at 1 (decide on close of idx 1 = 100). Reveal to 4.
const candles: Candle[] = [
  { t: 0, o: 98, h: 101, l: 97, c: 100 },
  { t: 1, o: 100, h: 102, l: 99, c: 100 }, // split index 1
  { t: 2, o: 101, h: 106, l: 100, c: 105 }, // hits a TP at 105
  { t: 3, o: 105, h: 107, l: 95, c: 96 }, // would hit SL 97 here
]
const ref = { splitIndex: 1, revealToIndex: 4 }

describe('resolveChartTrade', () => {
  it('fills a long take-profit before a later stop, P&L net of fees', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, target: 105, stop: 97, shares: 100 }
    const out = resolveChartTrade(candles, d, ref, { feePerShare: 0, spreadFrac: 0 })
    expect(out.facts.hit).toBe('tp')
    expect(out.facts.exit).toBe(105)
    expect(out.pnl).toBe(500) // (105-100)*100
  })

  it('honest fill: a gap THROUGH the stop fills at the bar open, not the level', () => {
    // Long, stop 97; bar idx3 opens 105 then craters; low 95 ≤ 97 → stop hit, fill at min(level, open)=97 (no gap down through at open here)
    const gap: Candle[] = [
      { t: 0, o: 98, h: 101, l: 97, c: 100 },
      { t: 1, o: 100, h: 101, l: 99, c: 100 },
      { t: 2, o: 90, h: 92, l: 88, c: 89 }, // GAPS DOWN: opens 90, already below stop 97
    ]
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, target: 110, stop: 97, shares: 100 }
    const out = resolveChartTrade(gap, d, { splitIndex: 1, revealToIndex: 3 }, { feePerShare: 0, spreadFrac: 0 })
    expect(out.facts.hit).toBe('sl')
    expect(out.facts.exit).toBe(90) // filled at the open, worse than the 97 level
    expect(out.pnl).toBe(-1000)
  })

  it('a skip yields zero P&L and records the net move for grading', () => {
    const d: ChartsDecision = { took: false }
    const out = resolveChartTrade(candles, d, ref, { feePerShare: 0, spreadFrac: 0 })
    expect(out.pnl).toBe(0)
    expect(out.facts.took).toBe(false)
    expect(out.facts.netMove).toBe(candles[3].c - candles[1].c) // -4
  })

  it('applies fees + spread against the learner by default', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, target: 105, stop: 97, shares: 100 }
    const out = resolveChartTrade(candles, d, ref, DEFAULT_FRICTIONS)
    expect(out.pnl).toBeLessThan(500) // frictions shave the gross
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/resolve/charts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/resolve/charts.ts
import type { Candle } from '../../data/candles'
import type { ChartsDecision, DataRef, ScenarioOutcome } from '../types'

export interface Frictions {
  /** Per-share commission applied on entry and exit. */
  feePerShare: number
  /** Half-spread as a fraction of price, applied against the learner on each side. */
  spreadFrac: number
}
export const DEFAULT_FRICTIONS: Frictions = { feePerShare: 0.005, spreadFrac: 0.0005 }

/** Deterministic replay of the hidden candles into a graded outcome. Honest fills. */
export function resolveChartTrade(
  candles: Candle[],
  decision: ChartsDecision,
  ref: DataRef,
  frictions: Frictions = DEFAULT_FRICTIONS,
): ScenarioOutcome {
  const split = ref.splitIndex ?? Math.floor(candles.length * 0.6)
  const end = Math.min(ref.revealToIndex ?? candles.length, candles.length)
  const netMove = candles[end - 1].c - candles[split].c

  if (!decision.took) {
    return { pnl: 0, facts: { took: false, hit: 'none', netMove } }
  }

  const long = decision.direction !== 'short'
  const shares = decision.shares ?? 100
  const rawEntry = decision.entry ?? candles[split].c
  // Spread costs the learner: buy a touch higher, sell a touch lower.
  const entry = long ? rawEntry * (1 + frictions.spreadFrac) : rawEntry * (1 - frictions.spreadFrac)
  const tp = decision.target
  const sl = decision.stop

  let exit = candles[end - 1].c
  let hit: 'tp' | 'sl' | 'end' = 'end'
  let exitIndex = end - 1

  for (let i = split + 1; i < end; i++) {
    const c = candles[i]
    // Stop first (conservative). Gap THROUGH the level fills at the open, not the level.
    if (sl !== undefined) {
      if (long && c.l <= sl) {
        exit = Math.min(sl, c.o) // gap down → open is worse than the level
        hit = 'sl'; exitIndex = i; break
      }
      if (!long && c.h >= sl) {
        exit = Math.max(sl, c.o)
        hit = 'sl'; exitIndex = i; break
      }
    }
    if (tp !== undefined) {
      if (long && c.h >= tp) {
        exit = Math.max(tp, c.o) // gap up in your favour → fill at the better open
        hit = 'tp'; exitIndex = i; break
      }
      if (!long && c.l <= tp) {
        exit = Math.min(tp, c.o)
        hit = 'tp'; exitIndex = i; break
      }
    }
  }
  // Honour an early managed exit if it precedes the natural exit.
  if (decision.managedExitIndex !== undefined && decision.managedExitIndex < exitIndex) {
    exitIndex = decision.managedExitIndex
    exit = candles[exitIndex].c
    hit = 'end'
  }

  const exitFilled = long ? exit * (1 - frictions.spreadFrac) : exit * (1 + frictions.spreadFrac)
  const perShare = long ? exitFilled - entry : entry - exitFilled
  const pnl = Math.round((perShare * shares - frictions.feePerShare * shares * 2) * 100) / 100

  return { pnl, facts: { took: true, hit, exit: Math.round(exit * 100) / 100, exitIndex, netMove } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/resolve/charts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/resolve/charts.ts src/practice/resolve/charts.test.ts
git commit -m "feat(practice): pure chart-trade resolver with honest gap fills"
```

---

## Task 4: Charts process rubric (`charts-v1`)

**Files:**
- Create: `src/practice/rubrics/charts.ts`
- Modify: `src/practice/rubrics/index.ts` (register `charts-v1`)
- Test: `src/practice/rubrics/charts.test.ts`

**Interfaces:**
- Consumes: `Rubric`, `ChartsDecision`, `DimensionScore` from `../types`; `weightedTotal` from `./index`.
- Produces: `chartsRubricV1: Rubric`; registered as `RUBRICS['charts-v1']`.

Dimensions (PRDphase2 §10.1) and scoring (each 0..1):
- `read` (weight 2): took & direction agreed with `netMove` sign, OR skipped when `|netMove|` is small relative to entry (≤1%).
- `sizing` (weight 2): `risk$ = |entry-stop|·shares`; full marks ≤ `maxRiskPct%`, linearly to 0 at 3× that.
- `stop` (weight 2): stop present AND on the correct side of entry → 1; else 0.
- `rr` (weight 1): `(|target-entry|)/(|entry-stop|)` ÷ `minRewardRisk`, clamped 0..1.
- `management` (weight 1): held to plan → 1; a sensible early exit that cut a loss → 0.7; whipsaw exit → 0.4.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/rubrics/charts.test.ts
import { describe, it, expect } from 'vitest'
import { chartsRubricV1 } from './charts'
import type { ScenarioSpec, ChartsDecision, ScenarioOutcome } from '../types'

const spec = (over: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id: 's', track: 'charts', tier: 1, title: 't', brief: 'b',
  dataRef: { candlesKey: 'x', splitIndex: 1, revealToIndex: 4 },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 2 },
  rubricId: 'charts-v1', nudges: [], coachContextKeys: [], source: 'curated', ...over,
})
const out = (over: Partial<ScenarioOutcome> = {}): ScenarioOutcome => ({ pnl: 0, facts: { took: true, hit: 'tp', netMove: 5 }, ...over })

describe('chartsRubricV1', () => {
  it('scores a sound, well-sized, stopped, good-R:R, correct-read trade highly', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 99, target: 103, shares: 100 }
    const r = chartsRubricV1(spec(), d, out({ pnl: 300 }))
    expect(r.total).toBeGreaterThanOrEqual(85)
  })

  it('scores a PROFITABLE but oversized, stopless trade LOW (process, not P&L)', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, shares: 5000 } // no stop, 50% risk-ish
    const r = chartsRubricV1(spec(), d, out({ pnl: 4000 }))
    expect(r.total).toBeLessThan(50)
    expect(r.dimensions.find((x) => x.id === 'stop')!.score).toBe(0)
  })

  it('rewards a disciplined SKIP when the move was small/whipsaw', () => {
    const d: ChartsDecision = { took: false }
    const r = chartsRubricV1(spec(), d, out({ took: false, pnl: 0, facts: { took: false, hit: 'none', netMove: 0.3 } }))
    expect(r.dimensions.find((x) => x.id === 'read')!.score).toBeGreaterThan(0.7)
  })

  it('reports pnl through unchanged from the outcome', () => {
    const d: ChartsDecision = { took: true, direction: 'long', entry: 100, stop: 99, target: 103, shares: 100 }
    expect(chartsRubricV1(spec(), d, out({ pnl: 123 })).pnl).toBe(123)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/rubrics/charts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/rubrics/charts.ts
import type { ChartsDecision, DimensionScore, Rubric } from '../types'
import { weightedTotal } from './index'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export const chartsRubricV1: Rubric = (spec, decisionRaw, outcome) => {
  const d = decisionRaw as ChartsDecision
  const { accountBalance, maxRiskPct, minRewardRisk = 1.5 } = spec.constraints
  const netMove = Number(outcome.facts.netMove ?? 0)
  const entry = d.entry ?? 0

  // read: direction agreed with the realized move, or a justified skip.
  let read: number
  let readNote: string
  if (!d.took) {
    const moveFrac = entry ? Math.abs(netMove) / entry : Math.abs(netMove) / 100
    read = moveFrac <= 0.01 ? 0.9 : moveFrac <= 0.03 ? 0.55 : 0.2
    readNote = read >= 0.7 ? 'Sat out a choppy, low-edge move — disciplined.' : 'A tradable move was available; skipping left edge on the table.'
  } else {
    const agreed = (d.direction !== 'short' && netMove > 0) || (d.direction === 'short' && netMove < 0)
    read = agreed ? 1 : 0.2
    readNote = agreed ? 'Direction matched the realized move.' : 'Direction fought the realized move.'
  }

  // sizing: dollar risk vs the budget.
  let sizing = 1
  let sizingNote = 'No size committed.'
  if (d.took) {
    const shares = d.shares ?? 0
    const risk = d.stop !== undefined ? Math.abs(entry - d.stop) * shares : entry * shares // stopless = full exposure
    const budget = (maxRiskPct / 100) * accountBalance
    sizing = clamp01(1 - (risk - budget) / (2 * budget))
    sizingNote = `Risked $${Math.round(risk)} vs a $${Math.round(budget)} budget (${maxRiskPct}% of account).`
  }

  // stop: present and on the correct side of entry.
  const long = d.direction !== 'short'
  const stopOk = d.took && d.stop !== undefined && (long ? d.stop < entry : d.stop > entry)
  const stop = d.took ? (stopOk ? 1 : 0) : 1
  const stopNote = !d.took ? 'No trade — no stop needed.' : stopOk ? 'Stop defined on the correct side of entry.' : 'No (or wrong-side) stop — undefined risk.'

  // reward:risk.
  let rr = 1
  let rrNote = 'No trade — R:R n/a.'
  if (d.took && d.stop !== undefined && d.target !== undefined) {
    const reward = Math.abs(d.target - entry)
    const riskPerShare = Math.abs(entry - d.stop) || 1e-9
    const ratio = reward / riskPerShare
    rr = clamp01(ratio / minRewardRisk)
    rrNote = `Reward:risk ≈ ${ratio.toFixed(2)} (target ${minRewardRisk}).`
  } else if (d.took) {
    rr = 0
    rrNote = 'Missing target or stop — R:R undefined.'
  }

  // management.
  let management = 1
  let mgmtNote = 'Held the plan to resolution.'
  if (d.took && d.managedExitIndex !== undefined) {
    management = outcome.pnl >= 0 ? 0.7 : 0.4
    mgmtNote = outcome.pnl >= 0 ? 'Managed out early, protecting an open gain.' : 'Early exit cut the loss but deviated from plan.'
  }

  const dimensions: DimensionScore[] = [
    { id: 'read', label: 'Correct read', weight: 2, score: read, note: readNote },
    { id: 'sizing', label: 'Position sizing', weight: 2, score: sizing, note: sizingNote },
    { id: 'stop', label: 'Defined max loss', weight: 2, score: stop, note: stopNote },
    { id: 'rr', label: 'Reward : risk', weight: 1, score: rr, note: rrNote },
    { id: 'management', label: 'Management', weight: 1, score: management, note: mgmtNote },
  ]
  const total = weightedTotal(dimensions)
  const moneyword = outcome.pnl > 0 ? `+$${Math.round(outcome.pnl)}` : outcome.pnl < 0 ? `−$${Math.abs(Math.round(outcome.pnl))}` : '$0'
  return {
    total,
    dimensions,
    pnl: outcome.pnl,
    title: total >= spec.objective.passScore ? `Solid process · ${moneyword}` : `Process needs work · ${moneyword}`,
    detail: dimensions.map((x) => `${x.label}: ${Math.round(x.score * 100)}% — ${x.note}`).join('  '),
  }
}
```

- [ ] **Step 4: Register `charts-v1`**

In `src/practice/rubrics/index.ts`, import and add to `RUBRICS`:

```ts
import { chartsRubricV1 } from './charts'
// ...
export const RUBRICS: Record<string, Rubric> = { noop, 'charts-v1': chartsRubricV1 }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/practice/rubrics/`
Expected: PASS (charts + index suites).

- [ ] **Step 6: Commit**

```bash
git add src/practice/rubrics/charts.ts src/practice/rubrics/index.ts src/practice/rubrics/charts.test.ts
git commit -m "feat(practice): charts-v1 process rubric (process over P&L)"
```

---

## Task 5: Curated debrief generator

**Files:**
- Create: `src/practice/debrief.ts`
- Test: `src/practice/debrief.test.ts`

**Interfaces:**
- Consumes: `ScenarioSpec`, `Decision`, `ScenarioOutcome`, `ProcessScore` from `./types`.
- Produces: `curatedDebrief(spec, decision, outcome, score, journal?) → string`.

The curated debrief is deterministic prose assembled from the real score + outcome facts + journal feeling (calls out self-attribution per PRDphase2 §10.2). M3 swaps this for the guardrailed LLM coach behind the same signature.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/debrief.test.ts
import { describe, it, expect } from 'vitest'
import { curatedDebrief } from './debrief'
import type { ScenarioSpec, ProcessScore, ScenarioOutcome } from './types'

const spec = { objective: { passScore: 70 } } as ScenarioSpec
const score = (total: number): ProcessScore => ({
  total, pnl: -100, title: 't',
  dimensions: [{ id: 'stop', label: 'Defined max loss', weight: 2, score: 0, note: 'No stop.' }],
  detail: 'd',
})
const outcome: ScenarioOutcome = { pnl: -100, facts: { took: true, hit: 'sl' } }

describe('curatedDebrief', () => {
  it('praises good process on a losing trade (process over outcome)', () => {
    const text = curatedDebrief(spec, { took: true } as never, outcome, score(82))
    expect(text).toMatch(/good process/i)
  })
  it('names the weakest dimension when the score is low', () => {
    const text = curatedDebrief(spec, { took: true } as never, outcome, score(40))
    expect(text).toMatch(/Defined max loss/)
  })
  it('confronts a fomo self-attribution when present', () => {
    const text = curatedDebrief(spec, { took: true } as never, outcome, score(38), { rationale: 'chased it', feeling: 'fomo' })
    expect(text.toLowerCase()).toContain('fomo')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/debrief.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/debrief.ts
import type { Decision, Feeling, ProcessScore, ScenarioOutcome, ScenarioSpec } from './types'

/** Deterministic coaching prose from the real score + facts. LLM replaces this in M3. */
export function curatedDebrief(
  spec: ScenarioSpec,
  _decision: Decision,
  outcome: ScenarioOutcome,
  score: ProcessScore,
  journal?: { rationale: string; feeling: Feeling },
): string {
  const passed = score.total >= spec.objective.passScore
  const won = outcome.pnl > 0
  const parts: string[] = []

  if (passed && !won) {
    parts.push('That was good process on an unlucky outcome — exactly what we want to reward. Repeat this and the P&L follows.')
  } else if (passed && won) {
    parts.push('Sound process and it paid — note WHY it worked so you can do it again on purpose.')
  } else if (!passed && won) {
    parts.push('You made money, but the process was loose — that is how accounts get a false sense of safety. Tighten the weak spot below.')
  } else {
    parts.push('Tough one, and the process had a gap. Fixing it is worth more than the loss.')
  }

  const weakest = [...score.dimensions].sort((a, b) => a.score - b.score)[0]
  if (weakest && weakest.score < 0.6) {
    parts.push(`Biggest lever: ${weakest.label}. ${weakest.note}`)
  }

  if (journal && score.total < spec.objective.passScore) {
    const f: Feeling = journal.feeling
    if (f === 'fomo' || f === 'revenge' || f === 'anxious') {
      parts.push(`You logged "${f}" going in, and it scored ${score.total}. Notice the pattern — emotion-driven entries rarely grade well.`)
    }
  }
  return parts.join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/debrief.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/debrief.ts src/practice/debrief.test.ts
git commit -m "feat(practice): deterministic curated debrief generator"
```

---

## Task 6: ChartTradeScene (input collection only)

**Files:**
- Create: `src/practice/scenes/ChartTradeScene.ts`
- Create: `src/practice/scenes/index.ts`
- Test: `src/practice/scenes/index.test.ts`

**Interfaces:**
- Consumes: `ModuleScene` + helpers (`label`, `panel`, `slider`, `dashedLine`, `button`, `emitDecision`, `emitNudge`, `setCanSubmit`, `fmtPrice`); `Candle`; the palette `C`.
- Produces: `ChartTradeScene` (default export), `PRACTICE_SCENES: Record<string, SceneCtor>`, `resolvePracticeScene(kind)`.
- Scene `params`: `{ candles: Candle[]; splitIndex: number; entry: number; constraints: { accountBalance, maxRiskPct } }`. On submit it emits a `decision` payload `{ took, direction, shares, entry, stop, target }` and fires `nudge` events live (`sizing`, `no-stop`) as inputs change.

**Testing note:** Per Global Constraints, the scene is verified by a wiring smoke test (phaser mocked) that asserts it is registered and constructable, mirroring `src/lessons/registry.test.ts`. The graded behaviour is covered by the resolver/rubric tests; the scene only collects inputs.

- [ ] **Step 1: Write the scene**

```ts
// src/practice/scenes/ChartTradeScene.ts
import Phaser from 'phaser'
import { ModuleScene } from '../../engine/ModuleScene'
import { C } from '../../engine/palette'
import type { Candle } from '../../data/candles'

interface ChartTradeParams {
  candles: Candle[]
  splitIndex: number
  entry: number
  constraints: { accountBalance: number; maxRiskPct: number }
}

/**
 * Practice Track A input scene. Draws real candles up to the split, lets the learner
 * choose take/skip, drag a stop + target, and set a position size. It NEVER grades —
 * on Submit it emits a structured `decision` for the React player to resolve + grade.
 * Live `nudge` events fire as risky inputs are set (sizing, no-stop).
 */
export default class ChartTradeScene extends ModuleScene {
  private p!: ChartTradeParams
  private took = true
  private shares = 100
  private stop = 0
  private target = 0
  private direction: 'long' | 'short' = 'long'
  private plot = { l: 12, r: 682, t: 22, b: 430, w: 670, h: 408 }
  private pmin = 0
  private pmax = 1

  protected build(): void {
    this.p = this.params as unknown as ChartTradeParams
    const c = this.p.candles
    let lo = Infinity, hi = -Infinity
    for (const k of c) { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h) }
    const pad = (hi - lo) * 0.08
    this.pmin = lo - pad; this.pmax = hi + pad

    this.drawCandlesToSplit()
    this.stop = this.direction === 'long' ? this.p.entry * 0.98 : this.p.entry * 1.02
    this.target = this.direction === 'long' ? this.p.entry * 1.04 : this.p.entry * 0.96

    this.drawEntryLine()
    this.buildControls()
    this.setCanSubmit(true)
    this.emitReady()
  }

  private yFor(price: number): number {
    const t = (price - this.pmin) / (this.pmax - this.pmin)
    return this.plot.b - t * this.plot.h
  }

  private drawCandlesToSplit(): void {
    const c = this.p.candles
    const step = this.plot.w / c.length
    const bodyW = Math.max(1.5, Math.min(10, step * 0.62))
    for (let i = 0; i <= this.p.splitIndex; i++) {
      const k = c[i]
      const up = k.c >= k.o
      const col = up ? C.green : C.red
      const x = this.plot.l + i * step + step / 2
      const g = this.add.graphics()
      g.lineStyle(1.2, col, 1)
      g.lineBetween(x, this.yFor(k.h), x, this.yFor(k.l))
      const yo = this.yFor(k.o), yc = this.yFor(k.c)
      g.fillStyle(col, 1)
      g.fillRect(x - bodyW / 2, Math.min(yo, yc), bodyW, Math.max(1.5, Math.abs(yc - yo)))
    }
    // Mask the hidden region (mirrors CandleChartScene quiz mask).
    const sx = this.plot.l + (this.p.splitIndex + 1) * step
    const mg = this.add.graphics()
    mg.fillStyle(C.amberSoft, 0.96)
    mg.fillRect(sx, this.plot.t, this.plot.r - sx, this.plot.h)
  }

  private drawEntryLine(): void {
    const y = this.yFor(this.p.entry)
    const g = this.add.graphics()
    g.lineStyle(1.5, C.ink, 0.85)
    g.lineBetween(this.plot.l, y, this.plot.r, y)
    this.label(this.plot.l + 6, y - 12, `Entry ${this.fmt(this.p.entry)}`, { col: C.ink, bold: true, size: this.fs(13) })
  }

  private fmt(p: number): string {
    return p >= 100 ? p.toFixed(0) : p.toFixed(2)
  }

  private riskDollars(): number {
    return Math.abs(this.p.entry - this.stop) * this.shares
  }

  private buildControls(): void {
    // Take/Skip toggle.
    this.button(this.plot.l + 60, this.plot.t + 16, 'Take / Skip', () => {
      this.took = !this.took
      this.fireNudges()
    }, { w: 130, h: 30 })

    // Size slider 0..5000 shares.
    this.slider(this.plot.l + 6, this.plot.b + 8, 200, 0, 5000, this.shares, (v) => {
      this.shares = Math.round(v)
      this.fireNudges()
    }, { step: 50 })

    // Stop + target draggable lines (reuse a simple grab band like CandleChartScene).
    // (Full drag wiring mirrors CandleChartScene.addPriceLine; omitted here for brevity is NOT allowed —
    //  implement the two draggable lines with the same constrain pattern: stop below entry (long), target above.)
    this.drawAdjustableLine('stop', C.red)
    this.drawAdjustableLine('target', C.green)
  }

  private drawAdjustableLine(which: 'stop' | 'target', col: number): void {
    const get = () => (which === 'stop' ? this.stop : this.target)
    const set = (v: number) => { if (which === 'stop') this.stop = v; else this.target = v }
    const y0 = this.yFor(get())
    const lineG = this.add.graphics()
    const draw = () => {
      const y = this.yFor(get())
      lineG.clear()
      lineG.lineStyle(1.8, col, 1)
      this.dashedLine(this.plot.l, y, this.plot.r, col)
      lineG.lineBetween(this.plot.l, y, this.plot.r, y)
    }
    draw()
    const knob = this.add.circle(this.plot.r - 10, y0, this.compact ? 10 : 8, col).setStrokeStyle(2.5, C.white).setInteractive({ useHandCursor: true })
    this.input.setDraggable(knob)
    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, _x: number, dy: number) => {
      if (obj !== knob) return
      const price = this.pmin + ((this.plot.b - Phaser.Math.Clamp(dy, this.plot.t, this.plot.b)) / this.plot.h) * (this.pmax - this.pmin)
      set(price)
      knob.y = this.yFor(price)
      draw()
      this.fireNudges()
    })
  }

  private fireNudges(): void {
    if (!this.took) return
    const budget = (this.p.constraints.maxRiskPct / 100) * this.p.constraints.accountBalance
    if (this.riskDollars() > budget) this.emitNudge('sizing')
    if (this.stop === undefined) this.emitNudge('no-stop')
  }

  protected onSubmit(): void {
    this.emitDecision(
      this.took
        ? { took: true, direction: this.direction, shares: this.shares, entry: this.p.entry, stop: this.stop, target: this.target }
        : { took: false },
    )
  }
}
```

> NOTE for the implementer: do not abbreviate the draggable-line wiring — both stop and target must be draggable with the constrain pattern from `CandleChartScene.addPriceLine` (stop below entry for a long / above for a short; target the opposite). Verify by dragging both in the dev server.

- [ ] **Step 2: Write the practice scene registry + wiring test**

```ts
// src/practice/scenes/index.ts
import type { SceneCtor } from '../../engine/types'
import ChartTradeScene from './ChartTradeScene'

/** kind → scene class for Practice tracks (mirrors a lesson package's scenes map). */
export const PRACTICE_SCENES: Record<string, SceneCtor> = {
  'chart-trade': ChartTradeScene as unknown as SceneCtor,
}

export function resolvePracticeScene(kind: string): SceneCtor | undefined {
  return PRACTICE_SCENES[kind]
}
```

```ts
// src/practice/scenes/index.test.ts
import { describe, it, expect, vi } from 'vitest'

// Stub phaser exactly like src/lessons/registry.test.ts (canvas feature-detection needs a browser).
vi.mock('phaser', () => {
  const stub: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'Scene') return class {}
      return stub
    },
    construct: () => ({}),
    apply: () => stub,
  })
  return { default: stub }
})

const { PRACTICE_SCENES, resolvePracticeScene } = await import('./index')

describe('practice scene registry', () => {
  it('registers the chart-trade scene as a constructable class', () => {
    expect(typeof PRACTICE_SCENES['chart-trade']).toBe('function')
    expect(resolvePracticeScene('chart-trade')).toBeTruthy()
    expect(resolvePracticeScene('missing')).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run the wiring test**

Run: `npx vitest run src/practice/scenes/index.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/practice/scenes/ChartTradeScene.ts src/practice/scenes/index.ts src/practice/scenes/index.test.ts
git commit -m "feat(practice): ChartTradeScene (input-only) + practice scene registry"
```

---

## Task 7: Journal component

**Files:**
- Create: `src/practice/Journal.tsx`
- Test: (none — small controlled form; covered by player manual run)

**Interfaces:**
- Produces: `Journal({ onSubmit })` where `onSubmit(entry: { rationale: string; feeling: Feeling })`. Submit disabled until a non-empty rationale + a feeling are chosen.

- [ ] **Step 1: Write the component**

```tsx
// src/practice/Journal.tsx
import { useState } from 'react'
import Button from '../components/ui/Button'
import type { Feeling } from './types'

const FEELINGS: Feeling[] = ['confident', 'anxious', 'fomo', 'revenge', 'calm']

export default function Journal({ onSubmit }: { onSubmit: (e: { rationale: string; feeling: Feeling }) => void }) {
  const [rationale, setRationale] = useState('')
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const ready = rationale.trim().length > 0 && feeling !== null

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      <p className="text-lg font-semibold">Before you see the result — log it.</p>
      <input
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="One line: why did you take (or skip) this?"
        className="w-full rounded-xl border-2 border-hairline px-4 py-3 text-base focus:border-ink focus:outline-none"
      />
      <div role="group" aria-label="How did you feel?" className="flex flex-wrap justify-center gap-2">
        {FEELINGS.map((f) => (
          <button
            key={f}
            aria-pressed={feeling === f}
            onClick={() => setFeeling(f)}
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold capitalize ${
              feeling === f ? 'border-ink bg-ink text-white' : 'border-hairline text-ink hover:border-ink/40'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <Button disabled={!ready} onClick={() => ready && onSubmit({ rationale: rationale.trim(), feeling: feeling! })}>
        Log &amp; see result
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/practice/Journal.tsx
git commit -m "feat(practice): required pre-result journal (rationale + feeling)"
```

---

## Task 8: ScenarioPlayer (lifecycle orchestrator)

**Files:**
- Create: `src/practice/ScenarioPlayer.tsx`
- Create: `src/pages/ScenarioPlayerPage.tsx`
- Modify: `src/App.tsx` (add `/practice/play/:specId`)
- Test: (none — orchestration component; pure pieces are tested; covered by manual exit check Task 10)

**Interfaces:**
- Consumes: `getScenario` (registry), `loadCandles` (corpus), `resolveChartTrade` (resolver), `getRubric` (rubrics), `evaluateNudges`/`NUDGES` (nudges), `curatedDebrief`, `usePractice().applyResult`, `PhaserCanvas`, `SceneBus`, `resolvePracticeScene`, `Journal`.
- Produces: `ScenarioPlayer({ spec, candles })`; page route `/practice/play/:specId`.

Lifecycle: `setup` (scene mounted, listen for `nudge` → toast, `decision` → store + advance) → `journal` (required) → `resolved` (run resolver+rubric, show banner + per-dimension breakdown + curated debrief + Continue → `applyResult` → navigate to next).

- [ ] **Step 1: Write the player**

```tsx
// src/practice/ScenarioPlayer.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhaserCanvas from '../engine/PhaserCanvas'
import { SceneBus } from '../engine/bus'
import Button from '../components/ui/Button'
import { resolvePracticeScene } from './scenes'
import { resolveChartTrade } from './resolve/charts'
import { getRubric } from './rubrics'
import { NUDGES } from './nudges'
import { curatedDebrief } from './debrief'
import { usePractice } from '../state/PracticeContext'
import Journal from './Journal'
import type { Candle } from '../data/candles'
import type { ChartsDecision, Decision, Feeling, ProcessScore, ScenarioOutcome, ScenarioSpec } from './types'

type Phase = 'setup' | 'journal' | 'resolved'

export default function ScenarioPlayer({ spec, candles }: { spec: ScenarioSpec; candles: Candle[] }) {
  const navigate = useNavigate()
  const { applyResult } = usePractice()
  const busRef = useRef<SceneBus>()
  if (!busRef.current) busRef.current = new SceneBus()
  const bus = busRef.current

  const [phase, setPhase] = useState<Phase>('setup')
  const [firedNudges, setFiredNudges] = useState<string[]>([])
  const decisionRef = useRef<Decision | null>(null)
  const [result, setResult] = useState<{ outcome: ScenarioOutcome; score: ProcessScore } | null>(null)
  const [journal, setJournal] = useState<{ rationale: string; feeling: Feeling } | null>(null)

  const scene = resolvePracticeScene('chart-trade')!
  const splitIndex = spec.dataRef.splitIndex ?? Math.floor(candles.length * 0.6)
  const entry = candles[splitIndex].c

  const canvas = useMemo(
    () => (
      <PhaserCanvas
        scene={scene}
        bus={bus}
        params={{ candles, splitIndex, entry, constraints: spec.constraints }}
      />
    ),
    [scene, bus, candles, splitIndex, entry, spec.constraints],
  )

  // Collect live nudges + the structured decision from the scene.
  useEffect(() => {
    const off = bus.on((e) => {
      if (e.type === 'nudge') setFiredNudges((prev) => (prev.includes(e.id) ? prev : [...prev, e.id]))
      if (e.type === 'decision') {
        decisionRef.current = e.payload as unknown as Decision
        setPhase('journal')
      }
    })
    return off
  }, [bus])

  const onJournal = (entry: { rationale: string; feeling: Feeling }) => {
    setJournal(entry)
    const decision = decisionRef.current as ChartsDecision
    const outcome = resolveChartTrade(candles, decision, spec.dataRef)
    const score = getRubric(spec.rubricId)(spec, decision, outcome)
    setResult({ outcome, score })
    setPhase('resolved')
  }

  const finish = () => {
    if (!result || !journal) return
    const decision = decisionRef.current as Decision
    applyResult({
      specId: spec.id, track: spec.track, tier: spec.tier, decision,
      nudgesFired: firedNudges, score: result.score.total,
      breakdown: result.score.dimensions, pnl: result.score.pnl,
      journal, createdAt: Date.now(),
    })
    navigate('/practice')
  }

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-4">
      <header className="text-center">
        <span className="rounded-full bg-brand-amber-soft px-3 py-1 text-xs font-bold text-brand-amber-dark">
          {spec.track} · Tier {spec.tier}
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold">{spec.title}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-ink-soft">{spec.brief}</p>
      </header>

      {canvas}

      {/* Live nudges */}
      {phase === 'setup' && firedNudges.length > 0 && (
        <div className="w-full max-w-xl space-y-2">
          {firedNudges.map((id) => (
            <p key={id} role="status" className="rounded-xl bg-brand-amber-soft px-4 py-2 text-sm font-semibold text-brand-amber-dark">
              {NUDGES[id]?.copy}
            </p>
          ))}
        </div>
      )}

      {phase === 'setup' && (
        <Button onClick={() => bus.emit({ type: 'submit' })}>Submit trade</Button>
      )}

      {phase === 'journal' && <Journal onSubmit={onJournal} />}

      {phase === 'resolved' && result && (
        <div className="flex w-full max-w-2xl flex-col items-center gap-3">
          <div className={`rounded-2xl px-5 py-3 text-lg font-bold ${result.score.total >= spec.objective.passScore ? 'bg-brand-green-soft text-brand-green-text' : 'bg-brand-red-soft text-brand-red'}`}>
            Process score {result.score.total}/100 · P&amp;L {result.outcome.pnl >= 0 ? '+' : '−'}${Math.abs(Math.round(result.outcome.pnl))}
          </div>
          <ul className="w-full space-y-1">
            {result.score.dimensions.map((d) => (
              <li key={d.id} className="flex justify-between gap-3 text-sm">
                <span className="font-semibold">{d.label}</span>
                <span className="text-muted">{Math.round(d.score * 100)}% — {d.note}</span>
              </li>
            ))}
          </ul>
          <p className="text-center text-base leading-relaxed text-ink-soft">
            {curatedDebrief(spec, decisionRef.current as Decision, result.outcome, result.score, journal ?? undefined)}
          </p>
          <Button onClick={finish}>Continue</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write the page (loads spec + candles)**

```tsx
// src/pages/ScenarioPlayerPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Spinner from '../components/ui/Spinner'
import ScenarioPlayer from '../practice/ScenarioPlayer'
import { getScenario } from '../practice/scenarioRegistry'
import { loadCandles } from '../practice/corpus'
import type { Candle } from '../data/candles'

export default function ScenarioPlayerPage() {
  const { specId } = useParams<{ specId: string }>()
  const navigate = useNavigate()
  const spec = specId ? getScenario(specId) : undefined
  const [candles, setCandles] = useState<Candle[] | null>(null)

  useEffect(() => {
    if (!spec) {
      navigate('/practice', { replace: true })
      return
    }
    let active = true
    loadCandles(spec.dataRef)
      .then((c) => active && setCandles(c))
      .catch((e) => {
        console.error('Failed to load scenario data', e)
        if (active) navigate('/practice', { replace: true })
      })
    return () => {
      active = false
    }
  }, [spec, navigate])

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="mx-auto flex max-w-5xl justify-center px-4 py-10">
        {!spec || !candles ? <Spinner className="h-8 w-8" /> : <ScenarioPlayer spec={spec} candles={candles} />}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Add the route**

In `src/App.tsx`, inside the protected routes, add:

```tsx
            <Route path="/practice/play/:specId" element={<ScenarioPlayerPage />} />
```

and `import ScenarioPlayerPage from './pages/ScenarioPlayerPage'` at the top.

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/ScenarioPlayer.tsx src/pages/ScenarioPlayerPage.tsx src/App.tsx
git commit -m "feat(practice): scenario player lifecycle (setup→journal→grade→debrief)"
```

---

## Task 9: Curated charts catalog + Practice page entry

**Files:**
- Modify: `src/practice/scenarioRegistry.ts` (add ≥10 charts specs, tiers 1–3)
- Modify: `src/pages/PracticePage.tsx` (track card → start)

**Interfaces:**
- Consumes: real bundled `CANDLES` keys and/or ingested `ohlcAsset` paths (verify each against `public/data/manifest.json`).
- Produces: ≥10 validated `charts` `ScenarioSpec`s; a "Start" button on the charts card that calls `nextScenario('charts')` and navigates to `/practice/play/:id`.

- [ ] **Step 1: Add curated charts scenarios**

In `src/practice/scenarioRegistry.ts`, replace the single seed with a real set. Use bundled keys where they exist (no fetch needed) and `rubricId: 'charts-v1'`. Example entries (repeat the shape for ≥10 across tiers 1–3, choosing varied real windows; pick `splitIndex` ≈ 60% and `revealToIndex` = series length):

```ts
function chartsSpec(id: string, tier: number, candlesKey: string, len: number, over: Partial<import('./types').ScenarioSpec> = {}): import('./types').ScenarioSpec {
  return {
    id, track: 'charts', tier,
    title: 'Take it or skip it?',
    brief: 'Real price action up to a decision point. If the setup is sound, set your size, stop, and target; otherwise stay out.',
    dataRef: { candlesKey, splitIndex: Math.max(1, Math.floor(len * 0.6)), revealToIndex: len },
    objective: { kind: 'process', passScore: 70 },
    constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: tier >= 2 ? 2 : 1.5 },
    rubricId: 'charts-v1',
    nudges: [{ id: 'sizing' }, { id: 'no-stop' }],
    coachContextKeys: ['outcome', 'exit', 'netMove'],
    source: 'curated',
    ...over,
  }
}
```

Then build `SCENARIOS` from real keys, e.g. (substitute keys that actually exist in `src/data/candles.ts` — read its exports first):

```ts
import { CANDLES } from '../data/candles'
const K = (k: string) => CANDLES[k]?.length ?? 0
export const SCENARIOS: import('./types').ScenarioSpec[] = [
  chartsSpec('charts-t1-01', 1, '<real key 1>', K('<real key 1>')),
  // ... ≥10 total across tiers 1–3
].filter((s) => (s.dataRef.candlesKey ? K(s.dataRef.candlesKey) > 5 : true))
```

> The implementer MUST read `src/data/candles.ts` to choose real keys and confirm lengths; the `scenarioRegistry.test.ts` validator contract (from M0 Task 6) will fail the build if any spec is malformed.

- [ ] **Step 2: Wire the Practice page Start buttons**

In `src/pages/PracticePage.tsx`, add `useNavigate` + `usePractice().nextScenario`. Gate the card's enabled/label state on `scenariosFor(track)` (a pure, synchronous check) — NOT on calling `nextScenario` — so the button stays render-safe when M3 makes `nextScenario` async:

```tsx
import { scenariosFor } from '../practice/scenarioRegistry'
const navigate = useNavigate()
const { nextScenario } = usePractice()
const hasTrack = (t: Track) => scenariosFor(t).length > 0
const start = (t: Track) => {
  const s = nextScenario(t) // M1: returns a spec synchronously; M3: becomes `await nextScenario(t)`
  if (s) navigate(`/practice/play/${s.id}`)
}
// in each card:
<button onClick={() => start(t)} disabled={!hasTrack(t)} className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
  {hasTrack(t) ? 'Start scenario' : 'Coming soon'}
</button>
```

(Only the `charts` card will be enabled until M2/M5 add options/market-making specs.)

> M3 NOTE: when `nextScenario` becomes async + LLM-primary, `start` becomes `const s = await nextScenario(t)` (with a brief "Composing…" state on cold start), and `hasTrack` continues to gate the card via `scenariosFor` (curated still backs the cold-start/fallback). No JSX changes needed.

- [ ] **Step 3: Run the registry contract + typecheck**

Run: `npx vitest run src/practice/scenarioRegistry.test.ts && npm run typecheck`
Expected: PASS (all curated specs valid).

- [ ] **Step 4: Commit**

```bash
git add src/practice/scenarioRegistry.ts src/pages/PracticePage.tsx
git commit -m "feat(practice): curated charts catalog (tiers 1–3) + Practice start buttons"
```

---

## Task 10: M1 exit check

**Files:** (none — verification)

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 2: Manual exit criteria (PRDphase2 §17 M1 row)**

Run: `npm run dev`, sign in, `/practice` → charts card → "Start scenario". Verify, across **10 curated chart scenarios end-to-end**:
1. Candles render to the split with the rest masked; entry line shown.
2. Dragging stop/target and the size slider fires the sizing/no-stop nudges live.
3. Submit → journal (required: cannot proceed without rationale + feeling).
4. After journal: hidden candles' outcome resolves, process score + per-dimension breakdown + curated debrief show; an oversized/stopless but profitable trade scores low (process over P&L); a sane losing trade scores well.
5. Continue updates the paper balance + charts skill/tier on `/practice` and persists across reload (Firestore round-trip).

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(practice): M1 Track A charts green (10 scenarios end-to-end)"
```

---

## Self-Review

**1. Spec coverage (PRDphase2 §7.2, §9, §10, §5 lifecycle, §17 M1):** Real-data windows + take/skip/size/stop/target → ChartTradeScene + curated catalog. Honest fills → resolver (gap-through tests). Process rubric incl. "profitable-but-reckless scores low" → charts-v1 + its test. Nudges live at decision points → scene `emitNudge` + player toasts. Journal required → Journal gate in player. Debrief → curated generator (LLM in M3). Lifecycle setup→decide→nudge→resolve→journal→grade→debrief → ScenarioPlayer phases. ✓

**2. Placeholder scan:** No TBDs. The one instruction-only spot (draggable line wiring + choosing real `candlesKey`s) is flagged as a hard requirement with a verification step, not a placeholder — the surrounding code and the constrain pattern to copy (`CandleChartScene.addPriceLine`) are named precisely. ✓

**3. Type consistency:** `decision` payload `{took,direction,shares,entry,stop,target}` matches `ChartsDecision`; resolver/rubric/ player all consume `ChartsDecision`; `applyResult(PracticeRun)` matches M0's signature; `getRubric('charts-v1')` matches the rubric registered in Task 4; bus `decision`/`nudge` variants match the emitters added in Task 1. ✓

**Carried interfaces M2+ rely on:** `loadCandles`, `resolveChartTrade`/`Frictions`, `ScenarioPlayer` lifecycle pattern, `PRACTICE_SCENES`/`resolvePracticeScene`, `curatedDebrief`, `Journal`, the `chartsSpec` catalog pattern.
