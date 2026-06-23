import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import { getOrCreateUserDoc, persistBestStreak, persistProgress } from '../services/userService'
import {
  initialProgress,
  isLessonComplete,
  nextModuleId,
  progressCount,
  progressReducer,
  type Progress,
} from '../domain/progress'
import { computeBestStreak, isNewSitting, nextSitting } from '../domain/streak'

interface LessonProgressValue {
  loading: boolean
  progress: Progress
  bestStreak: number
  currentSitting: number
  /** Next module to play (1..24), or 25 once the lesson is finished. */
  resumeModuleId: number
  completedCount: number
  isComplete: boolean
  completeModule: (moduleId: number) => void
}

const LessonProgressContext = createContext<LessonProgressValue | undefined>(undefined)

export function LessonProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<Progress>(initialProgress)
  const [bestStreak, setBestStreak] = useState(0)
  const [currentSitting, setCurrentSitting] = useState(0)

  // Refs mirror state so completeModule reads fresh values even on rapid calls.
  const progressRef = useRef<Progress>(progress)
  const bestStreakRef = useRef(0)
  const sittingRef = useRef(0)
  const lastActivityRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true

    // Reset to a clean slate on EVERY user change (sign-out, or a direct A->B
    // account switch with no intervening null) so the previous user's progress
    // and streak can never leak into another account's writes.
    progressRef.current = initialProgress()
    bestStreakRef.current = 0
    sittingRef.current = 0
    lastActivityRef.current = null
    setProgress(initialProgress())
    setBestStreak(0)
    setCurrentSitting(0)

    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    getOrCreateUserDoc(user)
      .then((docData) => {
        if (!active) return
        progressRef.current = docData.progress
        bestStreakRef.current = docData.bestStreak
        setProgress(docData.progress)
        setBestStreak(docData.bestStreak)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load progress', err)
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const completeModule = useCallback(
    (moduleId: number) => {
      if (!user) return
      const uid = user.uid

      const prev = progressRef.current
      const updated = progressReducer(prev, { type: 'COMPLETE_MODULE', moduleId })
      if (updated === prev) return // already done — no double count, no write

      progressRef.current = updated
      setProgress(updated)

      // "Most modules completed in one sitting" — a gap > 30 min starts a fresh sitting.
      const now = Date.now()
      const sitting = isNewSitting(lastActivityRef.current, now)
        ? 1
        : nextSitting(sittingRef.current)
      lastActivityRef.current = now
      sittingRef.current = sitting
      setCurrentSitting(sitting)

      const prevBest = bestStreakRef.current
      const newBest = computeBestStreak(prevBest, sitting)
      bestStreakRef.current = newBest
      setBestStreak(newBest)

      // Optimistic UI: persistence failures never block play. Two writes keep the
      // progress save independent of the monotonic bestStreak guard.
      persistProgress(uid, updated).catch((err) =>
        console.error('Failed to persist progress', err),
      )
      if (newBest > prevBest) {
        persistBestStreak(uid, newBest).catch((err) =>
          console.error('Failed to persist streak', err),
        )
      }
    },
    [user],
  )

  const value: LessonProgressValue = {
    loading,
    progress,
    bestStreak,
    currentSitting,
    resumeModuleId: nextModuleId(progress),
    completedCount: progressCount(progress),
    isComplete: isLessonComplete(progress),
    completeModule,
  }

  return (
    <LessonProgressContext.Provider value={value}>{children}</LessonProgressContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLessonProgress(): LessonProgressValue {
  const ctx = useContext(LessonProgressContext)
  if (!ctx) throw new Error('useLessonProgress must be used within a LessonProgressProvider')
  return ctx
}
