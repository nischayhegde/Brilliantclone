import type { RiskConstraints } from './types'

export interface NudgeContext {
  constraints: RiskConstraints
  /** Dollars at risk on the trade being set up (entry→stop × shares, or option max loss). */
  riskDollars: number
  hasStop: boolean
  hasUndefinedRiskLeg: boolean
  /** Trades taken in the recent window (overtrading signal). */
  tradesInWindow: number
  /** Market-making: the learner's in-progress quote (bidWidth/askWidth/quoteSize/maxInventory). */
  decision?: Record<string, unknown>
  /** Market-making: realized volatility of the name (price units), for spread-vs-vol nudges. */
  sigma?: number
  /** Market-making: current mid for cap-notional sizing checks. */
  finalMid?: number
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
  'spread-too-tight': {
    id: 'spread-too-tight',
    copy: 'Your spread is much tighter than this name’s volatility — you’ll get picked off (adverse selection). Widen it.',
    triggered: (ctx) => {
      const d = ctx.decision as { bidWidth?: number; askWidth?: number } | undefined
      const sigma = ctx.sigma
      if (sigma == null || !d || d.bidWidth == null || d.askWidth == null) return false
      return (d.bidWidth + d.askWidth) / 2 < 0.25 * sigma
    },
  },
  'inventory-runaway': {
    id: 'inventory-runaway',
    copy: 'Your inventory cap is huge relative to your account — one trend and you’re carrying risk you can’t cover.',
    triggered: (ctx) => {
      const d = ctx.decision as { maxInventory?: number } | undefined
      const mid = ctx.finalMid ?? 100
      if (!d || d.maxInventory == null) return false
      return d.maxInventory * mid > ctx.constraints.accountBalance * 2
    },
  },
}

/** Fired nudge ids from `requested`, in catalog order; unknown ids are ignored. */
export function evaluateNudges(requested: string[], ctx: NudgeContext): string[] {
  return Object.keys(NUDGES).filter((id) => requested.includes(id) && NUDGES[id].triggered(ctx))
}
