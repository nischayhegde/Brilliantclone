import type { Candle } from '../data/candles'

export interface BookStats {
  /** Real mid path the session walks (close prices, resampled to `steps`). */
  mids: number[]
  /** Realized volatility: stdev of consecutive mid moves, in price units. */
  sigma: number
  mid0: number
  finalMid: number
}

/** Resample an array to exactly n points (linear index pick, endpoints preserved). */
function resample(xs: number[], n: number): number[] {
  if (xs.length <= n) return xs.slice()
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(xs[Math.round((i * (xs.length - 1)) / (n - 1))])
  return out
}

export function bookStatsFromCandles(candles: Candle[], steps = 30): BookStats {
  const closes = candles.map((c) => c.c)
  const diffs: number[] = []
  for (let i = 1; i < closes.length; i++) diffs.push(closes[i] - closes[i - 1])
  const mean = diffs.reduce((a, b) => a + b, 0) / (diffs.length || 1)
  const variance = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (diffs.length || 1)
  const mids = resample(closes, steps)
  return {
    mids,
    sigma: Math.sqrt(variance),
    mid0: closes[0],
    finalMid: closes[closes.length - 1],
  }
}
