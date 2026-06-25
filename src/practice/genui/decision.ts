/**
 * Pure aggregation from widget outputs → the EXISTING deterministic Decision shapes
 * plus a process-signal bag. NO React/DOM/Phaser/firebase. The deterministic
 * resolvers/rubrics are unchanged: this only maps inputs into their existing shapes.
 */
import type {
  ChartsDecision,
  Decision,
  MarketMakingDecision,
  OptionsDecision,
  Track,
} from '../types'
import { WIDGET_REGISTRY } from './registry'
import type { Direction, ProcessSignals, ProcessSignalValue, ScenarioLayout, WidgetOutput, WidgetOutputs } from './types'

export interface AggregateResult {
  decision: Decision
  signals: ProcessSignals
}

function assertNever(x: never): never {
  throw new Error(`Unhandled track: ${String(x)}`)
}

/** The directional choice in a layout, if a (answered) direction-choice exists. */
function directionFrom(layout: ScenarioLayout, outputs: WidgetOutputs): Direction | undefined {
  for (const w of layout) {
    if (w.kind !== 'direction-choice') continue
    const out = outputs[w.id]
    if (out && out.kind === 'direction-choice') return out.direction
  }
  return undefined
}

/** Reduce a process-only widget output to its signal value. */
function signalValue(out: WidgetOutput): ProcessSignalValue | undefined {
  switch (out.kind) {
    case 'confidence':
      return out.confidence
    case 'risk-slider':
      return out.riskPct
    case 'multiple-choice':
      return out.selected
    case 'checklist':
      return out.checked
    case 'annotate-chart':
      return out.annotations
    default:
      return undefined
  }
}

function collectSignals(layout: ScenarioLayout, outputs: WidgetOutputs): ProcessSignals {
  const signals: ProcessSignals = {}
  for (const w of layout) {
    if (WIDGET_REGISTRY[w.kind].feeds !== 'signal') continue
    const out = outputs[w.id]
    if (!out) continue
    const value = signalValue(out)
    if (value !== undefined) signals[w.id] = value
  }
  return signals
}

function chartsDecision(layout: ScenarioLayout, outputs: WidgetOutputs): ChartsDecision {
  let chosen: Direction | undefined
  let entry: number | undefined
  let stop: number | undefined
  let target: number | undefined
  let shares: number | undefined

  for (const w of layout) {
    const out = outputs[w.id]
    if (!out) continue
    switch (out.kind) {
      case 'direction-choice':
        chosen = out.direction
        break
      case 'price-lines':
        entry = out.entry
        stop = out.stop
        target = out.target
        break
      case 'size-slider':
        shares = out.size
        break
      default:
        break
    }
  }

  const took = chosen
    ? chosen !== 'skip'
    : entry != null || stop != null || target != null || shares != null

  const decision: ChartsDecision = { took }
  if (chosen && chosen !== 'skip') decision.direction = chosen
  if (took) {
    if (entry != null) decision.entry = entry
    if (stop != null) decision.stop = stop
    if (target != null) decision.target = target
    if (shares != null) decision.shares = shares
  }
  return decision
}

function optionsDecision(layout: ScenarioLayout, outputs: WidgetOutputs): OptionsDecision {
  let legs: OptionsDecision['legs'] = []
  let managed: OptionsDecision['managed']
  for (const w of layout) {
    const out = outputs[w.id]
    if (out && out.kind === 'option-leg-builder') {
      legs = out.legs
      managed = out.managed
    }
  }
  const decision: OptionsDecision = { legs }
  if (managed) decision.managed = managed
  return decision
}

function marketMakingDecision(layout: ScenarioLayout, outputs: WidgetOutputs): MarketMakingDecision {
  for (const w of layout) {
    const out = outputs[w.id]
    if (out && out.kind === 'quote-ladder') {
      return {
        bidWidth: out.bidWidth,
        askWidth: out.askWidth,
        quoteSize: out.quoteSize,
        maxInventory: out.maxInventory,
      }
    }
  }
  return { bidWidth: 0, askWidth: 0, quoteSize: 0, maxInventory: 0 }
}

/**
 * Aggregate widget outputs into the track's structured Decision (the math inputs the
 * deterministic resolver needs) plus a bag of process signals (extra widget answers).
 */
export function aggregateDecision(
  track: Track,
  layout: ScenarioLayout,
  outputs: WidgetOutputs,
): AggregateResult {
  const signals = collectSignals(layout, outputs)
  switch (track) {
    case 'charts':
      return { decision: chartsDecision(layout, outputs), signals }
    case 'options':
      return { decision: optionsDecision(layout, outputs), signals }
    case 'market-making':
      return { decision: marketMakingDecision(layout, outputs), signals }
    default:
      return assertNever(track)
  }
}

/**
 * A layout is complete when every REQUIRED widget present has an adequate answer.
 * A `skip` direction short-circuits the trade-entry widgets (lines/size): only the
 * direction itself must be answered.
 */
export function isLayoutComplete(layout: ScenarioLayout, outputs: WidgetOutputs): boolean {
  const dir = directionFrom(layout, outputs)
  for (const w of layout) {
    const meta = WIDGET_REGISTRY[w.kind]
    if (!meta.required) continue
    if (dir === 'skip' && w.kind !== 'direction-choice') continue

    const out = outputs[w.id]
    if (!out) return false

    if (w.kind === 'price-lines' && out.kind === 'price-lines') {
      for (const line of w.config.require) {
        if (out[line] == null) return false
      }
    }
    if (out.kind === 'option-leg-builder' && out.legs.length === 0) return false
  }
  return true
}
