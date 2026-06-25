import { describe, it, expect } from 'vitest'
import { quoteFromMid, ladderLevels } from './quoteMath'

describe('quoteFromMid', () => {
  it('quotes symmetric widths around the mid', () => {
    const q = quoteFromMid(100, 0.1, 0.2)
    expect(q.bid).toBeCloseTo(99.9, 5)
    expect(q.ask).toBeCloseTo(100.2, 5)
    expect(q.spread).toBeCloseTo(0.3, 5)
    expect(q.spreadPct).toBeCloseTo(0.003, 6)
  })

  it('reports zero spreadPct when mid is non-positive', () => {
    const q = quoteFromMid(0, 0.1, 0.1)
    expect(q.spreadPct).toBe(0)
  })
})

describe('ladderLevels', () => {
  it('steps down from the mid on the bid side', () => {
    expect(ladderLevels(100, 0.05, 3, 'bid')).toEqual([99.95, 99.9, 99.85])
  })
  it('steps up from the mid on the ask side', () => {
    expect(ladderLevels(100, 0.05, 2, 'ask')).toEqual([100.05, 100.1])
  })
  it('returns an empty array for non-positive levels', () => {
    expect(ladderLevels(100, 0.05, 0, 'bid')).toEqual([])
  })
})
