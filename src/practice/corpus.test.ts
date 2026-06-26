import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decodeColumnarOhlc, loadCandles, loadOhlcBundle, loadOhlcWindow, __clearCorpusCache } from './corpus'
import { CANDLES } from '../data/candles'

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

describe('loadOhlcBundle', () => {
  it('preserves the real meta + per-bar volume from an ohlc asset', async () => {
    const fakeJson = {
      meta: { ticker: 'NVDA', tf: '1d', currency: 'USD', exchange: 'NMS', count: 2, first: '2021-01-04', last: '2021-01-05' },
      t: [1, 2], o: [1, 2], h: [1, 2], l: [1, 2], c: [1, 2], v: [1000, 2000],
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson })
    vi.stubGlobal('fetch', fetchMock)
    const bundle = await loadOhlcBundle({ ohlcAsset: 'data/ohlc/NVDA__1d.json' })
    expect(bundle.meta?.ticker).toBe('NVDA')
    expect(bundle.meta?.tf).toBe('1d')
    expect(bundle.volumes).toEqual([1000, 2000])
    expect(bundle.candles).toHaveLength(2)
    vi.unstubAllGlobals()
  })

  it('returns bundled candles with no meta/volume for a candlesKey', async () => {
    const key = Object.keys((await import('../data/candles')).CANDLES)[0]
    const bundle = await loadOhlcBundle({ candlesKey: key })
    expect(bundle.candles.length).toBeGreaterThan(0)
    expect(bundle.meta).toBeUndefined()
    expect(bundle.volumes).toBeUndefined()
  })
})

describe('loadOhlcWindow', () => {
  it('slices candles + volumes to [startIndex, startIndex + revealToIndex)', async () => {
    const fakeJson = {
      meta: { ticker: 'X', tf: '1d' },
      t: [1, 2, 3, 4, 5], o: [1, 2, 3, 4, 5], h: [1, 2, 3, 4, 5], l: [1, 2, 3, 4, 5],
      c: [10, 20, 30, 40, 50], v: [100, 200, 300, 400, 500],
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson })
    vi.stubGlobal('fetch', fetchMock)
    const b = await loadOhlcWindow({ ohlcAsset: 'data/ohlc/X__1d.json', startIndex: 1, revealToIndex: 3 })
    expect(b.candles.map((c) => c.c)).toEqual([20, 30, 40])
    expect(b.volumes).toEqual([200, 300, 400])
    expect(b.meta?.ticker).toBe('X')
    vi.unstubAllGlobals()
  })

  it('returns the full series unchanged when no window is set', async () => {
    const key = Object.keys(CANDLES)[0]
    const full = await loadCandles({ candlesKey: key })
    const windowed = await loadOhlcWindow({ candlesKey: key })
    expect(windowed.candles).toEqual(full)
  })
})
