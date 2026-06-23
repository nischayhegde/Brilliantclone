/**
 * Pure streak logic. "Streak = most modules completed in one sitting" (PRD).
 * `currentSitting` lives in React state and starts at 0 on each app load / new
 * session; `bestStreak` is persisted and only ever increases.
 */

export const SESSION_GAP_MS = 30 * 60 * 1000 // 30 minutes

export function nextSitting(currentSitting: number): number {
  return currentSitting + 1
}

export function computeBestStreak(persistedBest: number, currentSitting: number): number {
  return Math.max(persistedBest, currentSitting)
}

/** A new sitting begins when there is no prior activity or the gap exceeds the threshold. */
export function isNewSitting(lastActivityTs: number | null, nowTs: number): boolean {
  if (lastActivityTs === null) return true
  return nowTs - lastActivityTs > SESSION_GAP_MS
}
