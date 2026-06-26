# Practice Mode — M6: Polish (Analytics, A11y/Reduced-Motion, Copy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Practice shippable — lightweight, privacy-respecting **analytics** to learn what teaches; a thorough **accessibility + reduced-motion** pass (the scenes already inherit `ModuleScene.reduceMotion`; finish the React surfaces and keyboard paths); and a **copy pass** that makes the educational framing, "illustrative vs exact" labels, and not-financial-advice disclaimer consistent and unmissable.

**Architecture:** Keep it additive. Analytics is a pure event-builder + an injectable sink (Firestore in prod, no-op/console in dev/tests). A11y is hook-driven (`useReducedMotion`) plus aria/focus fixes in `ScenarioPlayer`/`Journal`/`PracticePage`. Copy is centralized in `src/practice/copy.ts` so disclaimers and illustrative labels can't drift. A small pure `summarizePractice(runs)` powers a stats panel.

**Tech Stack:** Same as M0–M5. No new deps.

## Global Constraints

- (All M0–M5 Global Constraints apply.) `npm run typecheck` + `npm test` + `npm run build` green at the end.
- **Honesty in the UI (PRDphase2 §10, §16):** every screen that shows simulated elements carries an "illustrative; math exact" label driven by `spec.illustrativeFlags`, and a persistent "Paper trading for education — not financial advice" disclaimer.
- **A11y baseline:** keyboard-operable controls, visible focus, labelled inputs, sufficient contrast, and full respect for `prefers-reduced-motion` (scenes already; finish React).
- **Privacy:** analytics records learning signals (track, tier, score, nudge ids, source) — never PII beyond the existing auth uid scope, and writes go under the user's own document tree (Firestore rules already restrict it).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/practice/analytics.ts` (+ `.test.ts`) | Pure event builders + `PracticeAnalytics` with an injectable sink. |
| `src/services/analyticsSink.ts` (new) | Firestore sink (untested I/O); no-op fallback when signed out. |
| `src/hooks/useReducedMotion.ts` (+ `.test.ts`) | React reduced-motion hook (mirrors `ModuleScene.reduceMotion`). |
| `src/practice/copy.ts` (+ `.test.ts`) | Central disclaimers, illustrative-label builder, track blurbs. |
| `src/practice/summary.ts` (+ `.test.ts`) | Pure `summarizePractice(runs)` for the stats panel. |
| `src/practice/PracticeStats.tsx` (new) | Stats panel (runs, avg process score/track, ruin events). |
| `src/components/Disclaimer.tsx` (new) | Persistent not-financial-advice banner. |
| `src/practice/ScenarioPlayer.tsx` (modify) | Emit analytics; aria/focus; illustrative labels; disclaimer. |
| `src/practice/Journal.tsx` (modify) | Labelled fields, focus management, keyboard submit. |
| `src/pages/PracticePage.tsx` (modify) | Mount stats panel + disclaimer; analytics on track select. |
| `docs/superpowers/plans/README.md` (new) | Plans index (M0–M6, status, dependency order). |

---

## Task 1: Analytics event builders + emitter

**Files:**
- Create: `src/practice/analytics.ts`
- Test: `src/practice/analytics.test.ts`

