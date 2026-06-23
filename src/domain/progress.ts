/**
 * Pure lesson-progress logic. No React, no Firebase — fully unit-testable.
 * Module ids are 1..24 (odd = teach, even = quiz).
 */

export const TOTAL_MODULES = 24

export interface Progress {
  /** Highest contiguous resume pointer: 0 = none done, up to TOTAL_MODULES. */
  lastCompletedModule: number
  /** Unique, ascending list of completed module ids (1..24). */
  completedModules: number[]
}

export function initialProgress(): Progress {
  return { lastCompletedModule: 0, completedModules: [] }
}

export type ProgressAction = { type: 'COMPLETE_MODULE'; moduleId: number }

/**
 * Records a module completion.
 * - Out-of-range ids are ignored (returns the same reference).
 * - Re-completing an already-done module is a no-op (returns the same reference)
 *   so callers can skip redundant persistence.
 * - `lastCompletedModule` only ever moves forward (resume/replay never regresses).
 */
export function progressReducer(state: Progress, action: ProgressAction): Progress {
  switch (action.type) {
    case 'COMPLETE_MODULE': {
      const { moduleId } = action
      if (!Number.isInteger(moduleId) || moduleId < 1 || moduleId > TOTAL_MODULES) {
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

/** Next module to play; returns TOTAL_MODULES + 1 (sentinel) once the lesson is done. */
export function nextModuleId(p: Progress): number {
  return p.lastCompletedModule + 1
}

export function isLessonComplete(p: Progress): boolean {
  return p.completedModules.length >= TOTAL_MODULES
}

export function progressCount(p: Progress): number {
  return p.completedModules.length
}
