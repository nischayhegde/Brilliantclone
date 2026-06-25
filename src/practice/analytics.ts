import type { Track } from './types'

export type PracticeEvent =
  | { type: 'scenario_started'; specId: string; track: Track; tier: number; source: 'curated' | 'llm' }
  | { type: 'decision_submitted'; specId: string; track: Track; tier: number }
  | { type: 'nudge_fired'; specId: string; track: Track; nudgeId: string }
  | { type: 'scenario_completed'; specId: string; track: Track; tier: number; score: number; pnl: number; nudgesFired: string[] }
  | { type: 'reset_and_reflect'; ruinEvents: number }

type EventOf<T extends PracticeEvent['type']> = Extract<PracticeEvent, { type: T }>

export const evScenarioStarted = (p: Omit<EventOf<'scenario_started'>, 'type'>): EventOf<'scenario_started'> => ({ type: 'scenario_started', ...p })
export const evDecision = (p: Omit<EventOf<'decision_submitted'>, 'type'>): EventOf<'decision_submitted'> => ({ type: 'decision_submitted', ...p })
export const evNudge = (p: Omit<EventOf<'nudge_fired'>, 'type'>): EventOf<'nudge_fired'> => ({ type: 'nudge_fired', ...p })
export const evCompleted = (p: Omit<EventOf<'scenario_completed'>, 'type'>): EventOf<'scenario_completed'> => ({ type: 'scenario_completed', ...p })
export const evReset = (p: Omit<EventOf<'reset_and_reflect'>, 'type'>): EventOf<'reset_and_reflect'> => ({ type: 'reset_and_reflect', ...p })

export type AnalyticsSink = (e: PracticeEvent & { ts: number }) => void | Promise<void>

export class PracticeAnalytics {
  private sink: AnalyticsSink
  private now: () => number
  constructor(opts: { sink: AnalyticsSink; now?: () => number }) {
    this.sink = opts.sink
    this.now = opts.now ?? Date.now
  }
  async emit(event: PracticeEvent): Promise<void> {
    try {
      await this.sink({ ...event, ts: this.now() })
    } catch {
      // analytics must never break practice
    }
  }
}
