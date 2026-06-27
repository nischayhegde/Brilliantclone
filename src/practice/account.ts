import type { Track } from './types'

export const STARTING_BALANCE = 10000
export const RUIN_FLOOR = 1000
/**
 * EMA weight on the newest score; smaller = smoother, slower to react. Kept gentle
 * (0.2) so a new trader is never vaulted into harder tiers by a lucky score or two —
 * difficulty rises only after a steady run of strong process.
 */
export const SKILL_ALPHA = 0.2
/**
 * Rolling-skill cutoffs → tier. Index i means "tier i+1 starts at this skill". Spaced
 * out so beginners spend plenty of time on the easy tiers before complexity is added;
 * tier 1 covers the whole 0–44 band, which is where most new traders live for a while.
 */
export const TIER_THRESHOLDS = [0, 45, 65, 80, 92] as const

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

/** Skill margin a tier must lose before it demotes (prevents tier thrash). */
export const HYSTERESIS = 8

/** Tier given the previous tier + new skill, with downward hysteresis. */
export function nextTier(prevTier: number, skill: number): number {
  const raw = tierFor(skill)
  if (raw >= prevTier) return raw // promotions are immediate
  // Demote only if skill has fallen a full HYSTERESIS below the previous tier's floor.
  const prevFloor = TIER_THRESHOLDS[prevTier - 1] ?? 0
  if (skill < prevFloor - HYSTERESIS) return Math.max(1, raw)
  return prevTier
}

type AccountAction =
  | { type: 'APPLY_RESULT'; track: Track; score: number; pnl: number }
  | { type: 'RESET_AND_REFLECT'; track?: Track }

/**
 * Pure: applies a completed scenario's outcome. Balance += P&L (may go negative —
 * the < $1,000 reset is an M4 concern). Skill is an EMA of process scores; the
 * track's tier follows from the new skill via `nextTier` (immediate promotions,
 * hysteresis on demotions). `RESET_AND_REFLECT` refills to the starting balance,
 * drops every track one tier (min 1), and counts a ruin event — preserving skill.
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
        tier: { ...state.tier, [track]: nextTier(state.tier[track], nextSkill) },
      }
    }
    case 'RESET_AND_REFLECT': {
      const drop = (t: number) => Math.max(1, t - 1)
      return {
        ...state,
        balance: STARTING_BALANCE,
        tier: {
          charts: drop(state.tier.charts),
          options: drop(state.tier.options),
          'market-making': drop(state.tier['market-making']),
        },
        ruinEvents: state.ruinEvents + 1,
      }
    }
    default:
      return state
  }
}
