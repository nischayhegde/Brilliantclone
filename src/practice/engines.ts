import type { Candle } from '../data/candles'
import type { Decision, OptionsDecision, ScenarioOutcome, ScenarioSpec, Track } from './types'
import { loadCandles } from './corpus'
import { findContract, loadChain, type ChainSnapshot } from './chain'
import { resolveChartTrade } from './resolve/charts'
import { resolveOptionsPosition } from './resolve/options'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ENGINES: Record<Track, TrackEngine<any>> = {
  charts: chartsEngine,
  options: optionsEngine,
  'market-making': chartsEngine, // placeholder until M5 (never selected: no MM specs yet)
}

export function getEngine(track: Track): TrackEngine<unknown> {
  return ENGINES[track]
}
