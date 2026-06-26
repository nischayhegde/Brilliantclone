# Practice Mode — M4: Adaptive Difficulty + Reset-and-Reflect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make complexity scale with **skill, not luck** (tier up/down on the rolling process score with hysteresis), and turn the seed's hard "< $1,000 = fail" into a **coached reset-and-reflect** that diagnoses what blew up the account, drops a tier, refills to $10k, and counts the ruin event — preserving the drawdown lesson while keeping beginners in the game.

**Architecture:** Extend the pure M0 account reducer with hysteresis tier transitions and a `RESET_AND_REFLECT` action; add a pure `summarizeRuin(runs)` that mines recent history for the failure pattern (oversizing / missing stops / revenge trades). The `PracticeContext` detects ruin after `applyResult`, gates a coached reset flow, and the next-scenario selectors already key off the per-track tier so complexity follows competence.

**Tech Stack:** Same as M0–M3. Pure-reducer-first; the UI flow is thin.

## Global Constraints

- (All M0–M3 Global Constraints apply.) `npm run typecheck` + `npm test` green at every commit.
- **Complexity, not odds (PRDphase2 §11.2):** tiers change scenario *complexity* (more legs, tighter windows, noisier patterns) — never the realistic odds of making money. Tier transitions key off the **rolling process score**, never P&L/balance.
- **No hard fail (PRDphase2 §11.3):** hitting < $1,000 triggers a mandatory coached reset (diagnose → drop one tier → refill to $10,000 → increment `ruinEvents`), not a permanent failure.
- **Honest signal:** keep and display a `ruinEvents` counter (risk-discipline signal), and surface the diagnosed cause from real history, not a generic message.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/practice/account.ts` (modify) | Add `HYSTERESIS`, `nextTier(prevTier, skill)`, `accountReducer` `RESET_AND_REFLECT` action. |
| `src/practice/account.test.ts` (extend) | Hysteresis tier-down + reset semantics. |
| `src/practice/reflect.ts` (+ `.test.ts`) | Pure `summarizeRuin(runs)` → diagnosed failure pattern + coached copy. |
| `src/state/PracticeContext.tsx` (modify) | Detect ruin after `applyResult`; expose `pendingRuin`, `resetAndReflect()`. |
| `src/practice/ResetReflect.tsx` (new) | Coached reset screen (diagnosis + acknowledge → reset). |
| `src/pages/PracticePage.tsx` (modify) | Show tier/skill rings + `ruinEvents`; route into the reset flow when `pendingRuin`. |
| `src/practice/scenarioRegistry.ts` (modify) | Ensure tiers 1–N exist per track so tier-up has somewhere to go (tag complexity). |

---

## Task 1: Hysteresis tier transitions + reset action

**Files:**
- Modify: `src/practice/account.ts`
- Extend: `src/practice/account.test.ts`

**Interfaces:**
- Produces: `HYSTERESIS = 6`, `nextTier(prevTier, skill) → number`; `accountReducer` handles `{ type: 'RESET_AND_REFLECT'; track? }`. `APPLY_RESULT` now uses `nextTier` (replaces the raw `tierFor` set from M0).

- [ ] **Step 1: Add the failing tests (extend account.test.ts)**

Append to `src/practice/account.test.ts`:

```ts
import { nextTier } from './account'

describe('nextTier hysteresis', () => {
  it('raises a tier as soon as skill crosses the next threshold', () => {
    // TIER_THRESHOLDS = [0,35,55,72,88]; at skill 56 tier should be 3.
    expect(nextTier(2, 56)).toBe(3)
  })
  it('does NOT drop a tier until skill falls a full hysteresis band below the current floor', () => {
    // At tier 3 (floor 55): skill 53 is within HYSTERESIS(6) of 55 → stay at 3.
    expect(nextTier(3, 53)).toBe(3)
    // skill 48 (< 55-6=49) → drop to 2.
    expect(nextTier(3, 48)).toBe(2)
  })
  it('never drops below tier 1', () => {
    expect(nextTier(1, -100)).toBe(1)
  })
})

