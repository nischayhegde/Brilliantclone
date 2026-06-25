import type { ChartsDecision, DimensionScore, Rubric } from '../types'
import { weightedTotal } from './index'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Entry within this fraction of the decision-point (reveal) price reads as "sane". */
const ENTRY_BAND = 0.02

export const chartsRubricV1: Rubric = (spec, decisionRaw, outcome) => {
  const d = decisionRaw as ChartsDecision
  const { accountBalance, maxRiskPct, minRewardRisk = 1.5 } = spec.constraints
  const entry = d.entry ?? 0
  const long = d.direction !== 'short'
  // Pre-decision reveal price (the close at the split). This is a SETUP fact, not the
  // realized move — grading `read` from it keeps the dimension P&L-free (Inv 3).
  const entryRef = Number(outcome.facts.entryRef ?? 0)

  // read: a COHERENT directional PLAN consistent with the scenario setup — derived purely
  // from the decision + spec + the pre-decision reveal price. NEVER from the realized
  // move/P&L (a lucky win must not out-score a well-reasoned, unlucky loss).
  let read: number
  let readNote: string
  if (!d.took) {
    // Sitting out commits no risk; with no realized signal permitted, score it neutrally.
    read = 0.6
    readNote = 'Chose to sit out — no setup committed, no risk taken.'
  } else {
    const checks: boolean[] = [
      // Stop on the correct side of entry for the chosen direction.
      d.stop !== undefined && (long ? d.stop < entry : d.stop > entry),
      // Target set beyond entry in the trade direction.
      d.target !== undefined && (long ? d.target > entry : d.target < entry),
    ]
    // Entry within a sane band of the reveal price (only when the reveal price is known).
    if (entryRef > 0 && entry > 0) checks.push(Math.abs(entry - entryRef) / entryRef <= ENTRY_BAND)
    const passed = checks.filter(Boolean).length
    read = checks.length ? passed / checks.length : 0
    readNote = read >= 0.7
      ? 'Coherent plan: direction, stop, and target line up with the setup.'
      : 'Incoherent plan — stop/target/entry do not line up with the chosen direction.'
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

  // management: plan adherence only — held the plan vs deviated by exiting early. Graded
  // on the ACTION, never on whether that exit happened to be profitable (Inv 3).
  let management = 1
  let mgmtNote = 'Held the plan to resolution.'
  if (d.took && d.managedExitIndex !== undefined) {
    management = 0.6
    mgmtNote = 'Exited early — a deviation from the defined plan.'
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
