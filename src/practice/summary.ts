import type { PracticeRun, Track } from './types'

export interface PracticeSummary {
  totalRuns: number
  avgScoreByTrack: Partial<Record<Track, number>>
  bestScore: number
  lastPlayedTs: number
}

export function summarizePractice(runs: PracticeRun[]): PracticeSummary {
  const byTrack: Partial<Record<Track, { sum: number; n: number }>> = {}
  let best = 0
  let last = 0
  for (const r of runs) {
    const acc = (byTrack[r.track] ??= { sum: 0, n: 0 })
    acc.sum += r.score
    acc.n += 1
    if (r.score > best) best = r.score
    if (r.createdAt > last) last = r.createdAt
  }
  const avgScoreByTrack: Partial<Record<Track, number>> = {}
  for (const [t, acc] of Object.entries(byTrack)) avgScoreByTrack[t as Track] = Math.round(acc!.sum / acc!.n)
  return { totalRuns: runs.length, avgScoreByTrack, bestScore: best, lastPlayedTs: last }
}
