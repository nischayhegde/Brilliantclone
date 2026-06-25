import { describe, it, expect } from 'vitest'
import { simulateMarketMaking } from './marketMaking'
import type { MarketMakingDecision } from '../types'

const flat: MarketMakingDecision = { bidWidth: 0.5, askWidth: 0.5, quoteSize: 100, maxInventory: 1000 }

describe('simulateMarketMaking', () => {
  it('captures pure spread with no adverse selection on a flat path', () => {
    // mids=[100,100]: one step, no move. reach=1, fill=0.5, flow=2 each side, fills=1 each.
    const out = simulateMarketMaking(flat, { mids: [100, 100], sigma: 1, orderRate: 4 })
    expect(out.facts.spreadCaptured).toBeCloseTo(1.0, 6)
    expect(out.facts.adverseSelection).toBeCloseTo(0, 6)
    expect(out.facts.finalInventory).toBe(0)
    expect(out.pnl).toBeCloseTo(1.0, 6)
  })

  it('is deterministic — identical inputs give identical outputs', () => {
    const p = { mids: [100, 101, 99, 102, 98], sigma: 1.5, orderRate: 5 }
    expect(simulateMarketMaking(flat, p)).toEqual(simulateMarketMaking(flat, p))
  })

  it('a strong uptrend produces adverse selection (pnl below spread captured)', () => {
    const out = simulateMarketMaking(flat, { mids: [100, 102, 104, 106, 108], sigma: 1, orderRate: 5 })
    expect(out.facts.adverseSelection as number).toBeLessThan(0)
  })

  it('respects the inventory cap', () => {
    const tight = { bidWidth: 0.1, askWidth: 5, quoteSize: 100, maxInventory: 50 } // bids fill, asks rarely
    const out = simulateMarketMaking(tight, { mids: [100, 99, 98, 97, 96], sigma: 1, orderRate: 8 })
    expect(Math.abs(out.facts.finalInventory as number)).toBeLessThanOrEqual(50)
    expect(out.facts.maxInventoryHeld as number).toBeLessThanOrEqual(50)
  })

  it('tighter spreads fill more than wider spreads on the same path', () => {
    const path = { mids: [100, 100, 100, 100], sigma: 2, orderRate: 6 }
    const tight = simulateMarketMaking({ ...flat, bidWidth: 0.2, askWidth: 0.2 }, path)
    const wide = simulateMarketMaking({ ...flat, bidWidth: 1.8, askWidth: 1.8 }, path)
    expect(tight.facts.fills as number).toBeGreaterThan(wide.facts.fills as number)
  })

  it('echoes realized sigma in facts for the rubric', () => {
    expect(simulateMarketMaking(flat, { mids: [100, 100], sigma: 1, orderRate: 4 }).facts.sigma).toBe(1)
  })
})
