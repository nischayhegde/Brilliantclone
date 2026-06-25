import type { Candle } from '../data/candles'
import type {
  ChartsDecision,
  Decision,
  MarketMakingDecision,
  OptionsDecision,
  ScenarioOutcome,
  ScenarioSpec,
  Track,
} from './types'
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

interface OptionsData {
  snapshot: ChainSnapshot
  underlying: Candle[]
}

function assertNever(x: never): never {
  throw new Error(`Unhandled scenario track: ${String(x)}`)
}

/**
 * The single track dispatch. `Decision` is a structural union with no runtime tag, so we
 * narrow it using the spec's authoritative `track` discriminant in an EXHAUSTIVE switch
 * (the `assertNever` default makes the compiler enforce that every track is handled, and
 * each branch asserts to the precise member type the resolver expects — no `as never`).
 */
export function resolveScenario(spec: ScenarioSpec, data: unknown, decision: Decision): ScenarioOutcome {
  switch (spec.track) {
    case 'charts':
      return resolveChartTrade(data as Candle[], decision as ChartsDecision, spec.dataRef)
    case 'options': {
      const { snapshot, underlying } = data as OptionsData
      const d = decision as OptionsDecision
      // IV is REAL: looked up per leg from the snapshot (used only for the labelled
      // closed-early model estimate; held-to-expiry P&L never uses it).
      const ivByLeg = d.legs.map(
        (leg) => findContract(snapshot, leg.expiry, leg.K, leg.type === 'call' ? 'C' : 'P')?.iv ?? 0.3,
      )
      return resolveOptionsPosition(underlying, spec.dataRef.decisionDate ?? snapshot.meta.date, d, { ivByLeg })
    }
    case 'market-making': {
      const { mids, sigma } = data as BookStats
      return simulateMarketMaking(decision as MarketMakingDecision, { mids, sigma })
    }
    default:
      return assertNever(spec.track)
  }
}

const chartsEngine: TrackEngine<Candle[]> = {
  sceneKind: 'chart-trade',
  loadData: (spec) => loadCandles(spec.dataRef),
  sceneParams: (spec, candles) => {
    const splitIndex = spec.dataRef.splitIndex ?? Math.floor(candles.length * 0.6)
    return { candles, splitIndex, entry: candles[splitIndex].c, constraints: spec.constraints }
  },
  resolve: resolveScenario,
}

const optionsEngine: TrackEngine<OptionsData> = {
  sceneKind: 'options-build',
  loadData: async (spec) => {
    const snapshot = await loadChain(spec.dataRef.chainAsset!)
    const underlying = await loadCandles({ ohlcAsset: `data/ohlc/${snapshot.meta.symbol}__1d.json` })
    return { snapshot, underlying }
  },
  sceneParams: (spec, data) => ({ snapshot: data.snapshot, constraints: spec.constraints }),
  resolve: resolveScenario,
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
  resolve: resolveScenario,
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
