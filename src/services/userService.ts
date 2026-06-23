import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../lib/firebase'
import { initialProgress, type Progress } from '../domain/progress'

export interface UserDoc {
  email: string | null
  displayName: string | null
  photoURL: string | null
  progress: Progress
  bestStreak: number
}

const USERS = 'users'

/** Idempotent: returns the existing doc, or creates a fresh one on first login. */
export async function getOrCreateUserDoc(user: User): Promise<UserDoc> {
  const ref = doc(db, USERS, user.uid)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    const data = snap.data() as Partial<UserDoc>
    return {
      email: data.email ?? user.email,
      displayName: data.displayName ?? user.displayName,
      photoURL: data.photoURL ?? user.photoURL,
      progress: data.progress ?? initialProgress(),
      bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
    }
  }

  const fresh: UserDoc = {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    progress: initialProgress(),
    bestStreak: 0,
  }
  await setDoc(ref, {
    ...fresh,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return fresh
}

/**
 * Persists progress ONLY (never bestStreak). Decoupling the two means a stale local
 * bestStreak baseline can never violate the monotonic security rule and block the
 * progress write. Relies on getOrCreateUserDoc having created the doc first (a
 * merge-write onto a missing doc is a create, which the rules reject without the
 * required profile fields — safe, never silently half-creates).
 */
export async function persistProgress(uid: string, progress: Progress): Promise<void> {
  const ref = doc(db, USERS, uid)
  await setDoc(ref, { progress, updatedAt: serverTimestamp() }, { merge: true })
}

/**
 * Persists a new best streak in its own write. Guarded by the monotonic security
 * rule, so a write that would lower a higher remote value (e.g. a stale baseline on
 * another device) is rejected harmlessly — progress is already saved separately.
 */
export async function persistBestStreak(uid: string, bestStreak: number): Promise<void> {
  const ref = doc(db, USERS, uid)
  await setDoc(ref, { bestStreak, updatedAt: serverTimestamp() }, { merge: true })
}
