import type { Decision, Feeling, ProcessScore, ScenarioOutcome, ScenarioSpec } from './types'

/** Deterministic coaching prose from the real score + facts. LLM replaces this in M3. */
export function curatedDebrief(
  spec: ScenarioSpec,
  _decision: Decision,
  outcome: ScenarioOutcome,
  score: ProcessScore,
  journal?: { rationale: string; feeling: Feeling },
): string {
  const passed = score.total >= spec.objective.passScore
  const won = outcome.pnl > 0
  const parts: string[] = []

  if (passed && !won) {
    parts.push('That was good process on an unlucky outcome — exactly what we want to reward. Repeat this and the P&L follows.')
  } else if (passed && won) {
    parts.push('Sound process and it paid — note WHY it worked so you can do it again on purpose.')
  } else if (!passed && won) {
    parts.push('You made money, but the process was loose — that is how accounts get a false sense of safety. Tighten the weak spot below.')
  } else {
    parts.push('Tough one, and the process had a gap. Fixing it is worth more than the loss.')
  }

  const weakest = [...score.dimensions].sort((a, b) => a.score - b.score)[0]
  if (weakest && weakest.score < 0.6) {
    parts.push(`Biggest lever: ${weakest.label}. ${weakest.note}`)
  }

  if (journal && score.total < spec.objective.passScore) {
    const f: Feeling = journal.feeling
    if (f === 'fomo' || f === 'revenge' || f === 'anxious') {
      parts.push(`You logged "${f}" going in, and it scored ${score.total}. Notice the pattern — emotion-driven entries rarely grade well.`)
    }
  }
  return parts.join(' ')
}
