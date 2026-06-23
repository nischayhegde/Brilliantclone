import type { LessonPackage, LessonSpec, ModuleSpec, SceneCtor } from '../engine/types'
import readingCharts from './reading-charts'
import orderBook from './order-book'
import shortSelling from './short-selling'
import options from './options'
import volatility from './volatility'

/** All lesson packages, ordered by their display index. */
export const PACKAGES: LessonPackage[] = [
  readingCharts,
  orderBook,
  shortSelling,
  options,
  volatility,
].sort((a, b) => a.lesson.index - b.lesson.index)

export const LESSONS: LessonSpec[] = PACKAGES.map((p) => p.lesson)

export function getPackage(lessonId: string): LessonPackage | undefined {
  return PACKAGES.find((p) => p.lesson.id === lessonId)
}

export function getLesson(lessonId: string): LessonSpec | undefined {
  return getPackage(lessonId)?.lesson
}

export function getModule(lessonId: string, moduleId: number): ModuleSpec | undefined {
  return getLesson(lessonId)?.modules.find((m) => m.id === moduleId)
}

export function lessonTotal(lessonId: string): number {
  return getLesson(lessonId)?.modules.length ?? 0
}

/** Resolve a module's scene class from its lesson's scene map. */
export function resolveScene(lessonId: string, kind: string): SceneCtor | undefined {
  return getPackage(lessonId)?.scenes[kind]
}

export const FIRST_LESSON_ID = PACKAGES[0]?.lesson.id ?? 'reading-charts'