describe('accountReducer APPLY_RESULT uses hysteresis tiers', () => {
  it('keeps a hard-won tier through a single mediocre score (no thrash)', () => {
    let a = initialAccount()
    for (let i = 0; i < 20; i++) a = accountReducer(a, { type: 'APPLY_RESULT', track: 'charts', score: 95, pnl: 0 })
    const tierBefore = a.tier.charts
    a = accountReducer(a, { type: 'APPLY_RESULT', track: 'charts', score: 60, pnl: 0 })
    expect(a.tier.charts).toBe(tierBefore) // one dip doesn't demote
  })
})

describe('accountReducer RESET_AND_REFLECT', () => {
  it('refills to $10k, drops every track tier by one (min 1), and counts a ruin event', () => {
    let a = initialAccount()
    a = { ...a, balance: 800, tier: { charts: 3, options: 2, 'market-making': 1 } }
    const r = accountReducer(a, { type: 'RESET_AND_REFLECT' })
    expect(r.balance).toBe(10000)
    expect(r.tier).toEqual({ charts: 2, options: 1, 'market-making': 1 })
    expect(r.ruinEvents).toBe(1)
  })
  it('preserves rolling skill (the competence signal survives a blowup)', () => {
    let a = initialAccount()
    a = { ...a, balance: 500, skill: { charts: 70, options: 40, 'market-making': 0 } }
    const r = accountReducer(a, { type: 'RESET_AND_REFLECT' })
    expect(r.skill.charts).toBe(70)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/practice/account.test.ts`
Expected: FAIL — `nextTier` not exported / `RESET_AND_REFLECT` not handled.

- [ ] **Step 3: Modify the implementation**

In `src/practice/account.ts`:

```ts
import { tierFor } from './account' // (no — tierFor is local; just keep it above)
```

Add the constant + function and update the reducer (keep `tierFor` from M0):

```ts
/** Skill margin a tier must lose before it demotes (prevents tier thrash). */
export const HYSTERESIS = 6

/** Tier given the previous tier + new skill, with downward hysteresis. */
export function nextTier(prevTier: number, skill: number): number {
  const raw = tierFor(skill)
  if (raw >= prevTier) return raw // promotions are immediate
  // Demote only if skill has fallen a full HYSTERESIS below the previous tier's floor.
  const prevFloor = TIER_THRESHOLDS[prevTier - 1] ?? 0
  if (skill < prevFloor - HYSTERESIS) return Math.max(1, raw)
  return prevTier
}
```

Update the reducer's `APPLY_RESULT` tier line and add the reset case:

```ts
type AccountAction =
  | { type: 'APPLY_RESULT'; track: Track; score: number; pnl: number }
  | { type: 'RESET_AND_REFLECT'; track?: Track }

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
        tier: { ...state.tier, [track]: nextTier(state.tier[track], nextSkill) },
      }
    }
    case 'RESET_AND_REFLECT': {
      const drop = (t: number) => Math.max(1, t - 1)
      return {
        ...state,
        balance: STARTING_BALANCE,
        tier: { charts: drop(state.tier.charts), options: drop(state.tier.options), 'market-making': drop(state.tier['market-making']) },
        ruinEvents: state.ruinEvents + 1,
      }
    }
    default:
      return state
  }
}
```

(Delete the now-unused direct `tierFor(nextSkill)` call from M0's APPLY_RESULT — `nextTier` replaces it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/practice/account.test.ts`
Expected: PASS (M0 tests still pass — promotions still immediate; the M0 "raises tier as skill crosses thresholds" case holds because promotions are immediate).

- [ ] **Step 5: Commit**

```bash
git add src/practice/account.ts src/practice/account.test.ts
git commit -m "feat(practice): hysteresis tier transitions + RESET_AND_REFLECT action"
```

---

## Task 2: Pure ruin diagnosis from history

**Files:**
- Create: `src/practice/reflect.ts`
- Test: `src/practice/reflect.test.ts`

**Interfaces:**
- Consumes: `PracticeRun` from `./types`.
- Produces: `summarizeRuin(runs) → RuinSummary`, `RuinSummary = { headline: string; causes: { id, label, count }[]; coaching: string }`. Mines the most recent runs for oversizing (low sizing dimension), missing stops (low `stop`/`defined-risk`), and revenge/fomo journal feelings.

- [ ] **Step 1: Write the failing test**

