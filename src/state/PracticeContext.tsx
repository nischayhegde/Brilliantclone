import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  appendPracticeRun,
  getOrCreatePracticeData,
  loadRecentRuns,
  persistPracticeState,
} from '../services/practiceService'
import { accountReducer, initialAccount, type PracticeAccount } from '../practice/account'
import { getScenario, scenariosFor } from '../practice/scenarioRegistry'
import type { PracticeRun, ScenarioSpec, Track } from '../practice/types'

interface PracticeValue {
  loading: boolean
  account: PracticeAccount
  recentRuns: PracticeRun[]
  /** Pick the next scenario for a track at the account's current tier (adaptive in M4). */
  nextScenario: (track?: Track) => ScenarioSpec | undefined
  /** Apply a graded run: update balance/skill/tier, persist, append to history. */
  applyResult: (run: PracticeRun) => void
}

const Ctx = createContext<PracticeValue | undefined>(undefined)

export function PracticeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState<PracticeAccount>(initialAccount())
  const [recentRuns, setRecentRuns] = useState<PracticeRun[]>([])
  const accountRef = useRef<PracticeAccount>(initialAccount())

  useEffect(() => {
    let active = true
    accountRef.current = initialAccount()
    setAccount(initialAccount())
    setRecentRuns([])
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

  const nextScenario = useCallback(
    (track: Track = 'charts'): ScenarioSpec | undefined => {
      const tier = accountRef.current.tier[track]
      const atTier = scenariosFor(track, tier)
      const pool = atTier.length ? atTier : scenariosFor(track)
      // Avoid immediate repeats where possible.
      const recentIds = new Set(recentRuns.slice(0, 5).map((r) => r.specId))
      return pool.find((s) => !recentIds.has(s.id)) ?? pool[0]
    },
    [recentRuns],
  )

  const applyResult = useCallback(
    (run: PracticeRun) => {
      if (!user) return
      const spec = getScenario(run.specId)
      const track = spec?.track ?? run.track
      const next = accountReducer(accountRef.current, {
        type: 'APPLY_RESULT',
        track,
        score: run.score,
        pnl: run.pnl,
      })
      accountRef.current = next
      setAccount(next)
      setRecentRuns((prev) => [run, ...prev].slice(0, 20))
      // Optimistic: persistence failures never block play.
      persistPracticeState(user.uid, next).catch((e) => console.error('persist account', e))
      appendPracticeRun(user.uid, run).catch((e) => console.error('append run', e))
    },
    [user],
  )

  return (
    <Ctx.Provider value={{ loading, account, recentRuns, nextScenario, applyResult }}>{children}</Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePractice(): PracticeValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePractice must be used within a PracticeProvider')
  return ctx
}
