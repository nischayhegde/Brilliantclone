import { describe, it, expect } from 'vitest'
import type { Candle } from '../data/candles'
import {
  buildChartContext,
  fmtDay,
  fmtStamp,
  fmtVolume,
  isIntradayTf,
  tickerFromRef,
  timeframeFromAsset,
  timeframeLabel,
} from './chartContext'

const sec = (ms: number) => Math.floor(ms / 1000)

describe('timeframe + ticker parsing', () => {
  it('extracts the timeframe key from an OHLC asset path', () => {
    expect(timeframeFromAsset('data/ohlc/AAPL__1d.json')).toBe('1d')
    expect(timeframeFromAsset('data/ohlc/AAPL__1h.json')).toBe('1h')
    expect(timeframeFromAsset('data/ohlc/AAPL__15m.json')).toBe('15m')
    expect(timeframeFromAsset(undefined)).toBeUndefined()
  })

  it('labels timeframes and flags intraday', () => {
    expect(timeframeLabel('1d')).toBe('Daily')
    expect(timeframeLabel('1h')).toBe('Hourly')
    expect(timeframeLabel('15m')).toBe('15-minute')
    expect(timeframeLabel(undefined)).toBeUndefined()
    expect(isIntradayTf('1h')).toBe(true)
    expect(isIntradayTf('15m')).toBe(true)
    expect(isIntradayTf('1d')).toBe(false)
    expect(isIntradayTf(undefined)).toBe(false)
  })

  it('infers a ticker from a bundled key or an asset path', () => {
    expect(tickerFromRef({ candlesKey: 'asctri_quiz_AMD' })).toBe('AMD')
    expect(tickerFromRef({ ohlcAsset: 'data/ohlc/AAPL__1d.json' })).toBe('AAPL')
    expect(tickerFromRef({ ohlcAsset: 'data/ohlc/BRK-B__1d.json' })).toBe('BRK-B')
    expect(tickerFromRef(undefined)).toBeUndefined()
  })
})

describe('date formatting (UTC, exact)', () => {
  it('formats a day and an intraday stamp', () => {
    const t = sec(Date.UTC(2021, 10, 12, 14, 30))
    expect(fmtDay(t)).toBe('12 Nov 2021')
    expect(fmtStamp(t, false)).toBe('12 Nov 2021')
    expect(fmtStamp(t, true)).toBe('12 Nov 2021, 14:30 UTC')
  })
})

describe('fmtVolume', () => {
  it('renders compact magnitudes', () => {
    expect(fmtVolume(950)).toBe('950')
    expect(fmtVolume(52_300_000)).toBe('52.3M')
    expect(fmtVolume(1_200_000_000)).toBe('1.2B')
    expect(fmtVolume(12_500)).toBe('12.5K')
  })
})

describe('buildChartContext', () => {
  const candles: Candle[] = [
    { t: sec(Date.UTC(2021, 10, 12)), o: 100, h: 105, l: 98, c: 100 },
    { t: sec(Date.UTC(2021, 10, 15)), o: 100, h: 112, l: 99, c: 110 },
    { t: sec(Date.UTC(2022, 1, 18)), o: 110, h: 120, l: 90, c: 120 },
  ]

  it('builds a full context from an asset with real meta + volume', () => {
    const ctx = buildChartContext(candles, {
      ref: { ohlcAsset: 'data/ohlc/AAPL__1d.json' },
      meta: { ticker: 'AAPL', tf: '1d', currency: 'USD' },
      volumes: [100, 200, 300],
    })
    expect(ctx).not.toBeNull()
    expect(ctx!.ticker).toBe('AAPL')
    expect(ctx!.name).toBe('Apple Inc.')
    expect(ctx!.sector).toBe('Technology')
    expect(ctx!.timeframeLabel).toBe('Daily')
    expect(ctx!.intraday).toBe(false)
    expect(ctx!.firstLabel).toBe('12 Nov 2021')
    expect(ctx!.lastLabel).toBe('18 Feb 2022')
    expect(ctx!.bars).toBe(3)
    expect(ctx!.lastClose).toBe(120)
    expect(ctx!.high).toBe(120)
    expect(ctx!.low).toBe(90)
    expect(ctx!.pctChange).toBeCloseTo(20, 5)
    expect(ctx!.avgVolume).toBe(200)
  })

  it('degrades gracefully for a bundled key (no meta/volume)', () => {
    const ctx = buildChartContext(candles, { ref: { candlesKey: 'asctri_quiz_AMD' } })
    expect(ctx!.ticker).toBe('AMD')
    expect(ctx!.name).toBe('Advanced Micro Devices Inc.')
    expect(ctx!.timeframe).toBeUndefined()
    expect(ctx!.timeframeLabel).toBeUndefined()
    expect(ctx!.avgVolume).toBeUndefined()
  })

  it('returns null for an empty series', () => {
    expect(buildChartContext([], { ref: { candlesKey: 'x' } })).toBeNull()
  })
})
