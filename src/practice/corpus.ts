import { CANDLES, type Candle } from '../data/candles'
import type { DataRef } from './types'

interface ColumnarOhlc {
  t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v?: number[]
}

export function decodeColumnarOhlc(json: ColumnarOhlc): Candle[] {
  const out: Candle[] = []
  for (let i = 0; i < json.t.length; i++) {
    out.push({ t: json.t[i], o: json.o[i], h: json.h[i], l: json.l[i], c: json.c[i] })
  }
  return out
}

const cache = new Map<string, Candle[]>()
export function __clearCorpusCache(): void {
  cache.clear()
}

/** Bundled CANDLES by key, or fetch+decode a public/data/ohlc asset (cached). */
export async function loadCandles(ref: DataRef): Promise<Candle[]> {
  if (ref.candlesKey) {
    const c = CANDLES[ref.candlesKey]
    if (!c) throw new Error(`Unknown candlesKey: ${ref.candlesKey}`)
    return c
  }
  if (ref.ohlcAsset) {
    const cached = cache.get(ref.ohlcAsset)
    if (cached) return cached
    const res = await fetch(`/${ref.ohlcAsset}`)
    if (!res.ok) throw new Error(`Failed to load ${ref.ohlcAsset}: HTTP ${res.status}`)
    const decoded = decodeColumnarOhlc((await res.json()) as ColumnarOhlc)
    cache.set(ref.ohlcAsset, decoded)
    return decoded
  }
  throw new Error('dataRef needs a candlesKey or ohlcAsset')
}
