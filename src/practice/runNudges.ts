/**
 * Derive the coaching nudges a completed run trips, from the SAME structured decision the
 * deterministic engine resolved. The old Phaser flow fired nudges live as inputs changed;
 * the generative flow evaluates them once at resolution and shows them in the debrief.
 *
 * Pure + read-only: it reads the decision/outcome/constraints and the existing `NUDGES`
 * rules — it never touches the graded math.
 */
import type { BookStats } from './bookStats'
import { evaluateNudges, type NudgeContext } from './nudges'
import { definedRisk } from './genui/widgets/legBuilder'
import type {
  ChartsDecision,
  Decision,
  MarketMakingDecision,
  OptionsDecision,
  ScenarioOutcome,
  ScenarioSpec,
} from './types'

const OPTION_MULTIPLIER = 100

function chartsContext(spec: ScenarioSpec, decision: ChartsDecision, outcome: ScenarioOutcome): NudgeContext {
  const entry = decision.entry ?? (typeof outcome.facts.entryRef === 'number' ? outcome.facts.entryRef : 0)
  const shares = decision.shares ?? 0
  const hasStop = decision.stop != null
  const riskDollars = hasStop && decision.took ? Math.abs(entry - (decision.stop as number)) * shares : 0
  return {
    constraints: spec.constraints,
    riskDollars,
    hasStop: hasStop || !decision.took, // skipping a trade is not a "no stop" failure
    hasUndefinedRiskLeg: false,
    tradesInWindow: 0,
  }
}

function optionsContext(spec: ScenarioSpec, decision: OptionsDecision): NudgeContext {
  // Net debit paid is the capital at risk for a defined-risk structure (a heuristic for the
  // sizing nudge; the graded max-loss math is unchanged and lives in the resolver/rubric).
  let debit = 0
  for (const leg of decision.legs) {
    const sign = leg.side === 'long' ? 1 : -1
    debit += sign * leg.premium * leg.contracts * OPTION_MULTIPLIER
  }
  return {
    constraints: spec.constraints,
    riskDollars: Math.max(0, debit),
    hasStop: true,
    hasUndefinedRiskLeg: !definedRisk(decision.legs),
    tradesInWindow: 0,
  }
}

function marketMakingContext(
  spec: ScenarioSpec,
  decision: MarketMakingDecision,
  data: BookStats,
  outcome: ScenarioOutcome,
): NudgeContext {
  const sigma = data.sigma ?? (typeof outcome.facts.sigma === 'number' ? outcome.facts.sigma : undefined)
  const finalMid = data.finalMid ?? (typeof outcome.facts.finalMid === 'number' ? outcome.facts.finalMid : undefined)
  return {
    constraints: spec.constraints,
    riskDollars: 0,
    hasStop: true,
    hasUndefinedRiskLeg: false,
    tradesInWindow: 0,
    decision: decision as unknown as Record<string, unknown>,
    sigma,
    finalMid,
  }
}

/** Fired nudge ids (in catalog/priority order) for a completed run. */
export function nudgesForRun(
  spec: ScenarioSpec,
  data: unknown,
  decision: Decision,
  outcome: ScenarioOutcome,
): string[] {
  const requested = spec.nudges.map((n) => n.id)
  if (requested.length === 0) return []

  let ctx: NudgeContext
  switch (spec.track) {
    case 'charts':
      ctx = chartsContext(spec, decision as ChartsDecision, outcome)
      break
    case 'options':
      ctx = optionsContext(spec, decision as OptionsDecision)
      break
    case 'market-making':
      ctx = marketMakingContext(spec, decision as MarketMakingDecision, data as BookStats, outcome)
      break
    default:
      return []
  }
  return evaluateNudges(requested, ctx)
}
