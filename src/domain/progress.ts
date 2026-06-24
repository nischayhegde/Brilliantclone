/**
 * Pure per-lesson progress logic. No React, no Firebase — fully unit-testable.
 * Each lesson tracks its own Progress; module ids are 1..lessonTotal. The lesson's
 * module count (`total`) is supplied by callers (from the lesson registry) so the
 * same logic serves lessons of different lengths (24, 15, ...).
 */

export interface Progress {
  /** Highest contiguous resume pointer: 0 = none done, up to the lesson total. */
  lastCompletedModule: number
  /** Unique, ascending list of completed module ids. */
  completedModules: number[]
}

export function initialProgress(): Progress {
  return { lastCompletedModule: 0, completedModules: [] }
}

type ProgressAction = { type: 'COMPLETE_MODULE'; moduleId: number; total: number }

/**
 * Records a module completion.
 * - Out-of-range ids (< 1 or > total, or non-integers) are ignored (same reference).
 * - Re-completing an already-done module is a no-op (same reference) so callers can
 *   skip redundant persistence.
 * - `lastCompletedModule` only ever moves forward (resume/replay never regresses).
 */
export function progressReducer(state: Progress, action: ProgressAction): Progress {
  switch (action.type) {
    case 'COMPLETE_MODULE': {
      const { moduleId, total } = action
      if (!Number.isInteger(moduleId) || moduleId < 1 || moduleId > total) {
        return state
      }
      if (state.completedModules.includes(moduleId)) {
        return state
      }
      const completedModules = [...state.completedModules, moduleId].sort((a, b) => a - b)
      const lastCompletedModule = Math.max(state.lastCompletedModule, moduleId)
      return { lastCompletedModule, completedModules }
    }
    default:
      return state
  }
}

/** Next module to play; returns total + 1 (sentinel) once the lesson is done. */
export function nextModuleId(p: Progress): number {
  return p.lastCompletedModule + 1
}

export function isLessonComplete(p: Progress, total: number): boolean {
  return p.completedModules.length >= total
}

export function progressCount(p: Progress): number {
  return p.completedModules.length
}
