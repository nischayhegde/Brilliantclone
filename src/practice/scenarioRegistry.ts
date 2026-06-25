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
 * Build a curated options scenario over a REAL chain snapshot. The learner builds a
 * (multi-leg) defined-risk position from the snapshot's real premiums/IV/greeks; time
 * advances over the real underlying and P&L resolves with exact expiry math. `chainAsset`
 * must exist under public/data/options and its date must appear in options-manifest.json.
 * Tier scales structural complexity (single-leg → spreads → tighter management), never odds.
 */
function optionsSpec(id: string, tier: number, chainAsset: string, decisionDate: string, brief: string): ScenarioSpec {
  return {
    id,
    track: 'options',
    tier,
    title: 'Build a defined-risk position',
    brief,
    dataRef: { chainAsset, decisionDate },
    objective: { kind: 'process', passScore: 70 },
    constraints: { accountBalance: 10000, maxRiskPct: 5, requireDefinedRisk: true },
    rubricId: 'options-v1',
    nudges: [{ id: 'undefined-risk' }, { id: 'sizing' }],
    coachContextKeys: ['sExpiry', 'modelEstimate'],
    illustrativeFlags: ['plToday'],
    source: 'curated',
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

// --- Track C (options) curated catalog — ≥8 specs over real chain snapshots ---------
SCENARIOS.push(
  // Tier 1 — single-leg / simple verticals on liquid names.
  optionsSpec('opt-t1-01', 1, 'data/options/DIS__2021-02-17.json', '2021-02-17',
    'You are mildly bullish DIS into spring. Build a defined-risk position that profits if it holds up — size it so the worst case is small.'),
  optionsSpec('opt-t1-02', 1, 'data/options/AAPL__2021-04-16.json', '2021-04-16',
    'You expect AAPL to drift higher but want a capped downside. Structure a position whose maximum loss is defined from the start.'),
  optionsSpec('opt-t1-03', 1, 'data/options/MSFT__2023-02-17.json', '2023-02-17',
    'MSFT looks range-bound to you. Collect some premium with a position whose loss is bounded — keep the risk inside your budget.'),
  // Tier 2 — spreads with strike/expiry tradeoffs.
  optionsSpec('opt-t2-01', 2, 'data/options/JPM__2021-06-16.json', '2021-06-16',
    'You think JPM stays above support. Sell premium with a vertical spread: pick a sane short delta and define the loss with a long wing.'),
  optionsSpec('opt-t2-02', 2, 'data/options/BAC__2020-08-17.json', '2020-08-17',
    'BAC has been choppy. Build a two-leg spread that profits from a modest move while capping the downside — mind the breakevens.'),
  optionsSpec('opt-t2-03', 2, 'data/options/NVDA__2023-08-16.json', '2023-08-16',
    'NVDA carries rich IV. Take a defined-risk view on direction and choose strikes/expiry that respect the premium you pay or collect.'),
  // Tier 3 — higher-vol names, tighter management.
  optionsSpec('opt-t3-01', 3, 'data/options/AMZN__2023-02-17.json', '2023-02-17',
    'AMZN is volatile here. Build a defined-risk spread, then decide how to manage it — holding to expiry is exact; closing early is a model estimate.'),
  optionsSpec('opt-t3-02', 3, 'data/options/TSLA__2022-09-16.json', '2022-09-16',
    'TSLA can swing hard. Size a capped-loss structure conservatively and plan your management before the move happens.'),
  optionsSpec('opt-t3-03', 3, 'data/options/NFLX__2022-11-16.json', '2022-11-16',
    'NFLX premiums are fat. Express a thesis with a spread whose reward-to-risk is sane, and keep the position within your risk budget.'),
)

export const allTracks: Track[] = ['charts', 'options', 'market-making']

export function getScenario(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export function scenariosFor(track: Track, tier?: number): ScenarioSpec[] {
  return SCENARIOS.filter((s) => s.track === track && (tier === undefined || s.tier === tier))
}
