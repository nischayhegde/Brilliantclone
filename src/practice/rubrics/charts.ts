import type { ChartsDecision, DimensionScore, Rubric } from '../types'
import { weightedTotal } from './index'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export const chartsRubricV1: Rubric = (spec, decisionRaw, outcome) => {
  const d = decisionRaw as ChartsDecision
  const { accountBalance, maxRiskPct, minRewardRisk = 1.5 } = spec.constraints
  const netMove = Number(outcome.facts.netMove ?? 0)
  const entry = d.entry ?? 0

  // read: direction agreed with the realized move, or a justified skip.
  let read: number
  let readNote: string
  if (!d.took) {
    const moveFrac = entry ? Math.abs(netMove) / entry : Math.abs(netMove) / 100
    read = moveFrac <= 0.01 ? 0.9 : moveFrac <= 0.03 ? 0.55 : 0.2
    readNote = read >= 0.7 ? 'Sat out a choppy, low-edge move — disciplined.' : 'A tradable move was available; skipping left edge on the table.'
  } else {
    const agreed = (d.direction !== 'short' && netMove > 0) || (d.direction === 'short' && netMove < 0)
    read = agreed ? 1 : 0.2
    readNote = agreed ? 'Direction matched the realized move.' : 'Direction fought the realized move.'
  }

  // sizing: dollar risk vs the budget.
  let sizing = 1
  let sizingNote = 'No size committed.'
  if (d.took) {
    const shares = d.shares ?? 0
    const risk = d.stop !== undefined ? Math.abs(entry - d.stop) * shares : entry * shares // stopless = full exposure
    const budget = (maxRiskPct / 100) * accountBalance
    sizing = clamp01(1 - (risk - budget) / (2 * budget))
    sizingNote = `Risked $${Math.round(risk)} vs a $${Math.round(budget)} budget (${maxRiskPct}% of account).`
  }

  // stop: present and on the correct side of entry.
  const long = d.direction !== 'short'
  const stopOk = d.took && d.stop !== undefined && (long ? d.stop < entry : d.stop > entry)
  const stop = d.took ? (stopOk ? 1 : 0) : 1
  const stopNote = !d.took ? 'No trade — no stop needed.' : stopOk ? 'Stop defined on the correct side of entry.' : 'No (or wrong-side) stop — undefined risk.'

  // reward:risk.
  let rr = 1
  let rrNote = 'No trade — R:R n/a.'
  if (d.took && d.stop !== undefined && d.target !== undefined) {
    const reward = Math.abs(d.target - entry)
    const riskPerShare = Math.abs(entry - d.stop) || 1e-9
    const ratio = reward / riskPerShare
    rr = clamp01(ratio / minRewardRisk)
    rrNote = `Reward:risk ≈ ${ratio.toFixed(2)} (target ${minRewardRisk}).`
  } else if (d.took) {
    rr = 0
    rrNote = 'Missing target or stop — R:R undefined.'
  }

  // management.
  let management = 1
  let mgmtNote = 'Held the plan to resolution.'
  if (d.took && d.managedExitIndex !== undefined) {
    management = outcome.pnl >= 0 ? 0.7 : 0.4
    mgmtNote = outcome.pnl >= 0 ? 'Managed out early, protecting an open gain.' : 'Early exit cut the loss but deviated from plan.'
  }

  const dimensions: DimensionScore[] = [
    { id: 'read', label: 'Correct read', weight: 2, score: read, note: readNote },
    { id: 'sizing', label: 'Position sizing', weight: 2, score: sizing, note: sizingNote },
    { id: 'stop', label: 'Defined max loss', weight: 2, score: stop, note: stopNote },
    { id: 'rr', label: 'Reward : risk', weight: 1, score: rr, note: rrNote },
    { id: 'management', label: 'Management', weight: 1, score: management, note: mgmtNote },
  ]
  const total = weightedTotal(dimensions)
  const moneyword = outcome.pnl > 0 ? `+$${Math.round(outcome.pnl)}` : outcome.pnl < 0 ? `−$${Math.abs(Math.round(outcome.pnl))}` : '$0'
  return {
    total,
    dimensions,
    pnl: outcome.pnl,
    title: total >= spec.objective.passScore ? `Solid process · ${moneyword}` : `Process needs work · ${moneyword}`,
    detail: dimensions.map((x) => `${x.label}: ${Math.round(x.score * 100)}% — ${x.note}`).join('  '),
  }
}
