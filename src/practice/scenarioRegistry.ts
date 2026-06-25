import type { ScenarioSpec, Track } from './types'
import { CANDLES } from '../data/candles'

/** Length of a bundled candles series (0 when the key is unknown). */
const K = (k: string): number => CANDLES[k]?.length ?? 0

/**
 * Build a curated charts scenario over a real bundled window. `splitIndex` sits at
 * ~60% so the learner decides on real price action and the hidden remainder resolves
 * the trade; `revealToIndex` runs to the end of the series. Tier scales the required
 * reward:risk (and, in M4, adaptive selection), never the P&L odds.
 */
function chartsSpec(
  id: string,
  tier: number,
  candlesKey: string,
  over: Partial<ScenarioSpec> = {},
): ScenarioSpec {
  const len = K(candlesKey)
  return {
    id,
    track: 'charts',
    tier,
    title: 'Take it or skip it?',
    brief:
      'Real price action up to a decision point. If the setup is sound, set your size, stop, and target; otherwise stay out.',
    dataRef: { candlesKey, splitIndex: Math.max(1, Math.floor(len * 0.6)), revealToIndex: len },
    objective: { kind: 'process', passScore: 70 },
    constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: tier >= 2 ? 2 : 1.5 },
    rubricId: 'charts-v1',
    nudges: [{ id: 'sizing' }, { id: 'no-stop' }],
    coachContextKeys: ['outcome', 'exit', 'netMove'],
    source: 'curated',
    ...over,
  }
}

/**
 * Curated catalog. M1 ships the first fully-playable track (charts) with ≥10 scenarios
 * across tiers 1–3, each referencing a real bundled OHLC window. M2 (options) and M5
 * (market-making) extend this array. Every entry MUST pass validateSpec — enforced by
 * scenarioRegistry.test.ts.
 */
export const SCENARIOS: ScenarioSpec[] = [
  // Tier 1 — clean, single-setup windows.
  chartsSpec('charts-t1-01', 1, 'asctri_quiz_AMD'),
  chartsSpec('charts-t1-02', 1, 'bearflag_quiz_TSLA'),
  chartsSpec('charts-t1-03', 1, 'pltr_2024'),
  chartsSpec('charts-t1-04', 1, 'nvda_2023'),
  // Tier 2 — longer, more ambiguous structures.
  chartsSpec('charts-t2-01', 2, 'cupHandle_quiz_DIS'),
  chartsSpec('charts-t2-02', 2, 'db_quiz_SNAP'),
  chartsSpec('charts-t2-03', 2, 'hs_quiz_META'),
  chartsSpec('charts-t2-04', 2, 'gme_squeeze_2021'),
  // Tier 3 — reversals + volatile regimes.
  chartsSpec('charts-t3-01', 3, 'dt_quiz_NFLX'),
  chartsSpec('charts-t3-02', 3, 'ihs_quiz_NVDA'),
  chartsSpec('charts-t3-03', 3, 'triple_bottom_quiz_DIS'),
  chartsSpec('charts-t3-04', 3, 'vw_squeeze_2008'),
].filter((s) => (s.dataRef.candlesKey ? K(s.dataRef.candlesKey) > 5 : true))

export const allTracks: Track[] = ['charts', 'options', 'market-making']

export function getScenario(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export function scenariosFor(track: Track, tier?: number): ScenarioSpec[] {
  return SCENARIOS.filter((s) => s.track === track && (tier === undefined || s.tier === tier))
}
