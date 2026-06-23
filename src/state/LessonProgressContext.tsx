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
import {
  getOrCreateUserDoc,
  persistBestStreak,
  persistLessonProgress,
  type LessonProgressMap,
} from '../services/userService'
import {
  initialProgress,
  isLessonComplete,
  nextModuleId,
  progressCount,
  progressReducer,
  type Progress,
} from '../domain/progress'
import { computeBestStreak, isNewSitting, nextSitting } from '../domain/streak'
import { lessonTotal } from '../lessons/registry'

export interface LessonStats {
  total: number
  completedCount: number
  /** Next module to play (1..total), or total+1 once finished. */
  resumeModuleId: number
  isComplete: boolean
}

interface LessonProgressValue {
  loading: boolean
  bestStreak: number
  currentSitting: number
  getProgress: (lessonId: string) => Progress
  stats: (lessonId: string) => LessonStats
  completeModule: (lessonId: string, moduleId: number) => void
  /** Clear a lesson's progress so it starts fresh from module 1 (bestStreak kept). */
  resetLesson: (lessonId: string) => void
}

const LessonProgressContext = createContext<LessonProgressValue | undefined>(undefined)

export function LessonProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [progressMap, setProgressMap] = useState<LessonProgressMap>({})
  const [bestStreak, setBestStreak] = useState(0)
  const [currentSitting, setCurrentSitting] = useState(0)

  const mapRef = useRef<LessonProgressMap>({})
  const bestStreakRef = useRef(0)
  const sittingRef = useRef(0)
  const lastActivityRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true

    // Hard reset on every user change so one account's progress can't leak to another.
    mapRef.current = {}
    bestStreakRef.current = 0
    sittingRef.current = 0
    lastActivityRef.current = null
    setProgressMap({})
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
        mapRef.current = docData.lessonProgress
        bestStreakRef.current = docData.bestStreak
        setProgressMap(docData.lessonProgress)
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

  const getProgress = useCallback(
    (lessonId: string): Progress => progressMap[lessonId] ?? initialProgress(),
    [progressMap],
  )

  const stats = useCallback(
    (lessonId: string): LessonStats => {
      const total = lessonTotal(lessonId)
      const p = progressMap[lessonId] ?? initialProgress()
      return {
        total,
        completedCount: progressCount(p),
        resumeModuleId: nextModuleId(p),
        isComplete: total > 0 && isLessonComplete(p, total),
      }
    },
    [progressMap],
  )

  const completeModule = useCallback(
    (lessonId: string, moduleId: number) => {
      if (!user) return
      const uid = user.uid
      const total = lessonTotal(lessonId)

      const prev = mapRef.current[lessonId] ?? initialProgress()
      const updated = progressReducer(prev, { type: 'COMPLETE_MODULE', moduleId, total })
      if (updated === prev) return // already done — no double count, no write

      const nextMap = { ...mapRef.current, [lessonId]: updated }
      mapRef.current = nextMap
      setProgressMap(nextMap)

      // "Most modules completed in one sitting" — a gap > 30 min starts a fresh sitting.
      const now = Date.now()
      const sitting = isNewSitting(lastActivityRef.current, now) ? 1 : nextSitting(sittingRef.current)
      lastActivityRef.current = now
      sittingRef.current = sitting
      setCurrentSitting(sitting)

      const prevBest = bestStreakRef.current
      const newBest = computeBestStreak(prevBest, sitting)
      bestStreakRef.current = newBest
      setBestStreak(newBest)

      // Optimistic UI: persistence failures never block play.
      persistLessonProgress(uid, nextMap).catch((err) =>
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

  const resetLesson = useCallback(
    (lessonId: string) => {
      if (!user) return
      const prev = mapRef.current[lessonId]
      if (!prev || prev.completedModules.length === 0) return // already fresh — no write
      const nextMap = { ...mapRef.current, [lessonId]: initialProgress() }
      mapRef.current = nextMap
      setProgressMap(nextMap)
      persistLessonProgress(user.uid, nextMap).catch((err) =>
        console.error('Failed to reset lesson', err),
      )
    },
    [user],
  )

  const value: LessonProgressValue = {
    loading,
    bestStreak,
    currentSitting,
    getProgress,
    stats,
    completeModule,
    resetLesson,
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
