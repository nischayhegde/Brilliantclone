import type { DataCatalog } from './types'
import type { Track } from '../types'
import { CANDLES } from '../../data/candles'
import { RUBRICS } from '../rubrics'
import { NUDGES } from '../nudges'

/** Shape of public/data/manifest.json (OHLC) — only the fields we consume. */
export interface OhlcManifest {
  timeframes: string[]
  tickers: Record<string, Record<string, { count: number; file: string }>>
}
/** Shape of public/data/options-manifest.json — only the fields we consume. */
export interface OptionsManifest {
  symbols: Record<string, { date: string; file: string; spot: number; contracts: number }[]>
}

export interface CatalogDeps {
  loadOhlcManifest?: () => Promise<OhlcManifest>
  loadOptionsManifest?: () => Promise<OptionsManifest>
}

/** A series needs enough bars to carve a setup + reveal window. */
export const MIN_OHLC_BARS = 60

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`manifest fetch failed: ${path} (${res.status})`)
  return (await res.json()) as T
}

// Cache the manifests so we hit the network at most once per session.
let ohlcCache: Promise<OhlcManifest> | undefined
let optionsCache: Promise<OptionsManifest> | undefined

/**
 * Build the full real-data allow-list the composer may reference. Charts/MM draw from
 * EVERY ingested OHLC series (manifest.json) with enough bars, plus the bundled candle
 * keys for instant cold start. Options draw from EVERY chain snapshot (options-manifest.json).
 * This is the engine of near-endless variety: asset × timeframe × snapshot × (slice/framing/tier).
 */
export async function buildCatalog(track: Track, deps: CatalogDeps = {}): Promise<DataCatalog> {
  const rubricIds = Object.keys(RUBRICS).filter((id) => id !== 'noop')
  const nudgeIds = Object.keys(NUDGES)

  if (track === 'options') {
    const load = deps.loadOptionsManifest ?? (() => (optionsCache ??= fetchJson<OptionsManifest>('/data/options-manifest.json')))
    const man = await load()
    const chainAssets = Object.values(man.symbols).flat().map((s) => s.file)
    return { track, candlesKeys: [], ohlcAssets: [], chainAssets, rubricIds, nudgeIds }
  }

  // charts + market-making both trade an underlying OHLC series.
  const load = deps.loadOhlcManifest ?? (() => (ohlcCache ??= fetchJson<OhlcManifest>('/data/manifest.json')))
  const man = await load()
  const ohlcAssets: string[] = []
  for (const byTimeframe of Object.values(man.tickers)) {
    for (const info of Object.values(byTimeframe)) {
      if ((info.count ?? 0) >= MIN_OHLC_BARS) ohlcAssets.push(info.file)
    }
  }
  return { track, candlesKeys: Object.keys(CANDLES), ohlcAssets, chainAssets: [], rubricIds, nudgeIds }
}

/** Test/dev helper: clear the memoised manifests. */
export function __resetCatalogCache(): void {
  ohlcCache = undefined
  optionsCache = undefined
}