```ts
// src/practice/reflect.test.ts
import { describe, it, expect } from 'vitest'
import { summarizeRuin } from './reflect'
import type { PracticeRun } from './types'

const run = (over: Partial<PracticeRun>): PracticeRun => ({
  specId: 's', track: 'charts', tier: 1, decision: { took: true } as never,
  nudgesFired: [], score: 40, breakdown: [], pnl: -500,
  journal: { rationale: 'x', feeling: 'calm' }, createdAt: Date.now(), ...over,
})

describe('summarizeRuin', () => {
  it('flags oversizing when the sizing dimension was repeatedly weak', () => {
    const runs = [
      run({ breakdown: [{ id: 'sizing', label: 'Position sizing', weight: 2, score: 0.1, note: '' }] }),
      run({ breakdown: [{ id: 'sizing', label: 'Position sizing', weight: 2, score: 0.2, note: '' }] }),
    ]
    const s = summarizeRuin(runs)
    expect(s.causes.find((c) => c.id === 'oversizing')?.count).toBe(2)
    expect(s.headline.length).toBeGreaterThan(0)
  })
  it('flags missing stops / undefined risk', () => {
    const runs = [run({ breakdown: [{ id: 'stop', label: 'Defined max loss', weight: 2, score: 0, note: '' }] })]
    expect(summarizeRuin(runs).causes.some((c) => c.id === 'no-stops')).toBe(true)
  })
  it('flags revenge/fomo trading from the journal', () => {
    const runs = [run({ journal: { rationale: 'chased', feeling: 'revenge' } })]
    expect(summarizeRuin(runs).causes.some((c) => c.id === 'tilt')).toBe(true)
  })
  it('returns a calm generic headline when no clear pattern exists', () => {
    expect(summarizeRuin([]).causes).toHaveLength(0)
    expect(summarizeRuin([]).coaching.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/practice/reflect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/practice/reflect.ts
import type { PracticeRun } from './types'

export interface RuinSummary {
  headline: string
  causes: { id: 'oversizing' | 'no-stops' | 'tilt'; label: string; count: number }[]
  coaching: string
}

const WEAK = 0.4
const RECENT = 15

/** Diagnose what most likely blew up the account from recent runs. Pure. */
export function summarizeRuin(runs: PracticeRun[]): RuinSummary {
  const recent = runs.slice(0, RECENT)
  const dimWeak = (r: PracticeRun, ids: string[]) =>
    r.breakdown.some((d) => ids.includes(d.id) && d.score <= WEAK)

  let oversizing = 0
  let noStops = 0
  let tilt = 0
  for (const r of recent) {
    if (dimWeak(r, ['sizing'])) oversizing++
    if (dimWeak(r, ['stop', 'defined-risk'])) noStops++
    if (r.journal?.feeling === 'revenge' || r.journal?.feeling === 'fomo') tilt++
  }

  const causes = (
    [
      { id: 'oversizing' as const, label: 'Oversized positions', count: oversizing },
      { id: 'no-stops' as const, label: 'Undefined risk (no stop / naked legs)', count: noStops },
      { id: 'tilt' as const, label: 'Emotional (revenge/FOMO) entries', count: tilt },
    ]
  ).filter((c) => c.count > 0).sort((a, b) => b.count - a.count)

  if (causes.length === 0) {
    return {
      headline: 'The account drew down past the floor.',
      causes,
      coaching: 'Variance happens. Reset to $10,000 at a slightly simpler tier and focus on one sound trade at a time.',
    }
  }
  const top = causes[0]
  const headlineByCause: Record<string, string> = {
    oversizing: 'The account blew up mostly from position sizing.',
    'no-stops': 'The account blew up mostly from undefined risk.',
    tilt: 'The account blew up mostly from emotional trading.',
  }
  const coachingByCause: Record<string, string> = {
    oversizing: 'Pros risk 1–2% per trade. Smaller size keeps you in the game long enough for your edge to show.',
    'no-stops': 'Decide where you are wrong before you enter. A defined max loss is non-negotiable.',
    tilt: 'You logged revenge/FOMO before several losses. Walk away after a loss; the market will still be here.',
  }
  return { headline: headlineByCause[top.id], causes, coaching: coachingByCause[top.id] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/practice/reflect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/practice/reflect.ts src/practice/reflect.test.ts
git commit -m "feat(practice): pure ruin diagnosis from real history"
```

---

