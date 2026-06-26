# Practice Mode — M3: LLM Composer + Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the **LLM the primary, default content engine** so Practice has effectively never-ending bespoke scenarios. The **composer** emits a `ScenarioSpec` that references only real data (validated, retried) and authors the bespoke layer — framing, objective, difficulty, constraints, nudge mix, and *which real data slice* to drop the learner into. The **coach** writes the debrief constrained to whitelisted real facts. Curated specs are demoted to two narrow roles only: an instant **cold-start** (first scenario before the model has produced one) and a silent **fallback** (model offline / over budget / failed validation). The model never fabricates a traded number.

**Where the endless variety comes from:** the LLM does not invent prices — it composes over a large **real-data catalog** (every ingested OHLC series + option chain) and varies the *time-window, framing, objective, tier, and nudges*. Asset × slice × framing × tier is combinatorially unbounded, and the corpus can grow independently. So variety scales with data + prompt, not with hand-authoring.

**Architecture:** Keep the model call behind a small injectable `ModelClient` interface so the orchestration is deterministic and unit-testable with a mock. The composer pipeline is pure: build prompt → call model → parse JSON → `validateComposed` (catalog-aware validator + numeric-claim lint) → retry ≤2 → fall back to a curated spec. To hide model latency, a **prefetch queue** keeps the next few LLM scenarios composed in the background while the learner plays the current one, so `nextScenario` returns fresh AI content instantly. The coach pipeline builds a tightly-scoped prompt, calls the model, then **post-filters** the prose (disallowed-claim + out-of-whitelist-number rejection) → falls back to `curatedDebrief`. The default `ModelClient` uses **Firebase AI Logic (Gemini)**; a Cloud Functions callable variant is documented for teams that want a hard server boundary.

**Tech Stack:** Same as M0–M2 + `firebase/ai` (Firebase AI Logic, bundled with firebase v11). All grading/sim stays deterministic; CI never calls a model.

## Global Constraints

- (All M0–M2 Global Constraints apply.) `npm run typecheck` + `npm test` green at every commit; **tests never hit the network/model** (mock `ModelClient`).
- **The invariant (PRDphase2 §8):** numbers flow LLM → (text + references) → validator → real data → sim → grader → LLM (text). The model is upstream of validation and downstream of grading; it is **never** the source of a traded number.
- **LLM is the default engine:** `nextScenario` serves an LLM-composed spec whenever the model is available. Curated specs are used ONLY for (a) the very first scenario at cold start while the queue warms, and (b) silent fallback when the model is offline / over budget / fails validation twice. With AI disabled entirely the app still works curated-only.
- **Two call sites only:** composer (returns a validated `ScenarioSpec`) and coach (returns debrief prose). Anything else is out of scope (Q&A tutor is a later increment).
- **System guardrails ("Rex" model, PRDphase2 §13):** never predict prices, never pick stocks, never give financial advice, never invent market numbers, always teach the why, always defer traded numbers to provided real data.
- **Latency + cost control via prefetch, not via falling back to curated:** a background queue keeps `QUEUE_SIZE` (default 2) LLM scenarios ready per active track, composed while the learner plays, so fresh AI content appears with no perceived wait. Budget: ≤2 model calls per composed scenario (1 attempt + ≤1 retry) + 1 coach call; an optional per-session compose cap (`MAX_COMPOSES_PER_SESSION`) degrades gracefully to curated when exceeded. The corpus/catalog is the *source of real data the LLM draws from*, not a substitute for it.
- **Keys never in the client bundle:** Firebase AI Logic uses the Firebase backend + App Check, not a raw API key; if a raw provider key is ever needed, it MUST live in a Cloud Function, never `import.meta.env`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/practice/ai/types.ts` (new) | `ModelClient` interface, `ComposeRequest`, `CoachRequest`, `DataCatalog`. |
| `src/practice/ai/catalog.ts` (+ `.test.ts`) | Build the real-data catalog (allowed candlesKeys / ohlc + chain assets) the composer may reference. |
| `src/practice/ai/composerPrompt.ts` (+ `.test.ts`) | Pure prompt builder (system guardrails + catalog + tier/track) and `parseComposerJson`. |
| `src/practice/ai/validateComposed.ts` (+ `.test.ts`) | Catalog-aware `validateSpec` wrapper + numeric-claim lint for `source:'llm'`. |
| `src/practice/ai/composer.ts` (+ `.test.ts`) | `composeScenario(req, model, opts)` pipeline: validate-loop → curated fallback. |
| `src/practice/ai/scenarioQueue.ts` (+ `.test.ts`) | Background prefetch queue: keep N LLM scenarios composed per track so `nextScenario` is instant. |
| `src/practice/ai/coachPrompt.ts` (+ `.test.ts`) | Pure coach prompt builder + `sanitizeCoachText` post-filter. |
| `src/practice/ai/coach.ts` (+ `.test.ts`) | `coachDebrief(req, model)` → validated prose or `curatedDebrief` fallback. |
| `src/services/aiModel.ts` (new) | Firebase AI Logic `ModelClient` impl (untested I/O); callable-function variant documented. |
| `src/state/PracticeContext.tsx` (modify) | `nextScenario` is **LLM-primary** via the queue (curated cold-start + fallback); expose `aiEnabled`, `primeScenarios`. |
| `src/practice/ScenarioPlayer.tsx` (modify) | Debrief via `coachDebrief` (falls back to curated). |
| `functions/` (optional, documented) | Callable `composeScenario`/`coachDebrief` for a hard server boundary. |

---

## Task 1: AI types + data catalog

**Files:**
- Create: `src/practice/ai/types.ts`
- Create: `src/practice/ai/catalog.ts`
- Test: `src/practice/ai/catalog.test.ts`

**Interfaces:**
- Produces: `ModelClient` (`generate(prompt, opts?) → Promise<string>`), `ComposeRequest`, `CoachRequest`, `DataCatalog`, `buildCatalog(track, deps?) → Promise<DataCatalog>` (reads the **full ingested manifests**; fetch is injectable so tests stay offline).

- [ ] **Step 1: Write the types**

```ts
// src/practice/ai/types.ts
import type { Decision, ProcessScore, ScenarioOutcome, ScenarioSpec, Track } from '../types'

