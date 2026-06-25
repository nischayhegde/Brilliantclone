/**
 * Pure option payoff sampling for the `payoff-graph` + the inline preview in
 * `option-leg-builder`. The per-share P&L math is reused verbatim from the lesson's
 * `payoffMath` (single source of truth); this module only samples it across a price
 * domain and summarises it. NO React/DOM imports.
 */
import { legPnL, type Leg } from '../../../lessons/volatility/scenes/payoffMath'
import type { OptionLegDecision } from '../../types'

const MULTIPLIER = 100

function toLeg(l: OptionLegDecision): Leg {
  return { type: l.type, side: l.side, K: l.K, premium: l.premium }
}

/** Combined dollar P&L of all legs at expiry price S (per-share × contracts × 100). */
export function combinedDollars(legs: OptionLegDecision[], S: number): number {
  return legs.reduce((sum, l) => sum + legPnL(toLeg(l), S) * l.contracts * MULTIPLIER, 0)
}

export interface PayoffSample {
  S: number
  pnl: number
}

/** `n` evenly spaced samples of combined P&L across [sMin, sMax]. */
export function payoffSamples(legs: OptionLegDecision[], sMin: number, sMax: number, n = 41): PayoffSample[] {
  const out: PayoffSample[] = []
  const span = sMax - sMin
  const steps = Math.max(1, n - 1)
  for (let i = 0; i < n; i++) {
    const S = sMin + (span * i) / steps
    out.push({ S, pnl: combinedDollars(legs, S) })
  }
  return out
}

/** A sensible price domain bracketing all strikes with padding (floored at 0). */
export function priceDomain(legs: OptionLegDecision[]): { min: number; max: number } {
  if (legs.length === 0) return { min: 0, max: 1 }
  const strikes = legs.map((l) => l.K)
  const kMin = Math.min(...strikes)
  const kMax = Math.max(...strikes)
  const pad = Math.max(kMax - kMin, kMax * 0.25, 5)
  return { min: Math.max(0, kMin - pad), max: kMax + pad }
}

function contractsBy(legs: OptionLegDecision[], type: 'call' | 'put', side: 'long' | 'short'): number {
  return legs.filter((l) => l.type === type && l.side === side).reduce((s, l) => s + l.contracts, 0)
}

export interface PayoffSummary {
  maxProfit: number
  maxLoss: number
  /** Zero-crossings of the combined P&L curve, ascending. */
  breakevens: number[]
  definedRisk: boolean
  /** Net long calls → upside is unbounded. */
  unlimitedProfit: boolean
  /** Net short calls → downside is unbounded. */
  unlimitedLoss: boolean
}

/** Linear-interpolated zero crossings of the sampled payoff curve. */
function breakevensFrom(samples: PayoffSample[]): number[] {
  const xs: number[] = []
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    if (a.pnl === 0) xs.push(a.S)
    else if ((a.pnl < 0 && b.pnl > 0) || (a.pnl > 0 && b.pnl < 0)) {
      const t = a.pnl / (a.pnl - b.pnl)
      xs.push(a.S + t * (b.S - a.S))
    }
  }
  return xs
}

/** Summarise a structure: max profit/loss (sampled), breakevens, unbounded flags. */
export function payoffSummary(legs: OptionLegDecision[]): PayoffSummary {
  const netCalls = contractsBy(legs, 'call', 'long') - contractsBy(legs, 'call', 'short')
  const callsCovered = contractsBy(legs, 'call', 'long') >= contractsBy(legs, 'call', 'short')
  const putsCovered = contractsBy(legs, 'put', 'long') >= contractsBy(legs, 'put', 'short')
  const definedRisk = legs.length > 0 && callsCovered && putsCovered

  const dom = priceDomain(legs)
  const samples = payoffSamples(legs, dom.min, dom.max, 121)
  let maxProfit = -Infinity
  let maxLoss = Infinity
  for (const s of samples) {
    if (s.pnl > maxProfit) maxProfit = s.pnl
    if (s.pnl < maxLoss) maxLoss = s.pnl
  }
  const unlimitedProfit = netCalls > 0
  const unlimitedLoss = netCalls < 0

  return {
    maxProfit: unlimitedProfit ? Infinity : maxProfit,
    maxLoss: unlimitedLoss ? -Infinity : maxLoss,
    breakevens: breakevensFrom(samples),
    definedRisk,
    unlimitedProfit,
    unlimitedLoss,
  }
}
