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
