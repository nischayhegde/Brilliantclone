/**
 * Deterministic, app-owned CHART CONTEXT — the factual background a learner needs to make an
 * informed decision: which instrument, what timeframe, the exact window/timestamps, and a real
 * price-action summary. Everything here is computed from REAL data (candle timestamps + the
 * asset's own meta + the curated instrument map); nothing is model-generated and none of it
 * feeds the math. Pure module — no React/DOM — so it stays easy to unit-test.
 */
import type { Candle } from '../data/candles'
import type { DataRef } from './types'
import type { OhlcMeta } from './corpus'
import { instrumentInfo } from './instruments'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TF_LABEL: Record<string, string> = {
  '1m': '1-minute',
  '5m': '5-minute',
  '15m': '15-minute',
  '30m': '30-minute',
  '1h': 'Hourly',
  '1d': 'Daily',
  '1wk': 'Weekly',
  '1mo': 'Monthly',
}

/** A timeframe is intraday when its unit is minutes or hours (finer than one day). */
export function isIntradayTf(tf?: string): boolean {
  return !!tf && /^\d+(m|h)$/.test(tf)
}

export function timeframeLabel(tf?: string): string | undefined {
  if (!tf) return undefined
  return TF_LABEL[tf] ?? tf
}

/** Infer the timeframe key from an OHLC asset path, e.g. `data/ohlc/AAPL__1h.json` → `1h`. */
export function timeframeFromAsset(ohlcAsset?: string): string | undefined {
  return ohlcAsset ? /__([0-9]+[a-z]+|[0-9]+[a-z]{2})\.json$/i.exec(ohlcAsset)?.[1] : undefined
}

/** Infer a ticker from a candles key / asset path, e.g. `asctri_quiz_AMD` → `AMD`, `data/ohlc/BRK-B__1d.json` → `BRK-B`. */
export function tickerFromRef(ref?: DataRef): string | undefined {
  // OHLC assets are named `${ticker}__${tf}.json`, so the part before `__` is the exact
  // ticker (preserves hyphens like BRK-B). Fall back to a segment scan for bundled keys.
  if (ref?.ohlcAsset) {
    const base = ref.ohlcAsset.split('/').pop() ?? ref.ohlcAsset
    const prefix = base.split('__')[0]
    if (prefix) return prefix.toUpperCase()
  }
  const key = ref?.candlesKey
  if (!key) return undefined
  const segs = key.split(/[_./]/)
  for (const s of segs) {
    const m = /^([A-Z]{1,6})\d*$/.exec(s)
    if (m) return m[1]
  }
  const first = segs[0]
  return /^[a-z]{1,6}$/.test(first) ? first.toUpperCase() : undefined
}

/** Exact UTC day label, e.g. `12 Nov 2021`. */
export function fmtDay(t: number): string {
  const d = new Date(t * 1000)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Exact UTC timestamp; includes the time of day for intraday bars, else just the day. */
export function fmtStamp(t: number, intraday: boolean): string {
  if (!intraday) return fmtDay(t)
  const d = new Date(t * 1000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${fmtDay(t)}, ${hh}:${mm} UTC`
}

/** Compact volume, e.g. 52_300_000 → `52.3M`. */
export function fmtVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return String(Math.round(v))
}

export interface ChartContext {
  ticker?: string
  name?: string
  sector?: string
  /** Raw timeframe key, e.g. `1d`. */
  timeframe?: string
  /** Human timeframe, e.g. `Daily`. */
  timeframeLabel?: string
  intraday: boolean
  /** Exact start/end of the visible window. */
  firstLabel: string
  lastLabel: string
  /** Number of bars in the visible window. */
  bars: number
  lastClose: number
  high: number
  low: number
  /** Percent change across the visible window (first close → last close). */
  pctChange: number
  /** Average per-bar volume over the window, when the asset carries volume. */
  avgVolume?: number
}

export interface ChartContextDeps {
  ref?: DataRef
  meta?: OhlcMeta
  volumes?: number[]
}

/** Build the factual context for a candle window. Returns null for an empty series. */
export function buildChartContext(candles: Candle[], deps: ChartContextDeps = {}): ChartContext | null {
  if (!candles.length) return null
  const { ref, meta, volumes } = deps
  const ticker = meta?.ticker ?? tickerFromRef(ref)
  const tf = meta?.tf ?? timeframeFromAsset(ref?.ohlcAsset)
  const info = instrumentInfo(ticker)
  const intraday = isIntradayTf(tf)

  const first = candles[0]
  const last = candles[candles.length - 1]
  let high = -Infinity
  let low = Infinity
  for (const c of candles) {
    if (c.h > high) high = c.h
    if (c.l < low) low = c.l
  }

  const avgVolume =
    volumes && volumes.length
      ? volumes.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0) / volumes.length
      : undefined

  return {
    ticker,
    name: info?.name,
    sector: info?.sector,
    timeframe: tf,
    timeframeLabel: timeframeLabel(tf),
    intraday,
    firstLabel: fmtStamp(first.t, intraday),
    lastLabel: fmtStamp(last.t, intraday),
    bars: candles.length,
    lastClose: last.c,
    high,
    low,
    pctChange: first.c ? ((last.c - first.c) / first.c) * 100 : 0,
    avgVolume,
  }
}
