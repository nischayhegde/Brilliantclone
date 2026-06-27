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
    copy: 'Heads up — this puts a fairly large slice of your account on one trade. A gentle habit is to risk only a small amount on any single trade, so one rough patch never sinks you. Consider trimming your size.',
    triggered: (c) => c.riskDollars > (c.constraints.maxRiskPct / 100) * c.constraints.accountBalance,
  },
  'no-stop': {
    id: 'no-stop',
    copy: 'You have not set a stop yet. A stop is simply the price where you would admit the trade is not working and step out. Without one, there is no limit on what the trade can cost you, so it helps to pick that price before you enter.',
    triggered: (c) => !c.hasStop,
  },
  'undefined-risk': {
    id: 'undefined-risk',
    copy: 'This position could lose much more than you put in — its downside is open-ended. You can cap it by adding a second option (a spread) so your worst case is known up front. Want to do that?',
    triggered: (c) => c.hasUndefinedRiskLeg,
  },
  overtrading: {
    id: 'overtrading',
    copy: 'That is several trades in a short stretch. Trading a lot, very fast, tends to cost new traders more than it earns. There is no rush — waiting for a clear setup is usually the stronger move.',
    triggered: (c) => c.tradesInWindow >= 4,
  },
  'spread-too-tight': {
    id: 'spread-too-tight',
    copy: 'Your buy and sell prices are very close together compared with how much this name moves. When that happens, your orders tend to get filled right before the price runs against you. Widening the gap gives you more cushion.',
    triggered: (ctx) => {
      const d = ctx.decision as { bidWidth?: number; askWidth?: number } | undefined
      const sigma = ctx.sigma
      if (sigma == null || !d || d.bidWidth == null || d.askWidth == null) return false
      return (d.bidWidth + d.askWidth) / 2 < 0.25 * sigma
    },
  },
  'inventory-runaway': {
    id: 'inventory-runaway',
    copy: 'The amount you are willing to hold is large compared with your account. If the price keeps moving one way, that can become more risk than you can comfortably cover. A smaller cap keeps you safe.',
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
