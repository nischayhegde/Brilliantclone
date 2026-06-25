import { describe, it, expect } from 'vitest'
import { getRubric, weightedTotal, RUBRICS } from './index'
import type { DimensionScore } from '../types'

describe('weightedTotal', () => {
  it('normalises weighted dimension scores to 0..100', () => {
    const dims: DimensionScore[] = [
      { id: 'a', label: 'A', weight: 2, score: 1, note: '' },
      { id: 'b', label: 'B', weight: 1, score: 0, note: '' },
    ]
    expect(weightedTotal(dims)).toBe(67) // (2*1 + 1*0) / 3 * 100, rounded
  })
  it('is 0 for no dimensions', () => {
    expect(weightedTotal([])).toBe(0)
  })
})

describe('getRubric', () => {
  it('returns a registered rubric', () => {
    expect(typeof getRubric('noop')).toBe('function')
  })
  it('throws on an unknown rubric id', () => {
    expect(() => getRubric('does-not-exist')).toThrow()
  })
  it('every registered rubric id is a function', () => {
    for (const id of Object.keys(RUBRICS)) expect(typeof RUBRICS[id]).toBe('function')
  })
})
