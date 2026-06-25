import type { ScenarioSpec, Track } from './types'
import { CANDLES } from '../data/candles'

/** A real bundled key to anchor the M0 seed scenario (any existing quiz window works). */
const SEED_KEY = Object.keys(CANDLES)[0]

/**
 * Curated catalog. M0 seeds one charts scenario so the pipeline is exercised end to
 * end; M1 (charts), M2 (options), M5 (market-making) extend this array. Every entry
 * MUST pass validateSpec — enforced by scenarioRegistry.test.ts.
 */
export const SCENARIOS: ScenarioSpec[] = [
  {
    id: 'charts-tier1-seed',
    track: 'charts',
    tier: 1,
    title: 'Take it or skip it?',
    brief:
      'Real price action up to a decision point. If the setup is sound, set your size, stop, and target; otherwise stay out.',
    dataRef: {
      candlesKey: SEED_KEY,
      splitIndex: Math.max(1, Math.floor((CANDLES[SEED_KEY]?.length ?? 60) * 0.6)),
      revealToIndex: CANDLES[SEED_KEY]?.length ?? 60,
    },
    objective: { kind: 'process', passScore: 70 },
    constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 1.5 },
    rubricId: 'noop',
    nudges: [{ id: 'sizing' }, { id: 'no-stop' }],
    coachContextKeys: ['outcome', 'exit'],
    source: 'curated',
  },
]

export const allTracks: Track[] = ['charts', 'options', 'market-making']

export function getScenario(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export function scenariosFor(track: Track, tier?: number): ScenarioSpec[] {
  return SCENARIOS.filter((s) => s.track === track && (tier === undefined || s.tier === tier))
}
