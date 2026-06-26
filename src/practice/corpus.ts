import { CANDLES, type Candle } from '../data/candles'
import type { DataRef } from './types'

/** Real per-asset metadata the ingester writes into every public/data/ohlc file. */
export interface OhlcMeta {
  ticker?: string
  /** Timeframe key, e.g. '1d' | '1h' | '15m'. */
  tf?: string
  currency?: string
  exchange?: string
  count?: number
  /** ISO day of the first bar, e.g. '2021-11-12'. */
  first?: string
  /** ISO day of the last bar. */
  last?: string
}

interface ColumnarOhlc {
  meta?: OhlcMeta
  t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v?: number[]
}

/** A decoded asset: the candle slice plus the real metadata + per-bar volume (when present). */
export interface OhlcBundle {
  candles: Candle[]
  meta?: OhlcMeta
  /** Per-bar volume aligned to `candles`, when the asset carries it. */
  volumes?: number[]
}

export function decodeColumnarOhlc(json: ColumnarOhlc): Candle[] {
  const out: Candle[] = []
  for (let i = 0; i < json.t.length; i++) {
    out.push({ t: json.t[i], o: json.o[i], h: json.h[i], l: json.l[i], c: json.c[i] })
  }
  return out
}

const cache = new Map<string, OhlcBundle>()
export function __clearCorpusCache(): void {
  cache.clear()
}

/**
 * Bundled CANDLES by key, or fetch+decode a public/data/ohlc asset (cached). Returns the full
 * bundle (candles + real meta + volumes); bundled keys carry no meta/volume. The fetch is shared
 * with `loadCandles`, so requesting the bundle after the candles is a cache hit (no extra network).
 */
export async function loadOhlcBundle(ref: DataRef): Promise<OhlcBundle> {
  if (ref.candlesKey) {
    const c = CANDLES[ref.candlesKey]
    if (!c) throw new Error(`Unknown candlesKey: ${ref.candlesKey}`)
    return { candles: c }
  }
  if (ref.ohlcAsset) {
    const cached = cache.get(ref.ohlcAsset)
    if (cached) return cached
    const res = await fetch(`/${ref.ohlcAsset}`)
    if (!res.ok) throw new Error(`Failed to load ${ref.ohlcAsset}: HTTP ${res.status}`)
    const json = (await res.json()) as ColumnarOhlc
    const bundle: OhlcBundle = { candles: decodeColumnarOhlc(json), meta: json.meta, volumes: json.v }
    cache.set(ref.ohlcAsset, bundle)
    return bundle
  }
  throw new Error('dataRef needs a candlesKey or ohlcAsset')
}

/** Bundled CANDLES by key, or fetch+decode a public/data/ohlc asset (cached). */
export async function loadCandles(ref: DataRef): Promise<Candle[]> {
  return (await loadOhlcBundle(ref)).candles
}

/**
 * Load the WINDOWED slice a scenario actually trades: the full asset, sliced to
 * `[startIndex, startIndex + revealToIndex)`. This is what powers procedural variety —
 * the same series yields many distinct setups. With no `startIndex`/`revealToIndex` it
 * returns the full series (so curated specs are unchanged). `splitIndex`/`revealToIndex`
 * remain relative to the returned slice, matching the chart + resolver. Volume is sliced
 * in lockstep so the context panel's stats line up with the bars shown.
 */
export async function loadOhlcWindow(ref: DataRef): Promise<OhlcBundle> {
  const bundle = await loadOhlcBundle(ref)
  const start = ref.startIndex ?? 0
  const total = bundle.candles.length
  const len = ref.revealToIndex ?? total - start
  if (start <= 0 && start + len >= total) return bundle // full series — no copy
  const end = Math.min(start + len, total)
  return {
    candles: bundle.candles.slice(start, end),
    meta: bundle.meta,
    volumes: bundle.volumes ? bundle.volumes.slice(start, end) : undefined,
  }
}
