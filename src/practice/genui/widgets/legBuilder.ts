/**
 * Pure helpers for the `option-leg-builder` widget: turn a REAL chain row into an
 * `OptionLegDecision` (premium is always the snapshot mid — never invented) and a
 * conservative defined-risk check. NO React/DOM imports.
 */
import { dteDays, type ContractRow } from '../../chain'
import type { OptionLegDecision } from '../../types'

/** Build a leg from a real chain row. Premium = the snapshot mid (real data). */
export function rowToLeg(
  row: ContractRow,
  side: 'long' | 'short',
  contracts: number,
  snapDate: string,
): OptionLegDecision {
  return {
    type: row.cp === 'C' ? 'call' : 'put',
    side,
    K: row.strike,
    expiry: row.exp,
    premium: row.mid,
    contracts,
    deltaAtEntry: row.delta,
    dteAtEntry: dteDays(snapDate, row.exp),
  }
}

function contractsBy(legs: OptionLegDecision[], type: 'call' | 'put', side: 'long' | 'short'): number {
  return legs
    .filter((l) => l.type === type && l.side === side)
    .reduce((sum, l) => sum + l.contracts, 0)
}

/**
 * Conservative defined-risk test: every short leg must be covered by an equal-or-greater
 * number of long legs of the same option type (a vertical spread or a plain long).
 * Naked shorts (uncovered) → false. Empty structure → false (nothing to risk yet).
 */
export function definedRisk(legs: OptionLegDecision[]): boolean {
  if (legs.length === 0) return false
  const callsCovered = contractsBy(legs, 'call', 'long') >= contractsBy(legs, 'call', 'short')
  const putsCovered = contractsBy(legs, 'put', 'long') >= contractsBy(legs, 'put', 'short')
  return callsCovered && putsCovered
}
