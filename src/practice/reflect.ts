import type { PracticeRun } from './types'

export interface RuinSummary {
  headline: string
  causes: { id: 'oversizing' | 'no-stops' | 'tilt'; label: string; count: number }[]
  coaching: string
}

const WEAK = 0.4
const RECENT = 15

/** Diagnose what most likely blew up the account from recent runs. Pure. */
export function summarizeRuin(runs: PracticeRun[]): RuinSummary {
  const recent = runs.slice(0, RECENT)
  const dimWeak = (r: PracticeRun, ids: string[]) =>
    r.breakdown.some((d) => ids.includes(d.id) && d.score <= WEAK)

  let oversizing = 0
  let noStops = 0
  let tilt = 0
  for (const r of recent) {
    if (dimWeak(r, ['sizing'])) oversizing++
    if (dimWeak(r, ['stop', 'defined-risk'])) noStops++
    if (r.journal?.feeling === 'revenge' || r.journal?.feeling === 'fomo') tilt++
  }

  const causes = (
    [
      { id: 'oversizing' as const, label: 'Oversized positions', count: oversizing },
      { id: 'no-stops' as const, label: 'Undefined risk (no stop / naked legs)', count: noStops },
      { id: 'tilt' as const, label: 'Emotional (revenge/FOMO) entries', count: tilt },
    ]
  ).filter((c) => c.count > 0).sort((a, b) => b.count - a.count)

  if (causes.length === 0) {
    return {
      headline: 'The account drew down past the floor.',
      causes,
      coaching: 'Variance happens. Reset to $10,000 at a slightly simpler tier and focus on one sound trade at a time.',
    }
  }
  const top = causes[0]
  const headlineByCause: Record<string, string> = {
    oversizing: 'The account blew up mostly from position sizing.',
    'no-stops': 'The account blew up mostly from undefined risk.',
    tilt: 'The account blew up mostly from emotional trading.',
  }
  const coachingByCause: Record<string, string> = {
    oversizing: 'Pros risk 1–2% per trade. Smaller size keeps you in the game long enough for your edge to show.',
    'no-stops': 'Decide where you are wrong before you enter. A defined max loss is non-negotiable.',
    tilt: 'You logged revenge/FOMO before several losses. Walk away after a loss; the market will still be here.',
  }
  return { headline: headlineByCause[top.id], causes, coaching: coachingByCause[top.id] }
}