## Task 3: Wire ruin detection + reset into PracticeContext

**Files:**
- Modify: `src/state/PracticeContext.tsx`

**Interfaces:**
- Consumes: `isRuined`, `accountReducer` from `../practice/account`; `summarizeRuin` from `../practice/reflect`.
- Produces: context additions `pendingRuin: boolean`, `ruinSummary: RuinSummary | null`, `resetAndReflect(): void`.

- [ ] **Step 1: Add ruin state + reset to the context**

In `src/state/PracticeContext.tsx`:

```tsx
import { isRuined } from '../practice/account'
import { summarizeRuin, type RuinSummary } from '../practice/reflect'
// state:
const [pendingRuin, setPendingRuin] = useState(false)
const [ruinSummary, setRuinSummary] = useState<RuinSummary | null>(null)
```

In `applyResult`, after computing `next` and updating state, detect ruin:

```tsx
      if (isRuined(next)) {
        setPendingRuin(true)
        setRuinSummary(summarizeRuin([run, ...recentRuns]))
      }
```

Add the reset:

```tsx
const resetAndReflect = useCallback(() => {
  if (!user) return
  const next = accountReducer(accountRef.current, { type: 'RESET_AND_REFLECT' })
  accountRef.current = next
  setAccount(next)
  setPendingRuin(false)
  setRuinSummary(null)
  persistPracticeState(user.uid, next).catch((e) => console.error('persist reset', e))
}, [user])
```

Expose `pendingRuin`, `ruinSummary`, `resetAndReflect` in the value + the `PracticeValue` interface.

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/state/PracticeContext.tsx
git commit -m "feat(practice): detect ruin + expose coached reset in PracticeContext"
```

---

## Task 4: Reset-and-reflect screen

**Files:**
- Create: `src/practice/ResetReflect.tsx`
- Modify: `src/pages/PracticePage.tsx` (gate on `pendingRuin`; show `ruinEvents` + tier/skill)

**Interfaces:**
- Consumes: `usePractice()` (`ruinSummary`, `resetAndReflect`, `account`).
- Produces: a mandatory coached screen shown whenever `pendingRuin` is true; an acknowledge button calls `resetAndReflect`.

- [ ] **Step 1: Write the reset screen**

```tsx
// src/practice/ResetReflect.tsx
import Button from '../components/ui/Button'
import { usePractice } from '../state/PracticeContext'

