// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import WidgetHost, { type WidgetProps } from './WidgetHost'
import type { WidgetKind } from './types'
import type { ScenarioLayout } from './types'
import type { ComponentType } from 'react'

afterEach(cleanup)

// Minimal fake widgets: each renders a button that reports a fixed typed output.
function fake(output: WidgetProps['value']): ComponentType<WidgetProps> {
  return ({ widget, onChange }: WidgetProps) => (
    <button type="button" data-testid={widget.id} onClick={() => onChange(output)}>
      {widget.id}
    </button>
  )
}

function blank(): ComponentType<WidgetProps> {
  return ({ widget }: WidgetProps) => <div data-testid={widget.id}>{widget.kind}</div>
}

function componentsFor(layout: ScenarioLayout): Record<WidgetKind, ComponentType<WidgetProps>> {
  // Provide a renderer for every kind; the smoke test only uses a few.
  const all = {} as Record<WidgetKind, ComponentType<WidgetProps>>
  const kinds: WidgetKind[] = [
    'narrative', 'news-headline', 'candle-chart', 'annotate-chart', 'direction-choice',
    'price-lines', 'size-slider', 'risk-slider', 'confidence', 'multiple-choice',
    'option-leg-builder', 'payoff-graph', 'quote-ladder', 'checklist',
  ]
  for (const k of kinds) all[k] = blank()
  for (const w of layout) {
    if (w.kind === 'direction-choice') all[k_(w.kind)] = fake({ kind: 'direction-choice', direction: 'long' })
    if (w.kind === 'price-lines') all[k_(w.kind)] = fake({ kind: 'price-lines', entry: 100, stop: 95, target: 115 })
    if (w.kind === 'size-slider') all[k_(w.kind)] = fake({ kind: 'size-slider', size: 20 })
    if (w.kind === 'confidence') all[k_(w.kind)] = fake({ kind: 'confidence', confidence: 80 })
  }
  return all
}
const k_ = (k: WidgetKind): WidgetKind => k

describe('WidgetHost', () => {
  const layout: ScenarioLayout = [
    { id: 'chart', kind: 'candle-chart', config: {} },
    { id: 'dir', kind: 'direction-choice', config: { allowed: ['long', 'short', 'skip'] } },
    { id: 'lines', kind: 'price-lines', config: { require: ['entry', 'stop', 'target'] } },
    { id: 'size', kind: 'size-slider', config: { min: 1, max: 1000 } },
    { id: 'conf', kind: 'confidence', config: {} },
  ]

  it('renders one component per widget from the injected map', () => {
    render(<WidgetHost track="charts" layout={layout} components={componentsFor(layout)} onSubmit={() => {}} />)
    expect(screen.getByTestId('chart')).toBeTruthy()
    expect(screen.getByTestId('dir')).toBeTruthy()
    expect(screen.getByTestId('lines')).toBeTruthy()
  })

  it('keeps submit disabled until the layout is complete, then submits the aggregated decision', () => {
    const onSubmit = vi.fn()
    render(<WidgetHost track="charts" layout={layout} components={componentsFor(layout)} onSubmit={onSubmit} />)

    const submit = screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.click(screen.getByTestId('dir'))
    fireEvent.click(screen.getByTestId('lines'))
    fireEvent.click(screen.getByTestId('size'))
    fireEvent.click(screen.getByTestId('conf'))

    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [decision, signals] = onSubmit.mock.calls[0]
    expect(decision).toEqual({ took: true, direction: 'long', entry: 100, stop: 95, target: 115, shares: 20 })
    expect(signals).toEqual({ conf: 80 })
  })
})
