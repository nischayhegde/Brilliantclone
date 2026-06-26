import type { Track } from '../types'

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