**Interfaces:**
- Produces: `PracticeEvent` (discriminated union), builders `evScenarioStarted/evDecision/evNudge/evCompleted/evReset`, and `class PracticeAnalytics` taking `{ sink, now? }` with `emit(event)` (stamps `ts`, swallows sink errors). Sink: `(e: PracticeEvent & { ts: number }) => void | Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/analytics.test.ts
import { describe, it, expect, vi } from 'vitest'
import { PracticeAnalytics, evScenarioStarted, evCompleted } from './analytics'

describe('analytics event builders', () => {
  it('builds a typed scenario_started event', () => {
    expect(evScenarioStarted({ specId: 's', track: 'charts', tier: 2, source: 'llm' }))
      .toEqual({ type: 'scenario_started', specId: 's', track: 'charts', tier: 2, source: 'llm' })
  })
  it('builds a scenario_completed event with score + pnl', () => {
    const e = evCompleted({ specId: 's', track: 'charts', tier: 1, score: 80, pnl: -50, nudgesFired: ['sizing'] })
    expect(e.type).toBe('scenario_completed')
    expect(e.score).toBe(80)
  })
})

describe('PracticeAnalytics.emit', () => {
  it('stamps a timestamp and forwards to the sink', async () => {
    const sink = vi.fn()
    const a = new PracticeAnalytics({ sink, now: () => 123 })
    await a.emit(evScenarioStarted({ specId: 's', track: 'charts', tier: 1, source: 'curated' }))
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ type: 'scenario_started', ts: 123 }))
  })
  it('never throws when the sink fails (analytics must not break practice)', async () => {
    const a = new PracticeAnalytics({ sink: () => { throw new Error('offline') } })
    await expect(a.emit(evScenarioStarted({ specId: 's', track: 'charts', tier: 1, source: 'curated' }))).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/analytics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/analytics.ts
import type { Track } from './types'

export type PracticeEvent =
  | { type: 'scenario_started'; specId: string; track: Track; tier: number; source: 'curated' | 'llm' }
  | { type: 'decision_submitted'; specId: string; track: Track; tier: number }
  | { type: 'nudge_fired'; specId: string; track: Track; nudgeId: string }
  | { type: 'scenario_completed'; specId: string; track: Track; tier: number; score: number; pnl: number; nudgesFired: string[] }
  | { type: 'reset_and_reflect'; ruinEvents: number }

export const evScenarioStarted = (p: Omit<Extract<PracticeEvent, { type: 'scenario_started' }>, 'type'>): PracticeEvent => ({ type: 'scenario_started', ...p })
export const evDecision = (p: Omit<Extract<PracticeEvent, { type: 'decision_submitted' }>, 'type'>): PracticeEvent => ({ type: 'decision_submitted', ...p })
export const evNudge = (p: Omit<Extract<PracticeEvent, { type: 'nudge_fired' }>, 'type'>): PracticeEvent => ({ type: 'nudge_fired', ...p })
export const evCompleted = (p: Omit<Extract<PracticeEvent, { type: 'scenario_completed' }>, 'type'>): PracticeEvent => ({ type: 'scenario_completed', ...p })
export const evReset = (p: Omit<Extract<PracticeEvent, { type: 'reset_and_reflect' }>, 'type'>): PracticeEvent => ({ type: 'reset_and_reflect', ...p })

export type AnalyticsSink = (e: PracticeEvent & { ts: number }) => void | Promise<void>

export class PracticeAnalytics {
  private sink: AnalyticsSink
  private now: () => number
  constructor(opts: { sink: AnalyticsSink; now?: () => number }) {
    this.sink = opts.sink
    this.now = opts.now ?? Date.now
  }
  async emit(event: PracticeEvent): Promise<void> {
    try {
      await this.sink({ ...event, ts: this.now() })
    } catch {
      // analytics must never break practice
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/analytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/analytics.ts src/practice/analytics.test.ts
git commit -m "feat(practice): privacy-light analytics event builders + safe emitter"
```

---

## Task 2: Firestore analytics sink (untested I/O)

**Files:**
- Create: `src/services/analyticsSink.ts`

**Interfaces:**
- Produces: `firestoreSink(uid) → AnalyticsSink` (writes to `users/{uid}/practiceEvents`); `noopSink: AnalyticsSink`. Network code is untested (like `userService`); the emitter that uses it is fully tested.

- [ ] **Step 1: Write the sink**

```ts
// src/services/analyticsSink.ts
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AnalyticsSink, PracticeEvent } from '../practice/analytics'

export const noopSink: AnalyticsSink = () => {}

/** Append practice events under the signed-in user's own document tree. */
export function firestoreSink(uid: string): AnalyticsSink {
  return async (e: PracticeEvent & { ts: number }) => {
    await addDoc(collection(db, 'users', uid, 'practiceEvents'), e)
  }
}
```

