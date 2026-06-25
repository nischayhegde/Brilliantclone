import { describe, it, expect } from 'vitest'
import { aggregateDecision, isLayoutComplete } from './decision'
import type { ScenarioLayout, WidgetOutputs } from './types'
import type { ChartsDecision, MarketMakingDecision, OptionsDecision } from '../types'

const chartsLayout: ScenarioLayout = [
  { id: 'chart', kind: 'candle-chart', config: {} },
  { id: 'dir', kind: 'direction-choice', config: { allowed: ['long', 'short', 'skip'] } },
  { id: 'lines', kind: 'price-lines', config: { require: ['entry', 'stop', 'target'] } },
  { id: 'size', kind: 'size-slider', config: { min: 1, max: 1000 } },
  { id: 'conf', kind: 'confidence', config: {} },
]

describe('aggregateDecision — charts', () => {
  it('maps direction/lines/size widget outputs into a ChartsDecision and collects signals', () => {
    const outputs: WidgetOutputs = {
      dir: { kind: 'direction-choice', direction: 'long' },
      lines: { kind: 'price-lines', entry: 100, stop: 95, target: 115 },
      size: { kind: 'size-slider', size: 50 },
      conf: { kind: 'confidence', confidence: 70 },
    }
    const { decision, signals } = aggregateDecision('charts', chartsLayout, outputs)
    expect(decision as ChartsDecision).toEqual({
      took: true,
      direction: 'long',
      entry: 100,
      stop: 95,
      target: 115,
      shares: 50,
    })
    expect(signals).toEqual({ conf: 70 })
  })

  it('treats a skip choice as took=false and omits trade params', () => {
    const outputs: WidgetOutputs = { dir: { kind: 'direction-choice', direction: 'skip' } }
    const { decision } = aggregateDecision('charts', chartsLayout, outputs)
    expect((decision as ChartsDecision).took).toBe(false)
    expect((decision as ChartsDecision).direction).toBeUndefined()
    expect((decision as ChartsDecision).entry).toBeUndefined()
  })
})

describe('aggregateDecision — options', () => {
  it('maps option-leg-builder output to an OptionsDecision', () => {
    const layout: ScenarioLayout = [
      { id: 'legs', kind: 'option-leg-builder', config: { maxLegs: 4 } },
      { id: 'payoff', kind: 'payoff-graph', config: {} },
    ]
    const leg = { type: 'call' as const, side: 'long' as const, K: 150, expiry: '2021-05-21', premium: 3.2, contracts: 2 }
    const outputs: WidgetOutputs = {
      legs: { kind: 'option-leg-builder', legs: [leg], managed: 'hold' },
    }
    const { decision } = aggregateDecision('options', layout, outputs)
    expect(decision as OptionsDecision).toEqual({ legs: [leg], managed: 'hold' })
  })
})

describe('aggregateDecision — market-making', () => {
  it('maps quote-ladder output to a MarketMakingDecision', () => {
    const layout: ScenarioLayout = [{ id: 'q', kind: 'quote-ladder', config: {} }]
    const outputs: WidgetOutputs = {
      q: { kind: 'quote-ladder', bidWidth: 0.2, askWidth: 0.2, quoteSize: 100, maxInventory: 500 },
    }
    const { decision } = aggregateDecision('market-making', layout, outputs)
    expect(decision as MarketMakingDecision).toEqual({
      bidWidth: 0.2,
      askWidth: 0.2,
      quoteSize: 100,
      maxInventory: 500,
    })
  })
})

describe('isLayoutComplete', () => {
  it('is false until required widgets are answered', () => {
    expect(isLayoutComplete(chartsLayout, {})).toBe(false)
    expect(
      isLayoutComplete(chartsLayout, {
        dir: { kind: 'direction-choice', direction: 'long' },
      }),
    ).toBe(false)
  })

  it('requires each required price line to be set when a trade is taken', () => {
    const outputs: WidgetOutputs = {
      dir: { kind: 'direction-choice', direction: 'long' },
      lines: { kind: 'price-lines', entry: 100, stop: 95 }, // missing target
      size: { kind: 'size-slider', size: 10 },
    }
    expect(isLayoutComplete(chartsLayout, outputs)).toBe(false)
  })

  it('is complete when all required widgets are answered', () => {
    const outputs: WidgetOutputs = {
      dir: { kind: 'direction-choice', direction: 'long' },
      lines: { kind: 'price-lines', entry: 100, stop: 95, target: 115 },
      size: { kind: 'size-slider', size: 10 },
    }
    expect(isLayoutComplete(chartsLayout, outputs)).toBe(true)
  })

  it('treats a skip as complete once direction is chosen (no lines/size needed)', () => {
    expect(isLayoutComplete(chartsLayout, { dir: { kind: 'direction-choice', direction: 'skip' } })).toBe(true)
  })

  it('requires at least one option leg for an options layout', () => {
    const layout: ScenarioLayout = [{ id: 'legs', kind: 'option-leg-builder', config: { maxLegs: 4 } }]
    expect(isLayoutComplete(layout, {})).toBe(false)
    expect(isLayoutComplete(layout, { legs: { kind: 'option-leg-builder', legs: [] } })).toBe(false)
    expect(
      isLayoutComplete(layout, {
        legs: {
          kind: 'option-leg-builder',
          legs: [{ type: 'put', side: 'long', K: 100, expiry: '2021-05-21', premium: 1, contracts: 1 }],
        },
      }),
    ).toBe(true)
  })
})
