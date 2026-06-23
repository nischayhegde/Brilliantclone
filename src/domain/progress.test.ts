import { describe, it, expect } from 'vitest'
import {
  TOTAL_MODULES,
  initialProgress,
  progressReducer,
  nextModuleId,
  isLessonComplete,
  progressCount,
  type Progress,
} from './progress'

const complete = (p: Progress, moduleId: number) =>
  progressReducer(p, { type: 'COMPLETE_MODULE', moduleId })

describe('initialProgress', () => {
  it('starts empty with pointer at 0', () => {
    expect(initialProgress()).toEqual({ lastCompletedModule: 0, completedModules: [] })
  })
})

describe('progressReducer COMPLETE_MODULE', () => {
  it('records a completion and advances the pointer', () => {
    const p = complete(initialProgress(), 1)
    expect(p.completedModules).toEqual([1])
    expect(p.lastCompletedModule).toBe(1)
    expect(progressCount(p)).toBe(1)
  })

  it('dedupes a re-completed module and returns the same reference (no redundant write)', () => {
    const once = complete(initialProgress(), 1)
    const twice = complete(once, 1)
    expect(twice).toBe(once) // same ref
    expect(progressCount(twice)).toBe(1)
  })

  it('keeps completedModules unique and sorted regardless of insertion order', () => {
    let p = initialProgress()
    p = complete(p, 3)
    p = complete(p, 1)
    p = complete(p, 2)
    expect(p.completedModules).toEqual([1, 2, 3])
  })

  it('never regresses the resume pointer when an earlier module is completed', () => {
    let p = complete(initialProgress(), 5) // pointer 5
    p = complete(p, 2) // backfill earlier module
    expect(p.completedModules).toEqual([2, 5])
    expect(p.lastCompletedModule).toBe(5)
    expect(nextModuleId(p)).toBe(6)
  })

  it('ignores out-of-range module ids (same reference)', () => {
    const base = initialProgress()
    expect(complete(base, 0)).toBe(base)
    expect(complete(base, 25)).toBe(base)
    expect(complete(base, -1)).toBe(base)
    expect(complete(base, 1.5)).toBe(base)
  })
})

describe('lesson completion', () => {
  it('is complete only after all 24 modules and nextModuleId becomes the sentinel', () => {
    let p = initialProgress()
    for (let id = 1; id <= TOTAL_MODULES; id++) p = complete(p, id)
    expect(isLessonComplete(p)).toBe(true)
    expect(progressCount(p)).toBe(24)
    expect(nextModuleId(p)).toBe(25)
  })

  it('is not complete partway through', () => {
    let p = initialProgress()
    for (let id = 1; id <= 10; id++) p = complete(p, id)
    expect(isLessonComplete(p)).toBe(false)
    expect(nextModuleId(p)).toBe(11)
  })
})
