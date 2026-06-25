import type { Decision, ProcessScore, ScenarioOutcome, ScenarioSpec, Track } from '../types'

/** Minimal model abstraction — one text-in/text-out call. Injectable + mockable. */
export interface ModelClient {
  generate(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string>
}

/** The ONLY real-data identifiers the composer is allowed to reference. */
export interface DataCatalog {
  track: Track
  candlesKeys: string[]
  ohlcAssets: string[]
  chainAssets: string[]
  rubricIds: string[]
  nudgeIds: string[]
}

export interface ComposeRequest {
  track: Track
  tier: number
  accountBalance: number
  catalog: DataCatalog
}

export interface CoachRequest {
  spec: ScenarioSpec
  decision: Decision
  outcome: ScenarioOutcome
  score: ProcessScore
  nudgesFired: string[]
  journal?: { rationale: string; feeling: string }
  /** Whitelisted real facts the coach may cite (numbers it is allowed to mention). */
  allowedFacts: Record<string, number | string | boolean>
}
