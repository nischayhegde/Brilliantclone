/**
 * The ONLY React file in the genui core. It renders a layout by mapping each widget to
 * a component from the INJECTED `components` map (so it is testable with fakes), owns
 * per-widget output state, and calls `onSubmit(decision, signals)` once the layout is
 * complete. It is track-agnostic UI — all track logic lives in the pure aggregator.
 */
import { useMemo, useState, type ComponentType } from 'react'
import type { Decision, Track } from '../types'
import { aggregateDecision, isLayoutComplete } from './decision'
import type { ProcessSignals, ScenarioLayout, Widget, WidgetKind, WidgetOutput, WidgetOutputs } from './types'

/** Props every widget component receives from the host. */
export interface WidgetProps {
  widget: Widget
  /** This widget's current output, if any. */
  value?: WidgetOutput
  /** Report a new typed output (or `undefined` to clear). */
  onChange: (output: WidgetOutput | undefined) => void
}

export type WidgetComponents = Record<WidgetKind, ComponentType<WidgetProps>>

export interface WidgetHostProps {
  /** Track drives how widget outputs aggregate into a Decision. */
  track: Track
  layout: ScenarioLayout
  components: WidgetComponents
  onSubmit: (decision: Decision, signals: ProcessSignals) => void
  /** Optional label for the submit control (default "Submit"). */
  submitLabel?: string
}

export default function WidgetHost({ track, layout, components, onSubmit, submitLabel = 'Submit' }: WidgetHostProps) {
  const [outputs, setOutputs] = useState<WidgetOutputs>({})

  const complete = useMemo(() => isLayoutComplete(layout, outputs), [layout, outputs])

  const setOutput = (id: string, output: WidgetOutput | undefined) =>
    setOutputs((prev) => {
      const next = { ...prev }
      if (output === undefined) delete next[id]
      else next[id] = output
      return next
    })

  const submit = () => {
    if (!complete) return
    const { decision, signals } = aggregateDecision(track, layout, outputs)
    onSubmit(decision, signals)
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {layout.map((widget) => {
        const Component = components[widget.kind]
        if (!Component) return null
        return (
          <Component
            key={widget.id}
            widget={widget}
            value={outputs[widget.id]}
            onChange={(output) => setOutput(widget.id, output)}
          />
        )
      })}
      {/* Styling only (no contract change): the host owns the single submit control, so it
          carries the app's primary-button vocabulary instead of an unstyled element. */}
      <button
        type="button"
        disabled={!complete}
        onClick={submit}
        className="mt-1 inline-flex min-w-44 items-center justify-center rounded-xl bg-ink px-6 py-3 text-base font-semibold text-white shadow-sm transition duration-200 ease-out hover:-translate-y-px hover:bg-black hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
      >
        {submitLabel}
      </button>
    </div>
  )
}
