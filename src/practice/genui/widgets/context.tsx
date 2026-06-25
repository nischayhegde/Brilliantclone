/**
 * Thin React context that lets the chart-family widgets share the ONE real candle
 * slice / option chain a scenario is built on, and lets `payoff-graph` read the legs a
 * sibling `option-leg-builder` produced. WS-E wraps a rendered layout in these providers
 * (seeded from the spec's dataRef); every provider also accepts already-loaded data so
 * tests stay synchronous. Widgets degrade gracefully when no provider is present.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Candle } from '../../../data/candles'
import { loadCandles } from '../../corpus'
import { loadChain, type ChainSnapshot } from '../../chain'
import type { OptionLegDecision } from '../../types'
import type { WidgetDataRef } from '../types'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

// ── Candles ────────────────────────────────────────────────────────────────
export interface CandlesState {
  candles: Candle[]
  status: LoadStatus
  error?: string
  /** The data ref that produced these candles (for the provenance badge). */
  ref?: WidgetDataRef
}

const CandlesContext = createContext<CandlesState>({ candles: [], status: 'idle' })

function useLoadCandles(candles: Candle[] | undefined, dataRef: WidgetDataRef | undefined): CandlesState {
  const refKey = dataRef ? `${dataRef.candlesKey ?? ''}|${dataRef.ohlcAsset ?? ''}` : ''
  const [state, setState] = useState<CandlesState>(() =>
    candles ? { candles, status: 'ready', ref: dataRef } : { candles: [], status: dataRef ? 'loading' : 'idle', ref: dataRef },
  )
  useEffect(() => {
    if (candles) {
      setState({ candles, status: 'ready', ref: dataRef })
      return
    }
    if (!dataRef || (!dataRef.candlesKey && !dataRef.ohlcAsset)) {
      setState({ candles: [], status: 'idle', ref: dataRef })
      return
    }
    let alive = true
    setState({ candles: [], status: 'loading', ref: dataRef })
    loadCandles(dataRef)
      .then((c) => alive && setState({ candles: c, status: 'ready', ref: dataRef }))
      .catch((e) => alive && setState({ candles: [], status: 'error', error: String(e), ref: dataRef }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, refKey])
  return state
}

export function ChartDataProvider({
  candles,
  dataRef,
  children,
}: {
  candles?: Candle[]
  dataRef?: WidgetDataRef
  children: ReactNode
}) {
  const value = useLoadCandles(candles, dataRef)
  return <CandlesContext.Provider value={value}>{children}</CandlesContext.Provider>
}

export function useCandles(): CandlesState {
  return useContext(CandlesContext)
}

/**
 * Resolve the candles a chart widget should draw: its own `config.dataRef` (loaded on
 * demand) takes precedence, otherwise the shared provider's candles.
 */
export function useResolvedCandles(configRef?: WidgetDataRef): CandlesState {
  const ctx = useCandles()
  const own = useLoadCandles(undefined, configRef)
  if (configRef && (configRef.candlesKey || configRef.ohlcAsset)) return own
  return ctx
}

// ── Option chain ─────────────────────────────────────────────────────────────
export interface ChainState {
  chain: ChainSnapshot | null
  status: LoadStatus
  error?: string
}

const ChainContext = createContext<ChainState>({ chain: null, status: 'idle' })

function useLoadChain(chain: ChainSnapshot | undefined, dataRef: WidgetDataRef | undefined): ChainState {
  const asset = dataRef?.chainAsset ?? ''
  const [state, setState] = useState<ChainState>(() =>
    chain ? { chain, status: 'ready' } : { chain: null, status: asset ? 'loading' : 'idle' },
  )
  useEffect(() => {
    if (chain) {
      setState({ chain, status: 'ready' })
      return
    }
    if (!asset) {
      setState({ chain: null, status: 'idle' })
      return
    }
    let alive = true
    setState({ chain: null, status: 'loading' })
    loadChain(asset)
      .then((s) => alive && setState({ chain: s, status: 'ready' }))
      .catch((e) => alive && setState({ chain: null, status: 'error', error: String(e) }))
    return () => {
      alive = false
    }
  }, [chain, asset])
  return state
}

export function ChainDataProvider({
  chain,
  dataRef,
  children,
}: {
  chain?: ChainSnapshot
  dataRef?: WidgetDataRef
  children: ReactNode
}) {
  const value = useLoadChain(chain, dataRef)
  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>
}

export function useChain(): ChainState {
  return useContext(ChainContext)
}

export function useResolvedChain(configRef?: WidgetDataRef): ChainState {
  const ctx = useChain()
  const own = useLoadChain(undefined, configRef)
  if (configRef?.chainAsset) return own
  return ctx
}

// ── Legs (option-leg-builder → payoff-graph) ─────────────────────────────────
export type LegsMap = Record<string, OptionLegDecision[]>

interface LegsValue {
  legs: LegsMap
  publish: (id: string, legs: OptionLegDecision[]) => void
}

const LegsContext = createContext<LegsValue>({ legs: {}, publish: () => {} })

export function LegsProvider({ children, initial }: { children: ReactNode; initial?: LegsMap }) {
  const [legs, setLegs] = useState<LegsMap>(initial ?? {})
  const value = useMemo<LegsValue>(
    () => ({
      legs,
      publish: (id, l) =>
        setLegs((prev) => {
          const cur = prev[id]
          if (cur === l) return prev
          return { ...prev, [id]: l }
        }),
    }),
    [legs],
  )
  return <LegsContext.Provider value={value}>{children}</LegsContext.Provider>
}

export function useLegs(): LegsValue {
  return useContext(LegsContext)
}
