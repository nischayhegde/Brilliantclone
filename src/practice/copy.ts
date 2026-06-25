import type { Feeling, ScenarioSpec, Track } from './types'

export const DISCLAIMER =
  'Paper trading for education only. Scenarios use real historical data; outcomes are not predictions and this is not financial advice.'

export const TRACK_BLURB: Record<Track, string> = {
  charts: 'Read a real chart, define your risk, and trade a pattern. Graded on process, not luck.',
  options: 'Build a defined-risk options position from a real chain and manage it to expiry.',
  'market-making': 'Quote a two-sided market over a real session. Earn the spread, manage inventory and adverse selection.',
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
