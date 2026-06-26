import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  appendPracticeRun,
  getOrCreatePracticeData,
  loadRecentRuns,
  persistPracticeState,
} from '../services/practiceService'
import { accountReducer, initialAccount, isRuined, type PracticeAccount } from '../practice/account'
import { getScenario } from '../practice/scenarioRegistry'
import { summarizeRuin, type RuinSummary } from '../practice/reflect'
import type { PracticeRun, ScenarioSpec, Track } from '../practice/types'
import { getComposeFn } from '../services/aiModel'
import { composeScenario, type ComposeResult } from '../practice/ai/composer'
import { makeScenarioQueue } from '../practice/ai/scenarioQueue'
import { buildCatalog } from '../practice/ai/catalog'
import type { DataCatalog } from '../practice/ai/types'
import { PracticeAnalytics, evReset } from '../practice/analytics'
import { firestoreSink, noopSink } from '../services/analyticsSink'

interface PracticeValue {
  loading: boolean
  account: PracticeAccount
  recentRuns: PracticeRun[]
  /**
   * LLM-primary: serve a bespoke composed scenario via the prefetch queue (instant when
   * warm). Curated specs are only the cold-start + the silent fallback inside the composer.
   */
  nextScenario: (track?: Track) => Promise<ScenarioSpec>
  /** Resolve a scenario that nextScenario already produced (LLM specs aren't in the registry). */
  getComposedScenario: (id: string) => ScenarioSpec | undefined
  /** Warm the prefetch queue for a track so the first real scenario is usually already LLM. */
  primeScenarios: (track?: Track) => void
  /** True when a model client is configured; false → curated-only mode. */
  aiEnabled: boolean
  /** Apply a graded run: update balance/skill/tier, persist, append to history. */
  applyResult: (run: PracticeRun) => void
  /** True after a ruin event (balance ≤ floor); the UI must route into the coached reset. */
  pendingRuin: boolean
  /** Diagnosis of the most recent ruin, drawn from real history (null until ruined). */
  ruinSummary: RuinSummary | null
  /** Coached reset: refill to $10k, drop one tier per track, count the ruin, clear the gate. */
  resetAndReflect: () => void
  /** Privacy-light learning analytics; Firestore-backed when signed in, no-op otherwise. */
  analytics: PracticeAnalytics
}

const Ctx = createContext<PracticeValue | undefined>(undefined)

export function PracticeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState<PracticeAccount>(initialAccount())
  const [recentRuns, setRecentRuns] = useState<PracticeRun[]>([])
  const [pendingRuin, setPendingRuin] = useState(false)
  const [ruinSummary, setRuinSummary] = useState<RuinSummary | null>(null)
  const accountRef = useRef<PracticeAccount>(initialAccount())
  // Mirror of recentRuns so applyResult can diagnose ruin from current history without
  // re-subscribing the callback (avoids a stale closure when balance hits the floor).
  const recentRunsRef = useRef<PracticeRun[]>([])
  // Specs produced by nextScenario (LLM-composed or curated) so the player can resolve
  // them by id even though LLM specs never live in the static scenario registry.
  const composedById = useRef<Map<string, ScenarioSpec>>(new Map())

  useEffect(() => {
    let active = true
    accountRef.current = initialAccount()
    setAccount(initialAccount())
    setRecentRuns([])
    recentRunsRef.current = []
    setPendingRuin(false)
    setRuinSummary(null)
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([getOrCreatePracticeData(user.uid), loadRecentRuns(user.uid)])
      .then(([{ account }, runs]) => {
        if (!active) return
        accountRef.current = account
        setAccount(account)
        setRecentRuns(runs)
        recentRunsRef.current = runs
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load practice data', err)
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  // One queue for the provider lifetime. compose() calls the SERVER composeScenario callable
  // (GPT-5.5-authored, server-validated LAYOUT spec) when wired, else a curated layout spec.
  const queue = useMemo(() => {
    const composeFn = getComposeFn()
    // composeScenario(req, null) only reads track/tier to pick a curated spec; the catalog is unused.
    const curatedCatalog = (track: Track): DataCatalog => ({ track, candlesKeys: [], ohlcAssets: [], chainAssets: [], rubricIds: [], nudgeIds: [] })
    const compose = async (track: Track): Promise<ComposeResult> => {
      const tier = accountRef.current.tier[track]
      const accountBalance = accountRef.current.balance
      if (!composeFn) return composeScenario({ track, tier, accountBalance, catalog: curatedCatalog(track) }, null)
      // buildCatalog reads the full ingested manifests (cached after the first call); the
      // server validates the composed layout against this allow-list.
      const catalog = await buildCatalog(track)
      return composeScenario({ track, tier, accountBalance, catalog }, composeFn)
    }
    return makeScenarioQueue(compose)
  }, [])

  const aiEnabled = useMemo(() => getComposeFn() !== null, [])

  // Privacy-light analytics: writes go under the signed-in user's own document tree;
  // signed-out sessions use the no-op sink. The emitter swallows sink errors, so
  // analytics can never break practice.
  const analytics = useMemo(
    () => new PracticeAnalytics({ sink: user ? firestoreSink(user.uid) : noopSink }),
    [user],
  )

  // LLM-primary: take from the queue (instant if prefetched; composes on demand otherwise).
  const nextScenario = useCallback(
    async (track: Track = 'charts'): Promise<ScenarioSpec> => {
      const spec = await queue.take(track)
      if (spec) composedById.current.set(spec.id, spec)
      return spec
    },
    [queue],
  )

  const getComposedScenario = useCallback(
    (id: string): ScenarioSpec | undefined => composedById.current.get(id),
    [],
  )

  // Warm the queue for a track (call on track-card mount/select).
  const primeScenarios = useCallback((track: Track = 'charts') => queue.prime(track), [queue])

  const applyResult = useCallback(
    (run: PracticeRun) => {
      if (!user) return
      const spec = getScenario(run.specId) ?? composedById.current.get(run.specId)
      const track = spec?.track ?? run.track
      const next = accountReducer(accountRef.current, {
        type: 'APPLY_RESULT',
        track,
        score: run.score,
        pnl: run.pnl,
      })
      accountRef.current = next
      setAccount(next)
      const updatedRuns = [run, ...recentRunsRef.current].slice(0, 20)
      recentRunsRef.current = updatedRuns
      setRecentRuns(updatedRuns)
      // Ruin → gate into the coached reset with a diagnosis from real history.
      if (isRuined(next)) {
        setPendingRuin(true)
        setRuinSummary(summarizeRuin(updatedRuns))
      }
      // Optimistic: persistence failures never block play.
      persistPracticeState(user.uid, next).catch((e) => console.error('persist account', e))
      appendPracticeRun(user.uid, run).catch((e) => console.error('append run', e))
    },
    [user],
  )

  const resetAndReflect = useCallback(() => {
    if (!user) return
    const next = accountReducer(accountRef.current, { type: 'RESET_AND_REFLECT' })
    accountRef.current = next
    setAccount(next)
    setPendingRuin(false)
    setRuinSummary(null)
    void analytics.emit(evReset({ ruinEvents: next.ruinEvents }))
    persistPracticeState(user.uid, next).catch((e) => console.error('persist reset', e))
  }, [user, analytics])

  return (
    <Ctx.Provider
      value={{
        loading,
        account,
        recentRuns,
        nextScenario,
        getComposedScenario,
        primeScenarios,
        aiEnabled,
        applyResult,
        pendingRuin,
        ruinSummary,
        resetAndReflect,
        analytics,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePractice(): PracticeValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePractice must be used within a PracticeProvider')
  return ctx
}
