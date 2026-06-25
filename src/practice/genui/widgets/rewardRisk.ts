/**
 * Pure reward:risk helper for the `price-lines` widget readout. Display/coaching hint
 * only — never feeds the deterministic math. NO React/DOM imports.
 */
import type { Direction } from '../types'

/**
 * Reward:risk from entry/stop/target as absolute price distances (direction-agnostic).
 * Returns null if any line is missing or risk is zero.
 */
export function rewardRisk(
  _direction: Direction | undefined,
  entry?: number,
  stop?: number,
  target?: number,
): number | null {
  if (entry == null || stop == null || target == null) return null
  const risk = Math.abs(entry - stop)
  const reward = Math.abs(target - entry)
  if (risk <= 0) return null
  return reward / risk
}

/** "2.5R" style label, or "—" when undefined. */
export function fmtRR(rr: number | null): string {
  if (rr == null) return '—'
  return `${(Math.round(rr * 10) / 10).toString()}R`
}
