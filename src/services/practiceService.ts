import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { initialAccount, type PracticeAccount } from '../practice/account'
import type { PracticeRun } from '../practice/types'

const USERS = 'users'

/**
 * Reads the additive `practice` object from the user doc (created lazily). Never
 * creates the user doc itself — getOrCreateUserDoc (userService) owns creation, so
 * this stays a pure merge-reader and the legacy create rule is untouched.
 */
export async function getOrCreatePracticeData(uid: string): Promise<{ account: PracticeAccount }> {
  const ref = doc(db, USERS, uid)
  const snap = await getDoc(ref)
  const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {}
  const practice = data.practice as { account?: PracticeAccount } | undefined
  return { account: practice?.account ?? initialAccount() }
}

/** Merge-write the account under `practice.account`; leaves legacy fields untouched. */
export async function persistPracticeState(uid: string, account: PracticeAccount): Promise<void> {
  const ref = doc(db, USERS, uid)
  await setDoc(ref, { practice: { account, updatedAt: serverTimestamp() } }, { merge: true })
}

/** Append one completed run to the practiceHistory subcollection. */
export async function appendPracticeRun(uid: string, run: PracticeRun): Promise<void> {
  const col = collection(db, USERS, uid, 'practiceHistory')
  await addDoc(col, { ...run, createdAt: serverTimestamp() })
}

/** Most-recent runs for the debrief/history view. */
export async function loadRecentRuns(uid: string, n = 20): Promise<PracticeRun[]> {
  const col = collection(db, USERS, uid, 'practiceHistory')
  const q = query(col, orderBy('createdAt', 'desc'), limit(n))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => d.data() as PracticeRun)
}
