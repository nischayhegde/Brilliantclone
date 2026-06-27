import type { Feeling, ScenarioSpec, Track } from './types'

export const DISCLAIMER =
  'Paper trading for education only. Scenarios use real historical data; outcomes are not predictions and this is not financial advice.'

export const TRACK_BLURB: Record<Track, string> = {
  charts: 'Read a real chart, decide whether to trade, and plan your risk. You are scored on your thinking, not on whether the trade happened to win.',
  options: 'Build an options position where the most you can lose is known up front, using real market data, then see how it plays out.',
  'market-making': 'Set a price to buy at and a price to sell at over a real session. Earn the small gap between them while keeping what you hold under control.',
}

export const FEELING_LABEL: Record<Feeling, string> = {
  confident: 'Confident', anxious: 'Anxious', fomo: 'FOMO', revenge: 'Revenge', calm: 'Calm',
}

const FLAG_LABEL: Record<string, string> = {
  orderFlow: 'order flow',
  ladder: 'order book',
  earlyClose: 'mid-life option pricing',
}

/** A short "illustrative; math exact" label for any simulated elements in this spec. */
export function illustrativeLabel(spec: ScenarioSpec): string | null {
  const flags = spec.illustrativeFlags
  if (!flags || flags.length === 0) return null
  const parts = flags.map((f) => FLAG_LABEL[f] ?? f)
  return `Illustrative ${parts.join(' & ')} — the arithmetic shown is exact.`
}
