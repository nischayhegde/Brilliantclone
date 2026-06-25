import type { SceneCtor } from '../../engine/types'
import ChartTradeScene from './ChartTradeScene'
import OptionsBuildScene from './OptionsBuildScene'

/** kind → scene class for Practice tracks (mirrors a lesson package's scenes map). */
export const PRACTICE_SCENES: Record<string, SceneCtor> = {
  'chart-trade': ChartTradeScene as unknown as SceneCtor,
  'options-build': OptionsBuildScene as unknown as SceneCtor,
}

export function resolvePracticeScene(kind: string): SceneCtor | undefined {
  return PRACTICE_SCENES[kind]
}
