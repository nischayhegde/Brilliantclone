import { addDoc, collection } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AnalyticsSink, PracticeEvent } from '../practice/analytics'

export const noopSink: AnalyticsSink = () => {}

/** Append practice events under the signed-in user's own document tree. */
export function firestoreSink(uid: string): AnalyticsSink {
  return async (e: PracticeEvent & { ts: number }) => {
    await addDoc(collection(db, 'users', uid, 'practiceEvents'), e)
  }
}