- [ ] **Step 2: Add a Firestore rule for the events subcollection**

In `firestore.rules`, inside `match /users/{uid}`, add (create-only, owner-only, immutable):

```
match /practiceEvents/{eventId} {
  allow read: if isOwner(uid);
  allow create: if isOwner(uid) && request.resource.data.ts is int && request.resource.data.type is string;
  allow update, delete: if false;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/analyticsSink.ts firestore.rules
git commit -m "feat(practice): Firestore analytics sink + owner-only event rules"
```

---

## Task 3: React reduced-motion hook

**Files:**
- Create: `src/hooks/useReducedMotion.ts`
- Test: `src/hooks/useReducedMotion.test.ts`

**Interfaces:**
- Produces: `useReducedMotion(): boolean` — reads `(prefers-reduced-motion: reduce)`, subscribes to changes, SSR/no-`matchMedia` safe (returns `false`). Mirrors the scene-side `ModuleScene.reduceMotion` for React components.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useReducedMotion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('useReducedMotion', () => {
  beforeEach(() => vi.unstubAllGlobals())
  it('returns true when the user prefers reduced motion', () => {
    mockMatchMedia(true)
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true)
  })
  it('returns false otherwise', () => {
    mockMatchMedia(false)
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false)
  })
})
```

> If `@testing-library/react` is not installed, this test is the trigger to add it (`npm i -D @testing-library/react`); it's the standard React testing helper and is used only in tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useReducedMotion.test.ts`
Expected: FAIL — module not found (and/or install the lib).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useReducedMotion.ts
import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useReducedMotion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useReducedMotion.ts src/hooks/useReducedMotion.test.ts
git commit -m "feat(a11y): React useReducedMotion hook (parity with scene reduceMotion)"
```

---

## Task 4: Central copy + illustrative labels

**Files:**
- Create: `src/practice/copy.ts`
- Test: `src/practice/copy.test.ts`

**Interfaces:**
- Consumes: `ScenarioSpec`, `Track`.
- Produces: `DISCLAIMER` (string), `TRACK_BLURB: Record<Track, string>`, `illustrativeLabel(spec) → string | null` (from `spec.illustrativeFlags`), `FEELING_LABEL: Record<Feeling, string>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/copy.test.ts
import { describe, it, expect } from 'vitest'
import { DISCLAIMER, TRACK_BLURB, illustrativeLabel } from './copy'
import type { ScenarioSpec } from './types'

