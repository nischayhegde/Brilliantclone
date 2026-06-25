import type { DimensionScore, Rubric } from '../types'
import { chartsRubricV1 } from './charts'
import { optionsRubricV1 } from './options'

/** Weighted average of dimension scores (0..1), scaled to a 0..100 integer. */
export function weightedTotal(dimensions: DimensionScore[]): number {
  const wsum = dimensions.reduce((s, d) => s + d.weight, 0)
  if (wsum === 0) return 0
  const num = dimensions.reduce((s, d) => s + d.weight * d.score, 0)
  return Math.round((num / wsum) * 100)
}

/**
 * M0 placeholder so the pipeline runs end-to-end before any track ships. Real
 * rubrics (charts-v1, options-v1, mm-v1) are registered here in M1/M2/M5.
 */
const noop: Rubric = (_spec, _decision, outcome) => {
  const dimensions: DimensionScore[] = [
    { id: 'placeholder', label: 'Process', weight: 1, score: 0.5, note: 'No rubric yet for this track.' },
  ]
  return {
    total: weightedTotal(dimensions),
    dimensions,
    pnl: outcome.pnl,
    title: 'Scenario complete',
    detail: 'A real process rubric for this track lands in a later milestone.',
  }
}

export const RUBRICS: Record<string, Rubric> = { noop, 'charts-v1': chartsRubricV1, 'options-v1': optionsRubricV1 }

export function getRubric(id: string): Rubric {
  const r = RUBRICS[id]
  if (!r) throw new Error(`Unknown rubricId: ${id}`)
  return r
}
