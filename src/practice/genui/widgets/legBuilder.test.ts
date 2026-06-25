import { describe, it, expect } from 'vitest'
import { rowToLeg, definedRisk } from './legBuilder'
import type { ContractRow } from '../../chain'

const callRow: ContractRow = {
  exp: '2021-03-19', strike: 130, cp: 'C', bid: 4.9, ask: 5.1, mid: 5,
  iv: 0.4, delta: 0.45, gamma: 0.02, theta: -0.05, vega: 0.1, rho: 0.01,
}
const putRow: ContractRow = { ...callRow, cp: 'P', strike: 120, mid: 3, delta: -0.4 }

describe('rowToLeg', () => {
  it('builds an OptionLegDecision from a real chain row (premium = mid, never invented)', () => {
    const leg = rowToLeg(callRow, 'long', 2, '2021-02-17')
    expect(leg).toMatchObject({
      type: 'call', side: 'long', K: 130, expiry: '2021-03-19', premium: 5, contracts: 2,
      deltaAtEntry: 0.45,
    })
    // dte from snapshot date 2021-02-17 -> 2021-03-19 = 30 days
    expect(leg.dteAtEntry).toBe(30)
  })

  it('maps put rows', () => {
    expect(rowToLeg(putRow, 'short', 1, '2021-02-17').type).toBe('put')
  })
})

describe('definedRisk', () => {
  it('is true for a single long call (a long option is defined risk)', () => {
    expect(definedRisk([rowToLeg(callRow, 'long', 1, '2021-02-17')])).toBe(true)
  })

  it('is false for a naked short call (uncovered)', () => {
    expect(definedRisk([rowToLeg(callRow, 'short', 1, '2021-02-17')])).toBe(false)
  })

  it('is false for a naked short put (uncovered)', () => {
    expect(definedRisk([rowToLeg(putRow, 'short', 1, '2021-02-17')])).toBe(false)
  })

  it('is true for a covered short call (vertical spread)', () => {
    const shortLow = rowToLeg({ ...callRow, strike: 130 }, 'short', 1, '2021-02-17')
    const longHigh = rowToLeg({ ...callRow, strike: 135 }, 'long', 1, '2021-02-17')
    expect(definedRisk([shortLow, longHigh])).toBe(true)
  })

  it('is false for an empty structure', () => {
    expect(definedRisk([])).toBe(false)
  })
})