describe('practice copy', () => {
  it('disclaimer makes the educational, not-advice framing explicit', () => {
    expect(DISCLAIMER.toLowerCase()).toContain('not financial advice')
    expect(DISCLAIMER.toLowerCase()).toContain('paper')
  })
  it('has a blurb for every track', () => {
    expect(TRACK_BLURB.charts).toBeTruthy()
    expect(TRACK_BLURB.options).toBeTruthy()
    expect(TRACK_BLURB['market-making']).toBeTruthy()
  })
  it('builds an illustrative label only when flags exist', () => {
    const base = { illustrativeFlags: undefined } as unknown as ScenarioSpec
    expect(illustrativeLabel(base)).toBeNull()
    const withFlags = { illustrativeFlags: ['orderFlow'] } as unknown as ScenarioSpec
    expect(illustrativeLabel(withFlags)!.toLowerCase()).toContain('illustrative')
    expect(illustrativeLabel(withFlags)!.toLowerCase()).toContain('exact')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/copy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/copy.ts
import type { Feeling, ScenarioSpec, Track } from './types'

export const DISCLAIMER =
  'Paper trading for education only. Scenarios use real historical data; outcomes are not predictions and this is not financial advice.'

export const TRACK_BLURB: Record<Track, string> = {
  charts: 'Read a real chart, define your risk, and trade a pattern. Graded on process, not luck.',
  options: 'Build a defined-risk options position from a real chain and manage it to expiry.',
  'market-making': 'Quote a two-sided market over a real session. Earn the spread, manage inventory and adverse selection.',
}

export const FEELING_LABEL: Record<Feeling, string> = {
  confident: 'Confident', anxious: 'Anxious', fomo: 'FOMO', revenge: 'Revenge', calm: 'Calm',
}

const FLAG_LABEL: Record<string, string> = {
  orderFlow: 'order flow',
  ladder: 'order book',
  earlyClose: 'mid-life option pricing',
}

/** A short "illustrative; math exact" label for any simulated elements in this spec. */
export function illustrativeLabel(spec: ScenarioSpec): string | null {
  const flags = spec.illustrativeFlags
  if (!flags || flags.length === 0) return null
  const parts = flags.map((f) => FLAG_LABEL[f] ?? f)
  return `Illustrative ${parts.join(' & ')} — the arithmetic shown is exact.`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/copy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/copy.ts src/practice/copy.test.ts
git commit -m "feat(practice): central copy — disclaimer, track blurbs, illustrative labels"
```

---

## Task 5: Practice summary aggregation + stats panel

**Files:**
- Create: `src/practice/summary.ts`, `src/practice/PracticeStats.tsx`
- Test: `src/practice/summary.test.ts`

**Interfaces:**
- Consumes: `PracticeRun`, `Track`.
- Produces: `summarizePractice(runs) → { totalRuns; avgScoreByTrack: Partial<Record<Track, number>>; bestScore; lastPlayedTs }`. `PracticeStats` renders it.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/summary.test.ts
import { describe, it, expect } from 'vitest'
import { summarizePractice } from './summary'
import type { PracticeRun } from './types'

const run = (track: PracticeRun['track'], score: number, ts: number): PracticeRun => ({
  specId: 's', track, tier: 1, decision: {} as never, nudgesFired: [], score, breakdown: [], pnl: 0,
  journal: { rationale: '', feeling: 'calm' }, createdAt: ts,
})

describe('summarizePractice', () => {
  it('counts runs and averages process score per track', () => {
    const s = summarizePractice([run('charts', 80, 2), run('charts', 60, 1), run('options', 90, 3)])
    expect(s.totalRuns).toBe(3)
    expect(s.avgScoreByTrack.charts).toBe(70)
    expect(s.avgScoreByTrack.options).toBe(90)
    expect(s.bestScore).toBe(90)
    expect(s.lastPlayedTs).toBe(3)
  })
  it('handles an empty history', () => {
    const s = summarizePractice([])
    expect(s.totalRuns).toBe(0)
    expect(s.bestScore).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/summary.ts
import type { PracticeRun, Track } from './types'

export interface PracticeSummary {
  totalRuns: number
  avgScoreByTrack: Partial<Record<Track, number>>
  bestScore: number
  lastPlayedTs: number
}

export function summarizePractice(runs: PracticeRun[]): PracticeSummary {
  const byTrack: Partial<Record<Track, { sum: number; n: number }>> = {}
  let best = 0
  let last = 0
  for (const r of runs) {
    const acc = (byTrack[r.track] ??= { sum: 0, n: 0 })
    acc.sum += r.score
    acc.n += 1
    if (r.score > best) best = r.score
    if (r.createdAt > last) last = r.createdAt
  }
  const avgScoreByTrack: Partial<Record<Track, number>> = {}
  for (const [t, acc] of Object.entries(byTrack)) avgScoreByTrack[t as Track] = Math.round(acc!.sum / acc!.n)
  return { totalRuns: runs.length, avgScoreByTrack, bestScore: best, lastPlayedTs: last }
}
```

Then write `PracticeStats.tsx` rendering `summarizePractice(recentRuns)` + `account.ruinEvents` + per-track tier/skill rings (reuse existing ring/Badge components). Keep it presentational.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/summary.ts src/practice/summary.test.ts src/practice/PracticeStats.tsx
git commit -m "feat(practice): practice summary aggregation + stats panel"
```

---

## Task 6: Wire analytics, a11y, copy into the UI

**Files:**
- Create: `src/components/Disclaimer.tsx`
- Modify: `src/practice/ScenarioPlayer.tsx`, `src/practice/Journal.tsx`, `src/pages/PracticePage.tsx`, `src/state/PracticeContext.tsx`

**Interfaces:**
- Produces: analytics emission at scenario start / decision / nudge / completion / reset; `Disclaimer` on all practice screens; illustrative labels in the player; accessible Journal + player controls.

- [ ] **Step 1: Build the analytics instance in PracticeContext**

In `src/state/PracticeContext.tsx`:

```tsx
import { PracticeAnalytics } from '../practice/analytics'
import { firestoreSink, noopSink } from '../services/analyticsSink'
const analytics = useMemo(
  () => new PracticeAnalytics({ sink: user ? firestoreSink(user.uid) : noopSink }),
  [user],
)
// expose `analytics` on the context value; emit evReset inside resetAndReflect.
```

- [ ] **Step 2: Emit events + labels + a11y in the player**

In `src/practice/ScenarioPlayer.tsx`:
- On mount/spec load: `analytics.emit(evScenarioStarted({ specId: spec.id, track: spec.track, tier: spec.tier, source: spec.source }))`.
- On the bus `decision` event: `analytics.emit(evDecision({ specId, track, tier }))`.
- On the bus `nudge` event: `analytics.emit(evNudge({ specId, track, nudgeId: id }))`.
- On result: `analytics.emit(evCompleted({ specId, track, tier, score: result.score.total, pnl: result.outcome.pnl, nudgesFired: firedNudges }))`.
- Render `illustrativeLabel(spec)` (if non-null) as a small badge near the canvas; render `<Disclaimer />` at the bottom.
- A11y: ensure the phase region uses `aria-live="polite"` so screen readers hear "journal", "result"; buttons have discernible text; the debrief container is focusable and focused when shown.

- [ ] **Step 3: Accessible Journal**

In `src/practice/Journal.tsx`: associate `<label htmlFor>` with each control, give the feeling chips `role="radiogroup"`/`role="radio"` + keyboard selection, autofocus the rationale field, and allow Ctrl/Cmd+Enter to submit. Use `FEELING_LABEL` from copy.

- [ ] **Step 4: Practice page — stats, disclaimer, analytics on select**

In `src/pages/PracticePage.tsx`: mount `<PracticeStats />` and `<Disclaimer />`; use `TRACK_BLURB` for the card copy. (Track selection analytics is implied by `scenario_started`.)

- [ ] **Step 5: Disclaimer component**

```tsx
// src/components/Disclaimer.tsx
import { DISCLAIMER } from '../practice/copy'
export default function Disclaimer() {
  return (
    <p role="note" className="mx-auto max-w-2xl px-4 py-3 text-center text-xs text-muted">
      {DISCLAIMER}
    </p>
  )
}
```

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/Disclaimer.tsx src/practice/ScenarioPlayer.tsx src/practice/Journal.tsx src/pages/PracticePage.tsx src/state/PracticeContext.tsx
git commit -m "feat(practice): wire analytics, disclaimers, illustrative labels, a11y into UI"
```

---

## Task 7: Plans index

**Files:**
- Create: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Write the index**

```md
# Practice Mode — Implementation Plans (M0–M6)

Build order is strict: each milestone depends on the prior. Every plan is TDD, with
`npm test` + `npm run typecheck` green at each commit. Tests never hit the network or a model.

| Milestone | Plan | Delivers | Depends on |
|---|---|---|---|
| M0 | `2026-06-25-practice-m0-foundations.md` | Types, validator, registry, account reducer, PracticeContext, routes, Firestore rules | — |
| M1 | `2026-06-25-practice-m1-track-a-charts.md` | Track A charts: scene, resolver, rubric, nudges, journal, debrief, player | M0 |
| M2 | `2026-06-25-practice-m2-track-c-options.md` | Track C options: chain loader, BS, resolver, rubric, TrackEngine, OptionsBuildScene | M0, M1 |
| M3 | `2026-06-25-practice-m3-llm-composer-coach.md` | LLM composer + coach behind validator loop with curated fallback | M0–M2 |
| M4 | `2026-06-25-practice-m4-adaptive-difficulty.md` | Tier hysteresis + $1k coached reset-and-reflect | M0–M3 |
| M5 | `2026-06-25-practice-m5-track-b-market-making.md` | Track B market making: book stats, session sim, rubric, scene | M0–M2 (engine) |
| M6 | `2026-06-25-practice-m6-polish.md` | Analytics, a11y/reduced-motion, copy/disclaimers, stats panel | M0–M5 |

Source spec: `planning/PRDphase2.md`.

## Conventions
- Pure modules (types, reducers, validators, resolvers, rubrics) get full red→green TDD.
- Phaser scenes get wiring smoke tests (mocked Phaser); UI integration is manual-smoke + tested pure logic.
- The model is never the source of a traded number: numbers flow LLM → (text + refs) → validator → real data → sim → grader → LLM (text).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/README.md
git commit -m "docs(practice): plans index (M0–M6)"
```

---

## Task 8: M6 exit check (release gate)

**Files:** (none — verification)

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 2: Manual exit criteria (PRDphase2 §16, §17 M6 row)**

1. **Analytics:** completing a scenario writes a `scenario_completed` event under `users/{uid}/practiceEvents` (verify in the Firestore console); signed-out/dev uses the no-op sink and never errors.
2. **Reduced motion:** with OS "reduce motion" on, scenes are static (already via `ModuleScene`) and React transitions are instant (`useReducedMotion`).
3. **A11y:** the whole flow (select track → play → journal → result) is keyboard-only operable with visible focus; the journal feelings are a keyboard radiogroup; the result is announced.
4. **Copy:** every practice screen shows the not-financial-advice disclaimer; simulated elements (e.g. MM order flow, mid-life option pricing) show the "illustrative; math exact" label.
5. **Stats:** the Practice page shows run count, avg process score per track, best score, and ruin events, updating after a run.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore(practice): M6 polish complete — analytics, a11y, copy, stats green"
```

---

## Self-Review

**1. Spec coverage (PRDphase2 §16 polish, §10 honesty, §17 M6):** Analytics (pure builders + safe emitter + Firestore sink + rules). A11y (React `useReducedMotion` to match scene-side; aria/focus/keyboard in Journal + player; scenes already reduced-motion via `ModuleScene`). Copy (central disclaimer + illustrative labels surfaced everywhere). Stats panel from pure aggregation. Plans index. ✓

**2. Placeholder scan:** `PracticeStats.tsx`/UI wiring describe concrete element changes against named existing components; `analyticsSink`/`Disclaimer` are complete. The only untested file is the Firestore sink (I/O, by policy). No logic TBDs. ✓

**3. Type consistency:** `PracticeEvent` union + builders consumed by `PracticeAnalytics.emit` and the sink; `AnalyticsSink` signature shared by `firestoreSink`/`noopSink`/emitter. `summarizePractice(runs) → PracticeSummary` consumed by `PracticeStats`. `illustrativeLabel(spec)`/`TRACK_BLURB`/`DISCLAIMER` consumed by player/page/Disclaimer. Reuses M0 `PracticeRun`/`Track`/`Feeling`, M5 `illustrativeFlags`, M4 `evReset`/`ruinEvents`, and the existing `ModuleScene.reduceMotion`. ✓

**This completes M0–M6.** The full Practice feature from `planning/PRDphase2.md` is now specified as seven TDD-ready, dependency-ordered implementation plans.