/** Minimal model abstraction — one text-in/text-out call. Injectable + mockable. */
export interface ModelClient {
  generate(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string>
}

/** The ONLY real-data identifiers the composer is allowed to reference. */
export interface DataCatalog {
  track: Track
  candlesKeys: string[]
  ohlcAssets: string[]
  chainAssets: string[]
  rubricIds: string[]
  nudgeIds: string[]
}

export interface ComposeRequest {
  track: Track
  tier: number
  accountBalance: number
  catalog: DataCatalog
}

export interface CoachRequest {
  spec: ScenarioSpec
  decision: Decision
  outcome: ScenarioOutcome
  score: ProcessScore
  nudgesFired: string[]
  journal?: { rationale: string; feeling: string }
  /** Whitelisted real facts the coach may cite (numbers it is allowed to mention). */
  allowedFacts: Record<string, number | string | boolean>
}
```

- [ ] **Step 2: Write the failing catalog test**

The catalog is built from the **full ingested manifests** so the composer can reference *every* scraped OHLC series and option chain — that is where the near-endless variety comes from. `fetch` is injected so the test never touches the network or the real (large) files.

```ts
// src/practice/ai/catalog.test.ts
import { describe, it, expect } from 'vitest'
import { buildCatalog } from './catalog'

// Minimal stubs shaped exactly like public/data/manifest.json + options-manifest.json.
const ohlcManifest = {
  timeframes: ['1d', '1h', '15m'],
  tickers: {
    SPY: { '1d': { count: 5031, file: 'data/ohlc/SPY__1d.json' }, '1h': { count: 5089, file: 'data/ohlc/SPY__1h.json' }, '15m': { count: 40, file: 'data/ohlc/SPY__15m.json' } },
    NVDA: { '1d': { count: 5000, file: 'data/ohlc/NVDA__1d.json' } },
  },
}
const optionsManifest = {
  symbols: {
    SPY: [{ date: '2020-01-17', file: 'data/options/SPY__2020-01-17.json', spot: 331.95, contracts: 62, expirations: 3 }],
    DIS: [{ date: '2021-02-17', file: 'data/options/DIS__2021-02-17.json', spot: 188.5, contracts: 50, expirations: 3 }],
  },
}
const deps = {
  loadOhlcManifest: async () => ohlcManifest as never,
  loadOptionsManifest: async () => optionsManifest as never,
}

describe('buildCatalog', () => {
  it('charts catalog lists every manifest OHLC series with enough bars + bundled candle keys', async () => {
    const cat = await buildCatalog('charts', deps)
    expect(cat.track).toBe('charts')
    expect(cat.rubricIds).toContain('charts-v1')
    expect(cat.nudgeIds).toContain('sizing')
    expect(cat.ohlcAssets).toContain('data/ohlc/SPY__1d.json')
    expect(cat.ohlcAssets).toContain('data/ohlc/NVDA__1d.json')
    // the 40-bar 15m series is below MIN_OHLC_BARS and is excluded (can't slice a scenario)
    expect(cat.ohlcAssets).not.toContain('data/ohlc/SPY__15m.json')
    expect(cat.candlesKeys.length).toBeGreaterThan(0) // bundled keys still available for cold start
  })
  it('options catalog flattens every snapshot across all symbols', async () => {
    const cat = await buildCatalog('options', deps)
    expect(cat.rubricIds).toContain('options-v1')
    expect(cat.chainAssets).toContain('data/options/SPY__2020-01-17.json')
    expect(cat.chainAssets).toContain('data/options/DIS__2021-02-17.json')
  })
})
```

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/ai/catalog.ts
import type { DataCatalog } from './types'
import type { Track } from '../types'
import { CANDLES } from '../../data/candles'
import { RUBRICS } from '../rubrics'
import { NUDGES } from '../nudges'

/** Shape of public/data/manifest.json (OHLC) — only the fields we consume. */
export interface OhlcManifest {
  timeframes: string[]
  tickers: Record<string, Record<string, { count: number; file: string }>>
}
/** Shape of public/data/options-manifest.json — only the fields we consume. */
export interface OptionsManifest {
  symbols: Record<string, { date: string; file: string; spot: number; contracts: number }[]>
}

export interface CatalogDeps {
  loadOhlcManifest?: () => Promise<OhlcManifest>
  loadOptionsManifest?: () => Promise<OptionsManifest>
}

/** A series needs enough bars to carve a setup + reveal window. */
export const MIN_OHLC_BARS = 60

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`manifest fetch failed: ${path} (${res.status})`)
  return (await res.json()) as T
}

// Cache the manifests so we hit the network at most once per session.
let ohlcCache: Promise<OhlcManifest> | undefined
let optionsCache: Promise<OptionsManifest> | undefined

/**
 * Build the full real-data allow-list the composer may reference. Charts/MM draw from
 * EVERY ingested OHLC series (manifest.json) with enough bars, plus the bundled candle
 * keys for instant cold start. Options draw from EVERY chain snapshot (options-manifest.json).
 * This is the engine of near-endless variety: asset × timeframe × snapshot × (slice/framing/tier).
 */
export async function buildCatalog(track: Track, deps: CatalogDeps = {}): Promise<DataCatalog> {
  const rubricIds = Object.keys(RUBRICS).filter((id) => id !== 'noop')
  const nudgeIds = Object.keys(NUDGES)

  if (track === 'options') {
    const load = deps.loadOptionsManifest ?? (() => (optionsCache ??= fetchJson<OptionsManifest>('/data/options-manifest.json')))
    const man = await load()
    const chainAssets = Object.values(man.symbols).flat().map((s) => s.file)
    return { track, candlesKeys: [], ohlcAssets: [], chainAssets, rubricIds, nudgeIds }
  }

  // charts + market-making both trade an underlying OHLC series.
  const load = deps.loadOhlcManifest ?? (() => (ohlcCache ??= fetchJson<OhlcManifest>('/data/manifest.json')))
  const man = await load()
  const ohlcAssets: string[] = []
  for (const byTimeframe of Object.values(man.tickers)) {
    for (const info of Object.values(byTimeframe)) {
      if ((info.count ?? 0) >= MIN_OHLC_BARS) ohlcAssets.push(info.file)
    }
  }
  return { track, candlesKeys: Object.keys(CANDLES), ohlcAssets, chainAssets: [], rubricIds, nudgeIds }
}

/** Test/dev helper: clear the memoised manifests. */
export function __resetCatalogCache(): void {
  ohlcCache = undefined
  optionsCache = undefined
}
```

> NOTE: `manifest.json` ships ~186 tickers × {1d,1h,15m} ≈ hundreds of OHLC series, and `options-manifest.json` ships every symbol×expiry snapshot — so the allow-list is large by design. The composer prompt (Task 2) samples a fresh subset each call, so prompt size stays bounded *and* variety rises. The corpus loader `loadCandles` (M1) already resolves an `ohlcAsset` path, so any manifest entry is directly playable.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/ai/catalog.test.ts`
Expected: PASS (offline — uses injected manifest stubs).

- [ ] **Step 5: Commit**

```bash
git add src/practice/ai/types.ts src/practice/ai/catalog.ts src/practice/ai/catalog.test.ts
git commit -m "feat(practice): AI model interface + full-manifest real-data catalog (allow-list)"
```

---

## Task 2: Composer prompt + JSON parse

**Files:**
- Create: `src/practice/ai/composerPrompt.ts`
- Test: `src/practice/ai/composerPrompt.test.ts`

**Interfaces:**
- Produces: `buildComposerPrompt(req, opts?) → string` (samples ≤ `SAMPLE_REFS` real refs each call — bounded prompt + cross-call variety; `opts.rng` injectable for deterministic tests), `parseComposerJson(text) → unknown` (extracts the first JSON object, throws on none), `sampleRefs(refs, n, rng?) → string[]`.

- [ ] **Step 1: Write the failing test**

The catalog is now async, so the test builds a **literal `DataCatalog`** (no network, no `buildCatalog` call) and injects a deterministic `rng` to assert sampling behaviour.

```ts
// src/practice/ai/composerPrompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildComposerPrompt, parseComposerJson, sampleRefs } from './composerPrompt'
import type { DataCatalog } from './types'

const catalog: DataCatalog = {
  track: 'charts',
  candlesKeys: ['NVDA_DEMO'],
  ohlcAssets: Array.from({ length: 200 }, (_, i) => `data/ohlc/T${i}__1d.json`),
  chainAssets: [],
  rubricIds: ['charts-v1'],
  nudgeIds: ['sizing', 'no-stop'],
}
const req = { track: 'charts' as const, tier: 2, accountBalance: 10000, catalog }

describe('sampleRefs', () => {
  it('returns at most n refs and respects an injected rng', () => {
    const out = sampleRefs(catalog.ohlcAssets, 5, () => 0) // rng=0 → deterministic pick
    expect(out.length).toBe(5)
  })
  it('returns everything when there are fewer refs than n', () => {
    expect(sampleRefs(['a', 'b'], 40).sort()).toEqual(['a', 'b'])
  })
})

describe('buildComposerPrompt', () => {
  it('states the guardrails and enumerates rubrics/nudges + a bounded ref sample', () => {
    const p = buildComposerPrompt(req, { rng: () => 0 })
    expect(p).toMatch(/never (predict|invent)/i)
    expect(p).toMatch(/charts-v1/)
    expect(p).toMatch(/sizing/)
    expect(p).toMatch(/tier 2/i)
    expect(p.toLowerCase()).toContain('only')
    expect(p.toLowerCase()).toContain('json')
  })
  it('caps the number of refs listed even when the catalog is huge', () => {
    const listed = buildComposerPrompt(req, { rng: () => 0 }).split('\n').filter((l) => l.trim().startsWith('- data/ohlc/'))
    expect(listed.length).toBeLessThanOrEqual(40)
  })
  it('varies the ref sample across calls (different rng → different refs)', () => {
    const a = buildComposerPrompt(req, { rng: () => 0.1 })
    const b = buildComposerPrompt(req, { rng: () => 0.9 })
    expect(a).not.toBe(b)
  })
})

describe('parseComposerJson', () => {
  it('extracts a JSON object even with prose/code fences around it', () => {
    const text = 'Sure!\n```json\n{"id":"x","track":"charts"}\n```\nDone.'
    expect(parseComposerJson(text)).toEqual({ id: 'x', track: 'charts' })
  })
  it('throws when there is no JSON object', () => {
    expect(() => parseComposerJson('no json here')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/ai/composerPrompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/ai/composerPrompt.ts
import type { ComposeRequest } from './types'

/** Max real-data refs offered to the model per call (bounds prompt size, diversifies content). */
export const SAMPLE_REFS = 40

/** Pick up to n refs using a partial Fisher–Yates with an injectable rng (default Math.random). */
export function sampleRefs(refs: string[], n: number, rng: () => number = Math.random): string[] {
  if (refs.length <= n) return refs.slice()
  const pool = refs.slice()
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
    out.push(pool[i])
  }
  return out
}

export function buildComposerPrompt(req: ComposeRequest, opts: { rng?: () => number } = {}): string {
  const c = req.catalog
  // Offer a FRESH random sample each call: bounded prompt + naturally endless variety.
  const all = req.track === 'options' ? c.chainAssets : [...c.candlesKeys, ...c.ohlcAssets]
  const refs = sampleRefs(all, SAMPLE_REFS, opts.rng)
  return [
    'You compose a single trading-practice SCENARIO as STRICT JSON. You are a curriculum designer, not a forecaster.',
    'HARD RULES — you NEVER break these:',
    '- NEVER predict a price, pick a stock as a recommendation, or give financial advice.',
    '- NEVER invent any market number (price, premium, Greek, P&L). You only REFERENCE real data by key.',
    '- The brief is teaching prose ONLY: a setup + an objective. It contains NO specific price/premium numbers.',
    '- Always teach the WHY; defer every traded number to the provided real data.',
    '',
    `Compose for track "${req.track}", tier ${req.tier}, account balance $${req.accountBalance}.`,
    'Reference ONLY ONE of these real data keys (pick the one that best fits the lesson you design):',
    refs.map((r) => `  - ${r}`).join('\n'),
    'Vary your choice and (for charts) the splitIndex/revealToIndex window so scenarios stay fresh.',
    `Use rubricId from: ${c.rubricIds.join(', ')}.`,
    `Use nudge ids from: ${c.nudgeIds.join(', ')}.`,
    '',
    'Return ONLY a JSON object with this shape (no markdown, no commentary):',
    '{',
    '  "id": "<unique-id>", "track": "' + req.track + '", "tier": ' + req.tier + ',',
    '  "title": "<short, neutral, no numbers>", "brief": "<2-3 sentences, no numbers>",',
    '  "dataRef": { ' + (req.track === 'options' ? '"chainAsset": "<one chain asset>", "decisionDate": "<its date>"' : '"candlesKey or ohlcAsset": "<one ref>", "splitIndex": <int>, "revealToIndex": <int>') + ' },',
    '  "objective": { "kind": "process", "passScore": 70 },',
    '  "constraints": { "accountBalance": ' + req.accountBalance + ', "maxRiskPct": ' + (req.track === 'options' ? 5 : 2) + (req.track === 'options' ? ', "requireDefinedRisk": true' : ', "requireStop": true, "minRewardRisk": 1.5') + ' },',
    `  "rubricId": "${req.track === 'options' ? 'options-v1' : 'charts-v1'}",`,
    '  "nudges": [ { "id": "<nudge>" } ], "coachContextKeys": ["outcome"], "source": "llm"',
    '}',
  ].join('\n')
}

/** Extract the first balanced JSON object from a model reply (tolerates fences/prose). */
export function parseComposerJson(text: string): unknown {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No JSON object in composer reply')
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1))
    }
  }
  throw new Error('Unbalanced JSON in composer reply')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/ai/composerPrompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/ai/composerPrompt.ts src/practice/ai/composerPrompt.test.ts
git commit -m "feat(practice): composer prompt builder + tolerant JSON parser"
```

---

## Task 3: Catalog-aware validation of composed specs

**Files:**
- Create: `src/practice/ai/validateComposed.ts`
- Test: `src/practice/ai/validateComposed.test.ts`

**Interfaces:**
- Consumes: `validateSpec` from `../validator`; `CANDLES`; `DataCatalog`.
- Produces: `validateComposed(raw, catalog) → { ok: boolean; spec?: ScenarioSpec; errors: string[] }`. Adds (a) catalog allow-list resolvers, (b) a numeric-claim lint that rejects price-like numbers in `brief`/`title` for `source:'llm'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/ai/validateComposed.test.ts
import { describe, it, expect } from 'vitest'
import { validateComposed } from './validateComposed'
import type { DataCatalog } from './types'
import { CANDLES } from '../../data/candles'

const key = Object.keys(CANDLES)[0]
// Literal catalog (buildCatalog is async/manifest-backed; the validator only needs the allow-lists).
const cat: DataCatalog = {
  track: 'charts', candlesKeys: [key], ohlcAssets: ['data/ohlc/SPY__1d.json'], chainAssets: [],
  rubricIds: ['charts-v1'], nudgeIds: ['sizing', 'no-stop'],
}
const good = {
  id: 'llm-1', track: 'charts', tier: 1, title: 'A pullback to a level',
  brief: 'Price has returned to a prior area of interest. Decide whether the setup is worth taking.',
  dataRef: { candlesKey: key, splitIndex: 5, revealToIndex: Math.min(CANDLES[key].length, 20) },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
  rubricId: 'charts-v1', nudges: [{ id: 'sizing' }], coachContextKeys: ['outcome'], source: 'llm',
}

describe('validateComposed', () => {
  it('accepts a spec that references only catalog keys and has no numbers in the brief', () => {
    const r = validateComposed(good, cat)
    expect(r.ok).toBe(true)
    expect(r.spec?.id).toBe('llm-1')
  })
  it('rejects a candlesKey not in the catalog allow-list', () => {
    const r = validateComposed({ ...good, dataRef: { ...good.dataRef, candlesKey: 'TOTALLY_FAKE' } }, cat)
    expect(r.ok).toBe(false)
  })
  it('rejects a brief that states a specific price (LLM may not invent numbers)', () => {
    const r = validateComposed({ ...good, brief: 'Buy the breakout above $182.50 for a move to $200.' }, cat)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/number/i)
  })
  it('rejects a disallowed-claim brief via the base validator', () => {
    const r = validateComposed({ ...good, brief: 'This will definitely rip higher — guaranteed.' }, cat)
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/ai/validateComposed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/ai/validateComposed.ts
import type { ScenarioSpec } from '../types'
import type { DataCatalog } from './types'
import { validateSpec } from '../validator'
import { CANDLES } from '../../data/candles'

/** Price-like number in prose, e.g. "$182.50", "182.5", "200" near $ — LLM briefs must avoid these. */
const NUMERIC_CLAIM = /\$\s?\d[\d,]*(\.\d+)?|\b\d{2,}(\.\d+)?\b/

export interface ComposedResult {
  ok: boolean
  spec?: ScenarioSpec
  errors: string[]
}

export function validateComposed(raw: unknown, catalog: DataCatalog): ComposedResult {
  const errors: string[] = []
  const spec = raw as ScenarioSpec
  if (!spec || typeof spec !== 'object') return { ok: false, errors: ['composed value is not an object'] }

  // Allow-list: the model may reference ONLY catalog members.
  const dr = spec.dataRef ?? {}
  if (dr.candlesKey && !catalog.candlesKeys.includes(dr.candlesKey)) errors.push(`candlesKey "${dr.candlesKey}" not in catalog`)
  if (dr.ohlcAsset && !catalog.ohlcAssets.includes(dr.ohlcAsset)) errors.push(`ohlcAsset "${dr.ohlcAsset}" not in catalog`)
  if (dr.chainAsset && !catalog.chainAssets.includes(dr.chainAsset)) errors.push(`chainAsset "${dr.chainAsset}" not in catalog`)
  if (spec.rubricId && !catalog.rubricIds.includes(spec.rubricId)) errors.push(`rubricId "${spec.rubricId}" not in catalog`)

  // Numeric-claim lint (LLM source only): no invented price numbers in prose.
  if (spec.source === 'llm') {
    if (NUMERIC_CLAIM.test(spec.brief ?? '')) errors.push('brief contains a numeric claim (LLM may not invent numbers)')
    if (NUMERIC_CLAIM.test(spec.title ?? '')) errors.push('title contains a numeric claim')
  }

  // Base deterministic validator with catalog-aware resolvers.
  const base = validateSpec(spec, {
    resolveCandles: (k) => CANDLES[k],
    assetExists: (p) => catalog.ohlcAssets.includes(p) || catalog.chainAssets.includes(p),
  })
  errors.push(...base.errors)

  return errors.length ? { ok: false, errors } : { ok: true, spec, errors: [] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/ai/validateComposed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/ai/validateComposed.ts src/practice/ai/validateComposed.test.ts
git commit -m "feat(practice): catalog-aware composed-spec validation + numeric-claim lint"
```

---

## Task 4: Composer pipeline (validate-loop → curated fallback)

**Files:**
- Create: `src/practice/ai/composer.ts`
- Test: `src/practice/ai/composer.test.ts`

**Interfaces:**
- Consumes: `ModelClient`, `ComposeRequest`; `buildComposerPrompt`/`parseComposerJson`; `validateComposed`; `scenariosFor` (curated fallback).
- Produces: `composeScenario(req, model, opts?) → Promise<{ spec, source: 'llm' | 'curated', attempts }>`; `MAX_COMPOSE_ATTEMPTS = 2`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/ai/composer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { composeScenario } from './composer'
import type { DataCatalog, ModelClient } from './types'
import { CANDLES } from '../../data/candles'

const key = Object.keys(CANDLES)[0]
// Literal catalog (buildCatalog is async/manifest-backed; composeScenario receives the catalog ready-made).
const catalog: DataCatalog = {
  track: 'charts', candlesKeys: [key], ohlcAssets: [], chainAssets: [],
  rubricIds: ['charts-v1'], nudgeIds: ['sizing'],
}
const req = { track: 'charts' as const, tier: 1, accountBalance: 10000, catalog }
const validJson = JSON.stringify({
  id: 'llm-ok', track: 'charts', tier: 1, title: 'A test setup', brief: 'A clean teaching setup with no numbers.',
  dataRef: { candlesKey: key, splitIndex: 3, revealToIndex: Math.min(CANDLES[key].length, 15) },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
  rubricId: 'charts-v1', nudges: [{ id: 'sizing' }], coachContextKeys: ['outcome'], source: 'llm',
})

const mock = (replies: string[]): ModelClient => {
  let i = 0
  return { generate: vi.fn().mockImplementation(async () => replies[Math.min(i++, replies.length - 1)]) }
}

describe('composeScenario', () => {
  it('returns the LLM spec when it validates on the first attempt', async () => {
    const res = await composeScenario(req, mock([validJson]))
    expect(res.source).toBe('llm')
    expect(res.spec.id).toBe('llm-ok')
    expect(res.attempts).toBe(1)
  })

  it('retries once on an invalid reply, then succeeds', async () => {
    const res = await composeScenario(req, mock(['garbage', validJson]))
    expect(res.source).toBe('llm')
    expect(res.attempts).toBe(2)
  })

  it('falls back to a curated scenario after two failures', async () => {
    const res = await composeScenario(req, mock(['nope', 'still nope']))
    expect(res.source).toBe('curated')
    expect(res.spec.track).toBe('charts')
  })

  it('falls back to curated when the model throws (offline)', async () => {
    const throwing: ModelClient = { generate: vi.fn().mockRejectedValue(new Error('offline')) }
    const res = await composeScenario(req, throwing)
    expect(res.source).toBe('curated')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/ai/composer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/ai/composer.ts
import type { ScenarioSpec } from '../types'
import type { ComposeRequest, ModelClient } from './types'
import { buildComposerPrompt, parseComposerJson } from './composerPrompt'
import { validateComposed } from './validateComposed'
import { scenariosFor } from '../scenarioRegistry'

export const MAX_COMPOSE_ATTEMPTS = 2

export interface ComposeResult {
  spec: ScenarioSpec
  source: 'llm' | 'curated'
  attempts: number
}

/** Compose a validated scenario; retry ≤ MAX, then fall back to a curated spec. */
export async function composeScenario(
  req: ComposeRequest,
  model: ModelClient,
  opts: { temperature?: number } = {},
): Promise<ComposeResult> {
  const prompt = buildComposerPrompt(req)
  for (let attempt = 1; attempt <= MAX_COMPOSE_ATTEMPTS; attempt++) {
    try {
      const reply = await model.generate(prompt, { temperature: opts.temperature ?? 0.8 })
      const raw = parseComposerJson(reply)
      const res = validateComposed(raw, req.catalog)
      if (res.ok && res.spec) return { spec: res.spec, source: 'llm', attempts: attempt }
    } catch {
      // fall through to next attempt / curated fallback
    }
  }
  const curated = pickCurated(req)
  return { spec: curated, source: 'curated', attempts: MAX_COMPOSE_ATTEMPTS }
}

function pickCurated(req: ComposeRequest): ScenarioSpec {
  const atTier = scenariosFor(req.track, req.tier)
  const pool = atTier.length ? atTier : scenariosFor(req.track)
  if (!pool.length) throw new Error(`No curated fallback for track ${req.track}`)
  return pool[Math.floor(Math.random() * pool.length)]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/ai/composer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/ai/composer.ts src/practice/ai/composer.test.ts
git commit -m "feat(practice): composer pipeline (validate-loop + curated fallback)"
```

---

## Task 5: Coach prompt + post-filter

**Files:**
- Create: `src/practice/ai/coachPrompt.ts`
- Test: `src/practice/ai/coachPrompt.test.ts`

**Interfaces:**
- Consumes: `CoachRequest`; `DISALLOWED_CLAIM_PATTERNS` from `../validator`.
- Produces: `buildCoachPrompt(req) → string`, `sanitizeCoachText(text, req) → { ok: boolean; reason?: string }`.

`sanitizeCoachText` rejects prose that (a) matches a disallowed-claim pattern, or (b) contains a `$`-number not present in `allowedFacts` (the coach may only cite whitelisted numbers).

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/ai/coachPrompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildCoachPrompt, sanitizeCoachText } from './coachPrompt'
import type { CoachRequest } from './types'

const req: CoachRequest = {
  spec: { objective: { passScore: 70 } } as never,
  decision: { took: true } as never,
  outcome: { pnl: -120, facts: { exit: 98 } },
  score: { total: 82, pnl: -120, dimensions: [], title: 't', detail: 'd' },
  nudgesFired: ['no-stop'],
  journal: { rationale: 'looked clean', feeling: 'confident' },
  allowedFacts: { pnl: -120, exit: 98, score: 82 },
}

describe('buildCoachPrompt', () => {
  it('includes the score, fired nudges, journal, and the whitelist instruction', () => {
    const p = buildCoachPrompt(req)
    expect(p).toMatch(/82/)
    expect(p).toMatch(/no-stop/)
    expect(p.toLowerCase()).toContain('only')
    expect(p.toLowerCase()).toContain('process')
  })
})

describe('sanitizeCoachText', () => {
  it('accepts prose that cites only whitelisted numbers', () => {
    expect(sanitizeCoachText('Good process despite the −$120 result; your exit at 98 was fine.', req).ok).toBe(true)
  })
  it('rejects an out-of-whitelist dollar number', () => {
    expect(sanitizeCoachText('You could have made $5,000 by holding to 130.', req).ok).toBe(false)
  })
  it('rejects a prediction/advice claim', () => {
    expect(sanitizeCoachText('Next time buy now — it will definitely rebound.', req).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/ai/coachPrompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/ai/coachPrompt.ts
import type { CoachRequest } from './types'
import { DISALLOWED_CLAIM_PATTERNS } from '../validator'

export function buildCoachPrompt(req: CoachRequest): string {
  const facts = Object.entries(req.allowedFacts).map(([k, v]) => `  ${k}: ${v}`).join('\n')
  return [
    'You are a calm, plain-spoken trading coach. You explain WHY a decision scored as it did. You teach process.',
    'HARD RULES:',
    '- NEVER predict prices, recommend trades, or give financial advice.',
    '- You may ONLY mention numbers that appear in the FACTS block below. Do not introduce any other number.',
    '- 2–4 sentences, warm and direct, one analogy max, no hype.',
    '',
    `Process score: ${req.score.total}/100 (pass ≥ ${req.spec.objective.passScore}). Result P&L is in FACTS.`,
    `Nudges that fired: ${req.nudgesFired.join(', ') || 'none'}.`,
    req.journal ? `Learner wrote: "${req.journal.rationale}" feeling "${req.journal.feeling}".` : '',
    'Per-dimension: ' + req.score.dimensions.map((d) => `${d.label} ${Math.round(d.score * 100)}%`).join(', '),
    'FACTS (the ONLY numbers you may cite):',
    facts,
    '',
    'Write the debrief now.',
  ].filter(Boolean).join('\n')
}

/** Reject prose that predicts/advises or cites a number outside the whitelist. */
export function sanitizeCoachText(text: string, req: CoachRequest): { ok: boolean; reason?: string } {
  for (const re of DISALLOWED_CLAIM_PATTERNS) if (re.test(text)) return { ok: false, reason: `disallowed claim: ${re}` }
  const allowed = new Set(
    Object.values(req.allowedFacts).filter((v) => typeof v === 'number').map((v) => Math.abs(v as number)),
  )
  const nums = text.match(/\$\s?\d[\d,]*(\.\d+)?/g) ?? []
  for (const tok of nums) {
    const n = Math.abs(parseFloat(tok.replace(/[$,\s]/g, '')))
    if (![...allowed].some((a) => Math.abs(a - n) < 0.5)) return { ok: false, reason: `number $${n} not in whitelist` }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/ai/coachPrompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/ai/coachPrompt.ts src/practice/ai/coachPrompt.test.ts
git commit -m "feat(practice): coach prompt builder + whitelist/claim post-filter"
```

---

## Task 6: Coach pipeline (validated prose → curated fallback)

**Files:**
- Create: `src/practice/ai/coach.ts`
- Test: `src/practice/ai/coach.test.ts`

**Interfaces:**
- Consumes: `ModelClient`, `CoachRequest`; `buildCoachPrompt`/`sanitizeCoachText`; `curatedDebrief` from `../debrief`.
- Produces: `coachDebrief(req, model) → Promise<{ text: string; source: 'llm' | 'curated' }>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/ai/coach.test.ts
import { describe, it, expect, vi } from 'vitest'
import { coachDebrief } from './coach'
import type { CoachRequest, ModelClient } from './types'

const req: CoachRequest = {
  spec: { objective: { passScore: 70 } } as never,
  decision: { took: true } as never,
  outcome: { pnl: -120, facts: {} },
  score: { total: 82, pnl: -120, dimensions: [{ id: 'stop', label: 'Defined max loss', weight: 2, score: 1, note: 'ok' }], title: 't', detail: 'd' },
  nudgesFired: [], journal: undefined, allowedFacts: { pnl: -120 },
}

describe('coachDebrief', () => {
  it('uses clean LLM prose when it passes the post-filter', async () => {
    const model: ModelClient = { generate: vi.fn().mockResolvedValue('Good process on a −$120 result. Repeat it.') }
    const r = await coachDebrief(req, model)
    expect(r.source).toBe('llm')
    expect(r.text).toMatch(/good process/i)
  })
  it('falls back to curated prose when the LLM cites a forbidden number', async () => {
    const model: ModelClient = { generate: vi.fn().mockResolvedValue('You left $9,999 on the table.') }
    const r = await coachDebrief(req, model)
    expect(r.source).toBe('curated')
  })
  it('falls back to curated when the model throws', async () => {
    const model: ModelClient = { generate: vi.fn().mockRejectedValue(new Error('offline')) }
    expect((await coachDebrief(req, model)).source).toBe('curated')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/ai/coach.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/ai/coach.ts
import type { CoachRequest, ModelClient } from './types'
import { buildCoachPrompt, sanitizeCoachText } from './coachPrompt'
import { curatedDebrief } from '../debrief'
import type { Feeling } from '../types'

export async function coachDebrief(
  req: CoachRequest,
  model: ModelClient,
): Promise<{ text: string; source: 'llm' | 'curated' }> {
  try {
    const text = (await model.generate(buildCoachPrompt(req), { temperature: 0.5 })).trim()
    if (text && sanitizeCoachText(text, req).ok) return { text, source: 'llm' }
  } catch {
    // fall through
  }
  const journal = req.journal ? { rationale: req.journal.rationale, feeling: req.journal.feeling as Feeling } : undefined
  return { text: curatedDebrief(req.spec, req.decision, req.outcome, req.score, journal), source: 'curated' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/ai/coach.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/ai/coach.ts src/practice/ai/coach.test.ts
git commit -m "feat(practice): coach pipeline (validated LLM prose → curated fallback)"
```

---

## Task 7: Scenario prefetch queue (makes LLM content instant)

**Files:**
- Create: `src/practice/ai/scenarioQueue.ts`
- Test: `src/practice/ai/scenarioQueue.test.ts`

**Interfaces:**
- Consumes: an injected `compose: (track) => Promise<{ spec: ScenarioSpec }>` (the queue only needs `.spec`, so `ComposeResult` satisfies it as a superset; mockable with no model in tests).
- Produces: `makeScenarioQueue(compose, opts?) → ScenarioQueue` with `take(track) → Promise<ScenarioSpec>`, `prime(track) → void`, `ready(track) → number`; `QUEUE_SIZE = 2`. `take` returns a buffered spec instantly (and refills in the background); if the buffer is empty it composes one on demand (which itself has a curated fallback, so it always resolves fast) and then refills.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/ai/scenarioQueue.test.ts
import { describe, it, expect, vi } from 'vitest'
import { makeScenarioQueue } from './scenarioQueue'
import type { ScenarioSpec } from '../types'

const spec = (id: string): ScenarioSpec => ({ id, track: 'charts' } as ScenarioSpec)
const deferred = () => { let resolve!: (v: { spec: ScenarioSpec; source: 'llm' }) => void; const p = new Promise<{ spec: ScenarioSpec; source: 'llm' }>((r) => (resolve = r)); return { p, resolve } }
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('makeScenarioQueue', () => {
  it('prefetches QUEUE_SIZE scenarios in the background after prime', async () => {
    let n = 0
    const compose = vi.fn(async () => ({ spec: spec(`s${n++}`), source: 'llm' as const }))
    const q = makeScenarioQueue(compose, { size: 2 })
    q.prime('charts')
    await flush(); await flush()
    expect(q.ready('charts')).toBe(2)
    expect(compose).toHaveBeenCalledTimes(2)
  })

  it('take() returns a buffered spec INSTANTLY even if a fresh compose would hang', async () => {
    const slow = deferred()
    let calls = 0
    // first two composes resolve immediately to fill the buffer; later ones hang.
    const compose = vi.fn(async () => (calls++ < 2 ? { spec: spec(`ready${calls}`), source: 'llm' as const } : slow.p))
    const q = makeScenarioQueue(compose, { size: 2 })
    q.prime('charts')
    await flush(); await flush()
    const got = await q.take('charts') // resolves from buffer, NOT from the hanging compose
    expect(got.id).toMatch(/ready/)
  })

  it('take() composes on demand when the buffer is empty, then refills', async () => {
    let n = 0
    const compose = vi.fn(async () => ({ spec: spec(`d${n++}`), source: 'llm' as const }))
    const q = makeScenarioQueue(compose, { size: 2 })
    const got = await q.take('charts') // empty buffer → compose now
    expect(got.id).toBe('d0')
    await flush(); await flush()
    expect(q.ready('charts')).toBeGreaterThan(0) // refilled in background
  })

  it('never rejects even if compose throws (degrades silently)', async () => {
    const compose = vi.fn(async () => { throw new Error('boom') })
    const q = makeScenarioQueue(compose, { size: 2 })
    await expect(q.take('charts')).rejects.toThrow() // surfaced to caller, who falls back to curated
  })
})
```

> NOTE: the last test documents that `take`'s on-demand path propagates a throw; in practice the injected `compose` is `composeScenario`, which *already* returns a curated fallback instead of throwing, so callers never actually see a rejection. The queue stays dumb and deterministic.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/ai/scenarioQueue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/ai/scenarioQueue.ts
import type { ScenarioSpec, Track } from '../types'

export const QUEUE_SIZE = 2

export interface ScenarioQueue {
  /** Return the next ready spec (instant if buffered); refill in the background. */
  take(track: Track): Promise<ScenarioSpec>
  /** Kick off background composes to fill the buffer to `size`. */
  prime(track: Track): void
  /** How many specs are buffered for a track right now. */
  ready(track: Track): number
}

/** The queue only needs the spec; ComposeResult satisfies this as a superset. */
type Composed = { spec: ScenarioSpec }

export function makeScenarioQueue(
  compose: (track: Track) => Promise<Composed>,
  opts: { size?: number } = {},
): ScenarioQueue {
  const size = opts.size ?? QUEUE_SIZE
  const buffers: Partial<Record<Track, ScenarioSpec[]>> = {}
  const inflight: Partial<Record<Track, number>> = {}

  const buf = (t: Track) => (buffers[t] ??= [])
  const inflightOf = (t: Track) => inflight[t] ?? 0

  function fill(track: Track): void {
    while (buf(track).length + inflightOf(track) < size) {
      inflight[track] = inflightOf(track) + 1
      compose(track)
        .then((res) => buf(track).push(res.spec))
        .catch(() => { /* swallow background failures; on-demand take still works */ })
        .finally(() => { inflight[track] = inflightOf(track) - 1 })
    }
  }

  return {
    prime(track) { fill(track) },
    ready(track) { return buf(track).length },
    async take(track) {
      const b = buf(track)
      if (b.length > 0) {
        const spec = b.shift()!
        fill(track) // refill in the background
        return spec
      }
      // Buffer empty: compose one now (composeScenario has its own curated fallback), then refill.
      const res = await compose(track)
      fill(track)
      return res.spec
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/ai/scenarioQueue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/ai/scenarioQueue.ts src/practice/ai/scenarioQueue.test.ts
git commit -m "feat(practice): background scenario prefetch queue (instant LLM content)"
```

---

## Task 8: Firebase AI Logic model client + LLM-primary wiring

**Files:**
- Create: `src/services/aiModel.ts`
- Modify: `src/state/PracticeContext.tsx`, `src/practice/ScenarioPlayer.tsx`
- Test: (none for the network client — untested I/O like `userService`; orchestration + queue are covered)

**Interfaces:**
- Produces: `getModelClient() → ModelClient | null` (null when AI is not configured → curated-only mode). Makes `nextScenario` **LLM-primary** via the prefetch queue, and wires `coachDebrief` into the player's debrief.

- [ ] **Step 1: Write the Firebase AI Logic client**

```ts
// src/services/aiModel.ts
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { initializeApp, getApps } from 'firebase/app'
import type { ModelClient } from '../practice/ai/types'

/**
 * Firebase AI Logic (Gemini) ModelClient. Uses the Firebase backend + App Check — no
 * provider key in the client bundle. Returns null if AI Logic is not enabled, so the
 * app runs curated-only (instant + free) with zero errors.
 *
 * For a HARD server boundary instead, implement ModelClient.generate to call a
 * Cloud Functions callable (httpsCallable) that runs the model + validateSpec
 * server-side and returns the result. The orchestration (composer/coach) is identical.
 */
let cached: ModelClient | null | undefined

export function getModelClient(): ModelClient | null {
  if (cached !== undefined) return cached
  try {
    const app = getApps()[0] ?? initializeApp({}) // reuse the app from src/lib/firebase
    const ai = getAI(app, { backend: new GoogleAIBackend() })
    const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' })
    cached = {
      async generate(prompt, opts) {
        const res = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: opts?.temperature ?? 0.7, maxOutputTokens: opts?.maxTokens ?? 700 },
        })
        return res.response.text()
      },
    }
  } catch (e) {
    console.warn('Firebase AI Logic unavailable — Practice runs curated-only.', e)
    cached = null
  }
  return cached
}
```

> NOTE: confirm the exact `firebase/ai` import surface for the installed firebase version (`npm ls firebase`) — the symbols `getAI`/`getGenerativeModel`/`GoogleAIBackend` are correct for firebase ≥ 11.x AI Logic; adjust if the installed minor differs. Enable Firebase AI Logic + App Check in the console per the firebase-ai-logic-basics skill before this returns non-null.

- [ ] **Step 2: Make `nextScenario` LLM-primary via the prefetch queue**

In `src/state/PracticeContext.tsx`, the M1 `nextScenario` returned a curated spec synchronously. Replace it with an **async, LLM-primary** `nextScenario` backed by the queue. Curated is now only the cold-start (empty buffer, first call) and the automatic fallback inside `composeScenario`.

```tsx
import { getModelClient } from '../services/aiModel'
import { composeScenario, type ComposeResult } from '../practice/ai/composer'
import { makeScenarioQueue } from '../practice/ai/scenarioQueue'
import { buildCatalog } from '../practice/ai/catalog'
import { scenariosFor } from '../practice/scenarioRegistry'

// One queue per provider instance. compose() is LLM when a model exists, else curated.
const queue = useMemo(() => {
  const model = getModelClient()
  const compose = async (track: Track): Promise<ComposeResult> => {
    const tier = accountRef.current.tier[track]
    const balance = accountRef.current.balance
    if (!model) {
      const pool = scenariosFor(track, tier).length ? scenariosFor(track, tier) : scenariosFor(track)
      return { spec: pool[Math.floor(Math.random() * pool.length)], source: 'curated', attempts: 0 }
    }
    // buildCatalog reads the full ingested manifests (cached after the first call).
    const catalog = await buildCatalog(track)
    return composeScenario({ track, tier, accountBalance: balance, catalog }, model)
  }
  return makeScenarioQueue(compose)
}, [])

// LLM-primary: take from the queue (instant if prefetched; composes on demand otherwise).
const nextScenario = useCallback(async (track: Track = 'charts'): Promise<ScenarioSpec> => {
  return queue.take(track)
}, [queue])

// Warm the queue for a track (call on track-card hover/select and after each take).
const primeScenarios = useCallback((track: Track = 'charts') => queue.prime(track), [queue])
```

Expose the now-async `nextScenario`, `primeScenarios`, and `aiEnabled: getModelClient() !== null` in the context value + `PracticeValue` interface. Update every caller of `nextScenario` (M1 `PracticePage`/`ScenarioPlayerPage`) to `await` it (show a brief "Composing your scenario…" state only on the rare cold-start path where the buffer is empty). Call `primeScenarios(track)` when the learner lands on a track so the first real scenario is usually already an LLM one.

- [ ] **Step 3: Wire coach into the player debrief**

In `src/practice/ScenarioPlayer.tsx`, replace the synchronous `curatedDebrief(...)` render with an effect that calls `coachDebrief` (with a curated fallback already built in) once `result` is set:

```tsx
import { coachDebrief } from './ai/coach'
import { getModelClient } from '../services/aiModel'
// ...
const [debrief, setDebrief] = useState<string>('')
useEffect(() => {
  if (phase !== 'resolved' || !result) return
  const model = getModelClient()
  const allowedFacts = { pnl: result.outcome.pnl, ...result.outcome.facts }
  if (!model) {
    setDebrief(curatedDebrief(spec, decisionRef.current as Decision, result.outcome, result.score, journal ?? undefined))
    return
  }
  let active = true
  coachDebrief(
    { spec, decision: decisionRef.current as Decision, outcome: result.outcome, score: result.score,
      nudgesFired: firedNudges, journal: journal ?? undefined, allowedFacts },
    model,
  ).then((r) => active && setDebrief(r.text))
  return () => { active = false }
}, [phase, result, spec, firedNudges, journal])
// render {debrief} instead of the inline curatedDebrief(...) call
```

Because `nextScenario` is now LLM-primary, the normal "Start scenario" / "Next scenario" buttons already produce bespoke AI content — no separate "Generate" button is needed. Optionally keep a small "Shuffle a fresh one" affordance that just calls `nextScenario(track)` again. Ensure the Practice page calls `primeScenarios(track)` on mount/track-select so the queue is warm before the learner clicks.

- [ ] **Step 4: Install/confirm firebase AI + typecheck**

Run: `npm ls firebase` (confirm ≥ 11). If `firebase/ai` types are missing, run `npm i firebase@latest`.
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiModel.ts src/state/PracticeContext.tsx src/practice/ScenarioPlayer.tsx
git commit -m "feat(practice): Firebase AI Logic client + composer/coach wiring (curated fallback)"
```

---

## Task 9: M3 exit check

**Files:** (none — verification)

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green; **no test calls a model** (all use mock `ModelClient`).

- [ ] **Step 2: Manual exit criteria (PRDphase2 §17 M3 row)**

With AI Logic enabled:
1. **LLM is the default:** landing on a track warms the queue; the normal "Start scenario" button yields a **bespoke LLM-composed** scenario (verify `source === 'llm'`), and back-to-back plays keep producing distinct AI scenarios with no perceived wait (the queue prefetched them).
2. **Endless + grounded:** repeated scenarios vary in framing/objective/slice yet every data ref resolves to real data (they came from the catalog + passed `validateComposed`).
3. **Silent fallback:** force two bad replies (temporarily stub the model) → the learner still gets a playable curated scenario with no error surfaced; restoring the model returns to LLM content.
4. The debrief is LLM prose when it passes the post-filter; injecting a forbidden number in the reply makes it fall back to curated.
With AI Logic disabled: everything still works curated-only, instant, no errors.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(practice): M3 LLM composer + coach green (guardrailed, fallback-safe)"
```

---

## Self-Review

**1. Spec coverage (PRDphase2 §8 pipeline, §13 guardrails, §18 risks):** The **LLM is the primary content engine** — `nextScenario` is LLM-composed by default via the prefetch queue, giving effectively endless bespoke scenarios; curated is demoted to cold-start + silent fallback only. Composer emits a `ScenarioSpec` of references only, validated + retried + curated-fallback → composer.ts. Variety = catalog (all real data) × slice × framing × tier, grounded by `validateComposed`. Coach constrained to whitelist with post-filter + fallback → coach.ts. Two call sites only. Latency hidden by the prefetch queue; cost bounded by ≤2 calls/scenario + optional session cap. Determinism: all orchestration + queue tested with a mock `compose`/`ModelClient`; CI never calls a model. Server-boundary option documented (callable). ✓

**2. Placeholder scan:** The catalog reads the **full ingested manifests** (`public/data/manifest.json` + `options-manifest.json`) — no hardcoded subset — so variety scales with the corpus. The only flagged item is the `firebase/ai` import surface (exact verification step given), not a TBD. No "implement later" in any code step. ✓

**3. Type consistency:** `ModelClient.generate(prompt, opts?)` used identically in composer/coach/aiModel. `validateComposed(raw, catalog)` returns `{ ok, spec?, errors }` consumed by composer. `makeScenarioQueue(compose, opts?)` consumes `composeScenario`'s `ComposeResult` and yields the async `nextScenario`. `CoachRequest.allowedFacts` drives both `buildCoachPrompt` and `sanitizeCoachText`. `composeScenario`/`coachDebrief` signatures match their PracticeContext/player call sites. Reuses M0 `validateSpec`/`DISALLOWED_CLAIM_PATTERNS`/`scenariosFor`, M1 `curatedDebrief`. ✓

**Carried interfaces M4+ rely on:** `getModelClient`, `composeScenario`/`ComposeResult`, `makeScenarioQueue`/`ScenarioQueue`, `coachDebrief`, `buildCatalog`, `usePractice().nextScenario` (now async, LLM-primary)/`primeScenarios`/`aiEnabled`.
