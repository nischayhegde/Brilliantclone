import type { Candle } from '../data/candles'
import type { Decision, OptionsDecision, ScenarioOutcome, ScenarioSpec, Track } from './types'
import { loadCandles } from './corpus'
import { findContract, loadChain, type ChainSnapshot } from './chain'
import { resolveChartTrade } from './resolve/charts'
import { resolveOptionsPosition } from './resolve/options'
import { bookStatsFromCandles, type BookStats } from './bookStats'
import { simulateMarketMaking } from './resolve/marketMaking'

export interface TrackEngine<Data> {
  sceneKind: string
  loadData: (spec: ScenarioSpec) => Promise<Data>
  sceneParams: (spec: ScenarioSpec, data: Data) => Record<string, unknown>
  resolve: (spec: ScenarioSpec, data: Data, decision: Decision) => ScenarioOutcome
}

const chartsEngine: TrackEngine<Candle[]> = {
  sceneKind: 'chart-trade',
  loadData: (spec) => loadCandles(spec.dataRef),
  sceneParams: (spec, candles) => {
    const splitIndex = spec.dataRef.splitIndex ?? Math.floor(candles.length * 0.6)
    return { candles, splitIndex, entry: candles[splitIndex].c, constraints: spec.constraints }
  },
  resolve: (spec, candles, decision) => resolveChartTrade(candles, decision as never, spec.dataRef),
}

interface OptionsData {
  snapshot: ChainSnapshot
  underlying: Candle[]
}

const optionsEngine: TrackEngine<OptionsData> = {
  sceneKind: 'options-build',
  loadData: async (spec) => {
    const snapshot = await loadChain(spec.dataRef.chainAsset!)
    const underlying = await loadCandles({ ohlcAsset: `data/ohlc/${snapshot.meta.symbol}__1d.json` })
    return { snapshot, underlying }
  },
  sceneParams: (spec, data) => ({ snapshot: data.snapshot, constraints: spec.constraints }),
  resolve: (spec, data, decision) => {
    const d = decision as OptionsDecision
    // IV is REAL: looked up per leg from the snapshot (used only for the labelled
    // closed-early model estimate; held-to-expiry P&L never uses it).
    const ivByLeg = d.legs.map(
      (leg) => findContract(data.snapshot, leg.expiry, leg.K, leg.type === 'call' ? 'C' : 'P')?.iv ?? 0.3,
    )
    return resolveOptionsPosition(
      data.underlying,
      spec.dataRef.decisionDate ?? data.snapshot.meta.date,
      d,
      { ivByLeg },
    )
  },
}

/**
 * Track B (market making). The mid path is REAL (close prices from the bundled OHLC);
 * the order flow is a deterministic, labelled illustrative simulation calibrated to the
 * path's realized volatility. The session math (spread/inventory/mark-to-market) is exact
 * and RNG-free, so re-running a scenario with the same inputs reproduces the outcome.
 */
const marketMakingEngine: TrackEngine<BookStats> = {
  sceneKind: 'market-make',
  loadData: async (spec) => bookStatsFromCandles(await loadCandles(spec.dataRef)),
  sceneParams: (spec, data) => ({
    sceneKey: 'MarketMakeScene',
    mids: data.mids,
    sigma: data.sigma,
    mid0: data.mid0,
    constraints: spec.constraints,
  }),
  resolve: (_spec, data, decision) =>
    simulateMarketMaking(decision as never, { mids: data.mids, sigma: data.sigma }),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ENGINES: Record<Track, TrackEngine<any>> = {
  charts: chartsEngine,
  options: optionsEngine,
  'market-making': marketMakingEngine,
}

export function getEngine(track: Track): TrackEngine<unknown> {
  return ENGINES[track]
}
