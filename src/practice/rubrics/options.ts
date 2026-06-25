import type { DimensionScore, OptionsDecision, Rubric } from '../types'
import { weightedTotal } from './index'
import { combinedExpiryMaxLoss } from '../resolve/options'
import type { Leg } from '../../lessons/volatility/scenes/payoffMath'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export const optionsRubricV1: Rubric = (spec, decisionRaw, outcome) => {
  const d = decisionRaw as OptionsDecision
  const { accountBalance, maxRiskPct } = spec.constraints
  const legs: Leg[] = d.legs.map((l) => ({ type: l.type, side: l.side, K: l.K, premium: l.premium }))
  const maxLoss = combinedExpiryMaxLoss(legs.map((l) => ({ ...l, premium: l.premium }))) *
    Math.max(1, ...d.legs.map((l) => l.contracts))

  // defined-risk: finite combined max loss.
  const definedRisk = Number.isFinite(maxLoss) ? 1 : 0

  // sizing-by-max-loss: dollar max loss vs budget.
  const budget = (maxRiskPct / 100) * accountBalance
  const sizing = Number.isFinite(maxLoss) ? clamp01(1 - (maxLoss - budget) / (2 * budget)) : 0

  // thesis: a COHERENT, defined-risk STRUCTURE with sane strikes/expiry relative to the
  // chain — derived from the decision + spec + pre-decision chain facts. NEVER from realized
  // P&L (a losing-but-coherent structure must not score below a lucky undefined-risk win).
  const spot = Number(outcome.facts.spotAtEntry ?? 0)
  const thesisChecks: number[] = []
  // 1. A recognizable defined-risk structure (finite combined max loss).
  thesisChecks.push(Number.isFinite(maxLoss) ? 1 : 0)
  // 2. Strikes relate to spot sensibly — within ~50% of spot (only when spot is known).
  if (spot > 0 && d.legs.length) {
    const nearSpot = d.legs.filter((l) => Math.abs(l.K - spot) / spot <= 0.5).length
    thesisChecks.push(nearSpot / d.legs.length)
  }
  // 3. Expiry within a sane scenario horizon: real, not already expired, not multi-year.
  if (d.legs.length) {
    const horizonOk = d.legs.filter((l) => {
      const dte = l.dteAtEntry ?? 30
      return dte > 0 && dte <= 365
    }).length
    thesisChecks.push(horizonOk / d.legs.length)
  }
  const thesis = thesisChecks.length ? thesisChecks.reduce((s, x) => s + x, 0) / thesisChecks.length : 0

  // R:R: maxGain/maxLoss sanity (premium sellers accept <1; cap reward).
  const maxGainApprox = d.legs.reduce((s, l) => s + (l.side === 'short' ? l.premium : 0) * 100 * l.contracts, 0)
  const rr = Number.isFinite(maxLoss) && maxLoss > 0 ? clamp01(maxGainApprox / maxLoss / 0.5) : 0.3

  // strike/expiry sanity: short premium near 0.20–0.30 delta and 30–45 DTE; long debit with enough DTE.
  let saneCount = 0
  for (const l of d.legs) {
    const dte = l.dteAtEntry ?? 30
    const absDelta = Math.abs(l.deltaAtEntry ?? 0.5)
    if (l.side === 'short') {
      const deltaOk = absDelta >= 0.15 && absDelta <= 0.35
      const dteOk = dte >= 25 && dte <= 50
      if (deltaOk && dteOk) saneCount++
    } else {
      const dteOk = dte >= 20
      const notLotto = absDelta >= 0.2
      if (dteOk && notLotto) saneCount++
    }
  }
  const strikeExpiry = d.legs.length ? saneCount / d.legs.length : 0

  // management: closed near target / rolled / held — reward active defined-risk management.
  const management = d.managed === 'closed-early' ? 1 : d.managed === 'rolled' ? 0.8 : 0.6

  const dimensions: DimensionScore[] = [
    { id: 'thesis', label: 'Thesis fit', weight: 2, score: thesis, note: thesis >= 0.7 ? 'Coherent defined-risk structure with sane strikes/expiry.' : 'Structure is loose — undefined risk, off-spot strikes, or an unsound horizon.' },
    { id: 'sizing', label: 'Size by max loss', weight: 2, score: sizing, note: Number.isFinite(maxLoss) ? `Max loss $${Math.round(maxLoss)} vs $${Math.round(budget)} budget.` : 'Undefined max loss — cannot size.' },
    { id: 'defined-risk', label: 'Defined max loss', weight: 2, score: definedRisk, note: definedRisk ? 'Loss is capped.' : 'Naked leg — unbounded loss.' },
    { id: 'rr', label: 'Reward : risk', weight: 1, score: rr, note: `Credit/Debit vs max loss.` },
    { id: 'strike-expiry', label: 'Strike/expiry sanity', weight: 2, score: strikeExpiry, note: `${saneCount}/${d.legs.length} legs in sane delta/DTE bands.` },
    { id: 'management', label: 'Management', weight: 2, score: management, note: `Managed: ${d.managed ?? 'hold'}.` },
  ]
  const total = weightedTotal(dimensions)
  const money = outcome.pnl > 0 ? `+$${Math.round(outcome.pnl)}` : outcome.pnl < 0 ? `−$${Math.abs(Math.round(outcome.pnl))}` : '$0'
  return {
    total,
    dimensions,
    pnl: outcome.pnl,
    title: total >= spec.objective.passScore ? `Sound structure · ${money}` : `Risky structure · ${money}`,
    detail: dimensions.map((x) => `${x.label}: ${Math.round(x.score * 100)}% — ${x.note}`).join('  '),
  }
}