export default function ResetReflect() {
  const { ruinSummary, resetAndReflect, account } = usePractice()
  if (!ruinSummary) return null
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-3xl border border-hairline bg-white p-8 text-center">
      <span className="rounded-full bg-brand-red-soft px-3 py-1 text-xs font-bold text-brand-red">Account reset</span>
      <h2 className="font-display text-2xl font-bold">{ruinSummary.headline}</h2>
      {ruinSummary.causes.length > 0 && (
        <ul className="w-full space-y-1 text-left">
          {ruinSummary.causes.map((c) => (
            <li key={c.id} className="flex justify-between text-sm">
              <span className="font-semibold">{c.label}</span>
              <span className="text-muted">{c.count}× recently</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-base leading-relaxed text-ink-soft">{ruinSummary.coaching}</p>
      <p className="text-sm text-muted">
        We&rsquo;ll refill your paper account to $10,000 and step the difficulty down a notch. This is reset #{account.ruinEvents + 1}.
        Your skill rating is kept.
      </p>
      <Button onClick={resetAndReflect}>Reset &amp; keep practicing</Button>
    </div>
  )
}
```

- [ ] **Step 2: Gate the Practice page on pendingRuin + show ruinEvents**

In `src/pages/PracticePage.tsx`:

```tsx
import ResetReflect from '../practice/ResetReflect'
const { loading, account, pendingRuin } = usePractice()
// after loading guard:
if (pendingRuin) return (<div className="min-h-screen bg-paper"><TopNav /><main className="mx-auto max-w-5xl px-4 py-10"><ResetReflect /></main></div>)
```

Also add a small `ruinEvents` chip near the balance header: `Resets {account.ruinEvents}`. Also ensure the player navigates back to `/practice` after a run so the gate shows when ruined (it already navigates to `/practice` in `finish`).

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/practice/ResetReflect.tsx src/pages/PracticePage.tsx
git commit -m "feat(practice): coached reset-and-reflect screen + ruin counter"
```

---

## Task 5: Ensure tiered complexity exists per track

**Files:**
- Modify: `src/practice/scenarioRegistry.ts`

**Interfaces:**
- Produces: each track's catalog spans tiers 1..3 with increasing complexity tags, so tier-up/down has somewhere to land and the LLM composer (M3) + curated cold-start/fallback always have a tier-appropriate spec. Also gives the M3 composer `buildCatalog` more real-data variety per tier (more endless content).

- [ ] **Step 1: Audit + fill tier coverage**

Confirm `scenariosFor('charts', t)` and `scenariosFor('options', t)` are non-empty for `t ∈ {1,2,3}` (add specs if a tier is empty). Encode complexity in the spec itself:
- Charts tier 1: single decision, `minRewardRisk: 1.5`. Tier 2: `minRewardRisk: 2`, noisier windows. Tier 3: tighter `revealToIndex` (shorter management window), `minRewardRisk: 2.5`.
- Options tier 1: single-leg long. Tier 2: vertical spread (encourage 2 legs via brief). Tier 3: 3–4 leg defined-risk (iron condor) brief, tighter management.

(The complexity is expressed via `brief` guidance + `constraints`; the scene supports it. Tier does NOT change market odds.)

- [ ] **Step 2: Run the registry contract**

Run: `npx vitest run src/practice/scenarioRegistry.test.ts`
Expected: PASS. Add a focused assertion to that test:

```ts
import { scenariosFor } from './scenarioRegistry'
it('charts + options cover tiers 1..3 so adaptive difficulty has targets', () => {
  for (const track of ['charts', 'options'] as const)
    for (const tier of [1, 2, 3]) expect(scenariosFor(track, tier).length, `${track} t${tier}`).toBeGreaterThan(0)
})
```

- [ ] **Step 3: Commit**

```bash
git add src/practice/scenarioRegistry.ts src/practice/scenarioRegistry.test.ts
git commit -m "feat(practice): tier 1–3 complexity coverage for adaptive difficulty"
```

---

## Task 6: M4 exit check

**Files:** (none — verification)

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 2: Manual exit criteria (PRDphase2 §17 M4 row)**

1. **Tier up:** play several high-process-score charts scenarios → the charts tier increments on `/practice`; scenarios served move to the higher tier (more complex brief/constraints).
2. **Tier down (hysteresis):** a single mediocre score does NOT demote; a sustained drop does.
3. **Reset-and-reflect:** drive the balance below $1,000 (e.g. an oversized losing trade) → after Continue, `/practice` shows the mandatory reset screen with a diagnosis drawn from real history; acknowledging refills to $10,000, drops one tier, increments `Resets`, and persists across reload.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(practice): M4 adaptive difficulty + reset-and-reflect green"
```

---

## Self-Review

**1. Spec coverage (PRDphase2 §11):** $10k start kept (M0). Tiers scale on rolling skill with hysteresis → `nextTier` + reducer. Tier down on sustained skill drop → hysteresis test. $1k → coached reset (diagnose → drop tier → refill → count) → `RESET_AND_REFLECT` + `summarizeRuin` + `ResetReflect`. Ruin counter shown. Complexity-only scaling (not odds) → tier expressed in brief/constraints, never in resolvers. ✓

**2. Placeholder scan:** No TBDs. The tier-coverage task is a concrete audit-and-fill with a test assertion gating it. ✓

**3. Type consistency:** `accountReducer` action union now includes `RESET_AND_REFLECT`; `nextTier(prevTier, skill)` used inside `APPLY_RESULT` and tested directly; `summarizeRuin(runs) → RuinSummary` consumed by context + screen; `pendingRuin`/`ruinSummary`/`resetAndReflect` added consistently to `PracticeValue` and `ResetReflect`. Reuses M0 `STARTING_BALANCE`/`TIER_THRESHOLDS`/`tierFor`/`isRuined`, M1 `breakdown` dimension ids (`sizing`,`stop`), M2 (`defined-risk`). ✓

**Carried interfaces M5/M6 rely on:** `nextTier`/`RESET_AND_REFLECT`, `summarizeRuin`/`RuinSummary`, `usePractice().pendingRuin`/`resetAndReflect`, the tier-coverage contract.
