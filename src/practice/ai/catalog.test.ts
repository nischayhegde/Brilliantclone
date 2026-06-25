import { describe, it, expect } from 'vitest'
import { buildCatalog } from './catalog'

// Minimal stubs shaped exactly like public/data/manifest.json + options-manifest.json.
const ohlcManifest = {
  timeframes: ['1d', '1h', '15m'],
  tickers: {
    SPY: { '1d': { count: 5031, file: 'data/ohlc/SPY__1d.json' }, '1h': { count: 5089, file: 'data/ohlc/SPY__1h.json' }, '15m': { count: 40, file: 'data/ohlc/SPY__15m.json' } },
    NVDA: { '1d': { count: 5000, file: 'data/ohlc/NVDA__1d.json' } },
  },
}
const optionsManifest = {
  symbols: {
    SPY: [{ date: '2020-01-17', file: 'data/options/SPY__2020-01-17.json', spot: 331.95, contracts: 62, expirations: 3 }],
    DIS: [{ date: '2021-02-17', file: 'data/options/DIS__2021-02-17.json', spot: 188.5, contracts: 50, expirations: 3 }],
  },
}
const deps = {
  loadOhlcManifest: async () => ohlcManifest as never,
  loadOptionsManifest: async () => optionsManifest as never,
}

describe('buildCatalog', () => {
  it('charts catalog lists every manifest OHLC series with enough bars + bundled candle keys', async () => {
    const cat = await buildCatalog('charts', deps)
    expect(cat.track).toBe('charts')
    expect(cat.rubricIds).toContain('charts-v1')
    expect(cat.nudgeIds).toContain('sizing')
    expect(cat.ohlcAssets).toContain('data/ohlc/SPY__1d.json')
    expect(cat.ohlcAssets).toContain('data/ohlc/NVDA__1d.json')
    // the 40-bar 15m series is below MIN_OHLC_BARS and is excluded (can't slice a scenario)
    expect(cat.ohlcAssets).not.toContain('data/ohlc/SPY__15m.json')
    expect(cat.candlesKeys.length).toBeGreaterThan(0) // bundled keys still available for cold start
  })
  it('options catalog flattens every snapshot across all symbols', async () => {
    const cat = await buildCatalog('options', deps)
    expect(cat.rubricIds).toContain('options-v1')
    expect(cat.chainAssets).toContain('data/options/SPY__2020-01-17.json')
    expect(cat.chainAssets).toContain('data/options/DIS__2021-02-17.json')
  })
})
