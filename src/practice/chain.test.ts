import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadChain, contractsForExpiry, findContract, dteDays, __clearChainCache } from './chain'

const SNAP = {
  meta: { symbol: 'DIS', date: '2021-02-17', spot: 186.44, expirations: ['2021-03-19'], contracts: 2 },
  chain: [
    { exp: '2021-03-19', strike: 185, cp: 'C', bid: 7.8, ask: 8.05, mid: 7.93, iv: 0.338, delta: 0.55, gamma: 0.02, theta: -0.12, vega: 0.21, rho: 0.08 },
    { exp: '2021-03-19', strike: 185, cp: 'P', bid: 6.25, ask: 6.5, mid: 6.38, iv: 0.333, delta: -0.45, gamma: 0.02, theta: -0.12, vega: 0.21, rho: -0.07 },
  ],
}

beforeEach(() => __clearChainCache())

describe('loadChain', () => {
  it('fetches + caches a snapshot (one fetch for two loads)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => SNAP })
    vi.stubGlobal('fetch', fetchMock)
    const a = await loadChain('data/options/DIS__2021-02-17.json')
    const b = await loadChain('data/options/DIS__2021-02-17.json')
    expect(a.meta.spot).toBe(186.44)
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('indexing helpers', () => {
  it('contractsForExpiry filters by expiry', () => {
    expect(contractsForExpiry(SNAP as never, '2021-03-19')).toHaveLength(2)
    expect(contractsForExpiry(SNAP as never, '2099-01-01')).toHaveLength(0)
  })
  it('findContract returns the exact strike+cp row', () => {
    expect(findContract(SNAP as never, '2021-03-19', 185, 'C')?.mid).toBe(7.93)
    expect(findContract(SNAP as never, '2021-03-19', 999, 'C')).toBeUndefined()
  })
  it('dteDays counts calendar days from snapshot date to expiry', () => {
    expect(dteDays('2021-02-17', '2021-03-19')).toBe(30)
  })
})
