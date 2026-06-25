import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decodeColumnarOhlc, loadCandles, __clearCorpusCache } from './corpus'

beforeEach(() => __clearCorpusCache())

describe('decodeColumnarOhlc', () => {
  it('maps columnar arrays to Candle[] {t,o,h,l,c}', () => {
    const json = { meta: { ticker: 'AAPL' }, t: [1, 2], o: [10, 11], h: [12, 13], l: [9, 10], c: [11, 12], v: [100, 200] }
    expect(decodeColumnarOhlc(json)).toEqual([
      { t: 1, o: 10, h: 12, l: 9, c: 11 },
      { t: 2, o: 11, h: 13, l: 10, c: 12 },
    ])
  })
})

describe('loadCandles', () => {
  it('returns bundled candles synchronously-resolved for a candlesKey', async () => {
    const key = Object.keys((await import('../data/candles')).CANDLES)[0]
    const out = await loadCandles({ candlesKey: key })
    expect(out.length).toBeGreaterThan(0)
    expect(out[0]).toHaveProperty('c')
  })

  it('fetches + decodes an ohlcAsset and caches it (one fetch for two loads)', async () => {
    const fakeJson = { t: [1], o: [1], h: [1], l: [1], c: [1], v: [1] }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson })
    vi.stubGlobal('fetch', fetchMock)
    const a = await loadCandles({ ohlcAsset: 'data/ohlc/AAPL__1d.json' })
    const b = await loadCandles({ ohlcAsset: 'data/ohlc/AAPL__1d.json' })
    expect(a).toEqual(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('throws a clear error when neither ref is present', async () => {
    await expect(loadCandles({})).rejects.toThrow(/candlesKey or ohlcAsset/)
  })
})
