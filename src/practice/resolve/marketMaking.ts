import type { MarketMakingDecision, ScenarioOutcome } from '../types'

export const REACH_K = 1
export const DEFAULT_ORDER_RATE = 4

export interface MMParams {
  /** Real mid path (from bookStatsFromCandles). */
  mids: number[]
  /** Realized volatility (price units). */
  sigma: number
  /** Baseline order arrivals per step (illustrative). */
  orderRate?: number
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

/**
 * Deterministic market-making session over a REAL mid path. Order flow is an
 * illustrative closed-form function of the real move each step; spread/inventory
 * arithmetic is exact. No RNG → reproducible.
 */
export function simulateMarketMaking(decision: MarketMakingDecision, params: MMParams): ScenarioOutcome {
  const { mids } = params
  const orderRate = params.orderRate ?? DEFAULT_ORDER_RATE
  const reach = Math.max(1e-9, REACH_K * params.sigma)
  const askFill = clamp01(1 - decision.askWidth / reach)
  const bidFill = clamp01(1 - decision.bidWidth / reach)

  let cash = 0
  let inv = 0
  let spreadCaptured = 0
  let fills = 0
  let maxInventoryHeld = 0

  for (let t = 0; t < mids.length - 1; t++) {
    const m = mids[t]
    const move = mids[t + 1] - m
    const tilt = clamp(move / reach, -1, 1)
    const buyFlow = orderRate * (0.5 + 0.5 * tilt) // lifts our ask
    const sellFlow = orderRate * (0.5 - 0.5 * tilt) // hits our bid

    // Ask side: we sell (inv decreases), capped at -maxInventory.
    let askShares = Math.min(decision.quoteSize, Math.round(buyFlow * askFill))
    askShares = Math.min(askShares, inv + decision.maxInventory) // inv - askShares >= -max
    askShares = Math.max(0, askShares)
    if (askShares > 0) {
      const px = m + decision.askWidth
      cash += px * askShares
      inv -= askShares
      spreadCaptured += decision.askWidth * askShares
      fills += askShares
    }

    // Bid side: we buy (inv increases), capped at +maxInventory.
    let bidShares = Math.min(decision.quoteSize, Math.round(sellFlow * bidFill))
    bidShares = Math.min(bidShares, decision.maxInventory - inv) // inv + bidShares <= +max
    bidShares = Math.max(0, bidShares)
    if (bidShares > 0) {
      const px = m - decision.bidWidth
      cash -= px * bidShares
      inv += bidShares
      spreadCaptured += decision.bidWidth * bidShares
      fills += bidShares
    }

    maxInventoryHeld = Math.max(maxInventoryHeld, Math.abs(inv))
  }

  const finalMid = mids[mids.length - 1]
  const pnl = cash + inv * finalMid
  const round2 = (x: number) => Math.round(x * 100) / 100
  return {
    pnl: round2(pnl),
    facts: {
      spreadCaptured: round2(spreadCaptured),
      adverseSelection: round2(pnl - spreadCaptured),
      finalInventory: inv,
      maxInventoryHeld,
      fills,
      finalMid,
      // Echoed so marketMakingRubricV1 can judge spread sizing without re-deriving vol.
      sigma: params.sigma,
    },
  }
}
