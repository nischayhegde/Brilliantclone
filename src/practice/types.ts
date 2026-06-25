import type { ScenarioLayout } from './genui/types'

/** The three Practice tracks. */
export type Track = 'charts' | 'market-making' | 'options'

// --- Learner decisions (one shape per track; discriminate on the spec's track) ---

export interface ChartsDecision {
  took: boolean
  direction?: 'long' | 'short'
  shares?: number
  entry?: number
  stop?: number
  target?: number
  /** Index at which the learner chose to exit early (else held to reveal end). */
  managedExitIndex?: number
}

export interface OptionLegDecision {
  type: 'call' | 'put'
  side: 'long' | 'short'
  K: number
  /** ISO expiry date, must exist in the referenced chain snapshot. */
  expiry: string
  /** Real premium per share from the chain snapshot (never learner/LLM invented). */
  premium: number
  contracts: number
  /** Snapshot delta of this contract at entry (from the chain; grading only). */
  deltaAtEntry?: number
  /** Days-to-expiry at entry (from the snapshot date; grading only). */
  dteAtEntry?: number
}

export interface OptionsDecision {
  legs: OptionLegDecision[]
  /** How the learner managed before expiry. */
  managed?: 'hold' | 'closed-early' | 'rolled'
}

export interface MarketMakingDecision {
  /** Half-spread below mid for the bid, in price units. */
  bidWidth: number
  /** Half-spread above mid for the ask, in price units. */
  askWidth: number
  quoteSize: number
  /** Absolute inventory cap the learner commits to hold. */
  maxInventory: number
}

export type Decision = ChartsDecision | OptionsDecision | MarketMakingDecision

// --- Risk + objective the rubric/nudges read ---

export interface RiskConstraints {
  /** Account balance at scenario start — basis for % sizing checks. */
  accountBalance: number
  /** Soft risk-per-trade ceiling, e.g. 2 (% of account). */
  maxRiskPct: number
  /** Charts: a stop is expected. */
  requireStop?: boolean
  /** Options: no naked short legs (loss must be defined). */
  requireDefinedRisk?: boolean
  /** Charts: minimum reward:risk to score the R:R dimension full marks. */
  minRewardRisk?: number
}

export interface ScenarioObjective {
  /** v1: the score of record is the process score; P&L is shown, never gates. */
  kind: 'process'
  /** Process score (0..100) considered a pass for telemetry/progression. */
  passScore: number
}

/** A decision-point nudge by id; triggers live in src/practice/nudges.ts. */
export interface NudgeRule {
  id: string
}

/** The ONLY link to market truth: references real data by key, never literals. */
export interface DataRef {
  /** Key into bundled CANDLES (src/data/candles.ts) — Track A/C underlying. */
  candlesKey?: string
  /** Asset path under public/data/ohlc, e.g. "data/ohlc/AAPL__1d.json" (corpus). */
  ohlcAsset?: string
  /** Key into curated option-chain snapshots (Track C). */
  chainSnapshotKey?: string
  /** Asset path under public/data/options, e.g. "data/options/AAPL__2021-02-17.json". */
  chainAsset?: string
  /** Key into real spread/vol stats (Track B). */
  bookStatsKey?: string
  /** Decision point index (Track A). */
  splitIndex?: number
  /** Resolution window end index (Track A). */
  revealToIndex?: number
  /** Snapshot/decision date (Track C). */
  decisionDate?: string
}

export interface ScenarioSpec {
  id: string
  track: Track
  /** 1..N difficulty tier — scales complexity, never P&L odds. */
  tier: number
  title: string
  brief: string
  dataRef: DataRef
  objective: ScenarioObjective
  constraints: RiskConstraints
  /** Which rubric grades this (must exist in RUBRICS). */
  rubricId: string
  nudges: NudgeRule[]
  /** Real facts the debrief LLM may cite (M3). */
  coachContextKeys: string[]
  /** Fields rendered "illustrative; math exact". */
  illustrativeFlags?: string[]
  source: 'curated' | 'llm'
  /**
   * Optional LLM-authored (or curated) interactive layout. When absent, the player
   * falls back to `defaultLayoutFor(track)`. Validated via `validateLayout` when present.
   */
  layout?: ScenarioLayout
}

// --- Grading ---

export interface DimensionScore {
  id: string
  label: string
  /** Relative weight within the rubric (weights need not sum to 1; normalised). */
  weight: number
  /** 0..1 quality on this dimension. */
  score: number
  note: string
}

export interface ProcessScore {
  /** 0..100 weighted process score — the score of record. */
  total: number
  dimensions: DimensionScore[]
  /** Realized dollars from real data; display + history only, never gates. */
  pnl: number
  title: string
  detail: string
}

/** What the deterministic resolver produced from real subsequent data. */
export interface ScenarioOutcome {
  pnl: number
  /** Free-form real facts for the rubric/coach, e.g. { exit: 412.3, hit: 'tp' }. */
  facts: Record<string, number | string | boolean>
}

/** A rubric grades a (spec, decision, outcome) → ProcessScore. Pure, no LLM. */
export type Rubric = (
  spec: ScenarioSpec,
  decision: Decision,
  outcome: ScenarioOutcome,
) => ProcessScore

/** One completed scenario run, persisted to practiceHistory. */
export interface PracticeRun {
  specId: string
  track: Track
  tier: number
  decision: Decision
  nudgesFired: string[]
  score: number
  breakdown: DimensionScore[]
  pnl: number
  journal: { rationale: string; feeling: Feeling }
  createdAt: number
}

export type Feeling = 'confident' | 'anxious' | 'fomo' | 'revenge' | 'calm'
