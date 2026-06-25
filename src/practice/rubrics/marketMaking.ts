import type { DimensionScore, MarketMakingDecision, ProcessScore, Rubric } from '../types'
import { weightedTotal } from './index'

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export const marketMakingRubricV1: Rubric = (spec, decision, outcome): ProcessScore => {
  const d = decision as MarketMakingDecision
  const sigma = (outcome.facts.sigma as number) || 1
  const avgWidth = (d.bidWidth + d.askWidth) / 2
  const finalInv = Math.abs(outcome.facts.finalInventory as number)
  const cap = Math.max(1, d.maxInventory)

  // Two-sided: both sides must be live and not absurdly asymmetric.
  const bothLive = d.bidWidth > 0 && d.askWidth > 0
  const symmetry = 1 - clamp01(Math.abs(d.bidWidth - d.askWidth) / (avgWidth || 1))
  const twoSided = bothLive ? 0.6 + 0.4 * symmetry : 0.2

  // Spread vs vol: ideal half-width ≈ sigma; too tight → adverse selection, too wide → no fills.
  const ratio = avgWidth / sigma // 1 is ideal
  const spreadVsVol = clamp01(ratio <= 1 ? ratio : 1 / ratio) // peaks at 1, falls either side

  // Inventory discipline: ended near flat AND held a sane cap relative to account.
  const flatness = 1 - clamp01(finalInv / cap)
  const capNotional = cap * (outcome.facts.finalMid as number)
  const saneCap = clamp01(1 - Math.max(0, capNotional - spec.constraints.accountBalance) / spec.constraints.accountBalance)
  const inventory = 0.6 * flatness + 0.4 * saneCap

  // Quote size sane vs account (a single fill shouldn't be a huge fraction of capital).
  const sizeNotional = d.quoteSize * (outcome.facts.finalMid as number)
  const quoteSize = clamp01(1 - Math.max(0, sizeNotional - spec.constraints.accountBalance * 0.25) / (spec.constraints.accountBalance * 0.25))

  const dimensions: DimensionScore[] = [
    { id: 'two-sided', label: 'Two-sided market', weight: 2, score: twoSided, note: bothLive ? 'Quoted both sides.' : 'You only quoted one side — that is not market making.' },
    { id: 'spread-vs-vol', label: 'Spread sized to volatility', weight: 3, score: spreadVsVol, note: ratio < 0.5 ? 'Spread too tight for the vol — adverse selection eats you.' : ratio > 2 ? 'Spread too wide — you barely get filled.' : 'Spread reasonably sized to volatility.' },
    { id: 'inventory-discipline', label: 'Inventory discipline', weight: 3, score: inventory, note: flatness > 0.7 ? 'Finished near flat.' : 'Inventory ran away from you — manage your skew.' },
    { id: 'quote-size', label: 'Quote size vs capital', weight: 1, score: quoteSize, note: 'Quote size relative to account.' },
  ]

  const total = weightedTotal(dimensions)
  const pass = total >= spec.objective.passScore
  return {
    total,
    dimensions,
    pnl: outcome.pnl,
    title: pass ? 'Solid market making' : 'Process needs work',
    detail: `Spread captured ${outcome.facts.spreadCaptured}, adverse selection ${outcome.facts.adverseSelection}.`,
  }
}
