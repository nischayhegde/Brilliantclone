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
