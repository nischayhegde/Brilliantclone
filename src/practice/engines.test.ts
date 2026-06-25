import { describe, it, expect } from 'vitest'
import { getEngine, ENGINES } from './engines'

describe('track engines', () => {
  it('exposes an engine per track with a sceneKind + resolve', () => {
    for (const track of ['charts', 'options', 'market-making'] as const) {
      const e = getEngine(track)
      expect(typeof e.sceneKind).toBe('string')
      expect(typeof e.resolve).toBe('function')
      expect(typeof e.loadData).toBe('function')
    }
  })
  it('charts engine targets chart-trade; options engine targets options-build', () => {
    expect(ENGINES.charts.sceneKind).toBe('chart-trade')
    expect(ENGINES.options.sceneKind).toBe('options-build')
  })
})
