import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../lib/firebase'
import { initialProgress, type Progress } from '../domain/progress'

/** Per-lesson progress keyed by lesson id (e.g. 'reading-charts'). */
export type LessonProgressMap = Record<string, Progress>

export interface UserDoc {
  email: string | null
  displayName: string | null
  photoURL: string | null
  lessonProgress: LessonProgressMap
  bestStreak: number
}

const USERS = 'users'

/**
 * Idempotent: returns the existing doc, or creates a fresh one on first login.
 *
 * Storage note: per-lesson progress lives in `lessonProgress`. A legacy top-level
 * `progress` field (the old single-lesson shape) is still written so the DEPLOYED
 * Firestore security rules — which validate `progress` and a monotonic `bestStreak`
 * — keep accepting our writes with no rules redeploy. Any pre-existing single-lesson
 * `progress` is migrated into `lessonProgress['reading-charts']`.
 */
export async function getOrCreateUserDoc(user: User): Promise<UserDoc> {
  const ref = doc(db, USERS, user.uid)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>
    const lessonProgress = (data.lessonProgress as LessonProgressMap | undefined) ?? {}

    // One-time migration from the original single-lesson `progress` field.
    const legacy = data.progress as Progress | undefined
    if (
      !lessonProgress['reading-charts'] &&
      legacy &&
      Array.isArray(legacy.completedModules) &&
      legacy.completedModules.length > 0
    ) {
      lessonProgress['reading-charts'] = legacy
    }

    return {
      email: (data.email as string) ?? user.email,
      displayName: (data.displayName as string) ?? user.displayName,
      photoURL: (data.photoURL as string) ?? user.photoURL,
      lessonProgress,
      bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
    }
  }

  const fresh: UserDoc = {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    lessonProgress: {},
    bestStreak: 0,
  }
  await setDoc(ref, {
    ...fresh,
    progress: initialProgress(), // legacy field required by the create rule
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return fresh
}

/**
 * Persists the per-lesson progress map. A merge write that leaves the legacy
 * `progress` and `bestStreak` fields untouched, so the monotonic update rule holds
 * trivially.
 */
export async function persistLessonProgress(
  uid: string,
  lessonProgress: LessonProgressMap,
): Promise<void> {
  const ref = doc(db, USERS, uid)
  await setDoc(ref, { lessonProgress, updatedAt: serverTimestamp() }, { merge: true })
}

/**
 * Persists a new best streak in its own write. Guarded by the monotonic security
 * rule, so a write that would lower a higher remote value is rejected harmlessly —
 * progress is already saved separately.
 */
export async function persistBestStreak(uid: string, bestStreak: number): Promise<void> {
  const ref = doc(db, USERS, uid)
  await setDoc(ref, { bestStreak, updatedAt: serverTimestamp() }, { merge: true })
}
