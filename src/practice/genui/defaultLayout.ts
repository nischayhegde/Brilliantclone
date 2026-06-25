/**
 * Curated single-scene layouts that mirror the CURRENT per-track interaction. Existing
 * curated specs carry no `layout`; this shim lets the WidgetHost render them unchanged
 * (and keeps the legacy test suite green). Pure — no React/DOM/Phaser/firebase.
 *
 * Copy here stays number-free + claim-free so every default layout passes `validateLayout`.
 */
import type { Track } from '../types'
import type { ScenarioLayout } from './types'

function chartsDefault(): ScenarioLayout {
  return [
    { id: 'chart', kind: 'candle-chart', config: { showVolume: false } },
    {
      id: 'direction',
      kind: 'direction-choice',
      config: { prompt: 'Take it or skip it?', allowed: ['long', 'short', 'skip'] },
    },
    { id: 'levels', kind: 'price-lines', config: { require: ['entry', 'stop', 'target'] } },
    { id: 'size', kind: 'size-slider', config: { min: 1, max: 10000, step: 1, unit: 'shares' } },
  ]
}

function optionsDefault(): ScenarioLayout {
  return [
    { id: 'chart', kind: 'candle-chart', config: {} },
    { id: 'legs', kind: 'option-leg-builder', config: { maxLegs: 4, requireDefinedRisk: true } },
    { id: 'payoff', kind: 'payoff-graph', config: { source: 'legs' } },
  ]
}

function marketMakingDefault(): ScenarioLayout {
  return [
    { id: 'chart', kind: 'candle-chart', config: {} },
    { id: 'quotes', kind: 'quote-ladder', config: { levels: 1 } },
  ]
}

/** The curated default layout representing the current interaction for a track. */
export function defaultLayoutFor(track: Track): ScenarioLayout {
  switch (track) {
    case 'charts':
      return chartsDefault()
    case 'options':
      return optionsDefault()
    case 'market-making':
      return marketMakingDefault()
    default: {
      const never: never = track
      throw new Error(`No default layout for track: ${String(never)}`)
    }
  }
}
