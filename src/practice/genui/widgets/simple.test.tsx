// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { useState, type ComponentType } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { WidgetProps } from '../WidgetHost'
import type { Widget, WidgetOutput } from '../types'
import Narrative from './Narrative'
import NewsHeadline from './NewsHeadline'
import DirectionChoice from './DirectionChoice'
import SizeSlider from './SizeSlider'
import RiskSlider from './RiskSlider'
import Confidence from './Confidence'
import MultipleChoice from './MultipleChoice'
import Checklist from './Checklist'

afterEach(cleanup)

/** Mirror WidgetHost: hold output state + feed `value` back, while spying on changes. */
function renderControlled(Comp: ComponentType<WidgetProps>, widget: Widget) {
  const spy = vi.fn()
  function Harness() {
    const [value, setValue] = useState<WidgetOutput | undefined>(undefined)
    return (
      <Comp
        widget={widget}
        value={value}
        onChange={(o) => {
          spy(o)
          setValue(o)
        }}
      />
    )
  }
  render(<Harness />)
  return spy
}

describe('Narrative', () => {
  it('renders heading + body copy (display only)', () => {
    const w: Widget = { id: 'n', kind: 'narrative', config: { heading: 'Setup', body: 'The trend is your friend.' } }
    render(<Narrative widget={w} onChange={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeTruthy()
    expect(screen.getByText('The trend is your friend.')).toBeTruthy()
  })
})

describe('NewsHeadline', () => {
  it('renders the headline + source', () => {
    const w: Widget = { id: 'h', kind: 'news-headline', config: { headline: 'Earnings beat', source: 'Newswire' } }
    render(<NewsHeadline widget={w} onChange={() => {}} />)
    expect(screen.getByText('Earnings beat')).toBeTruthy()
    expect(screen.getByText(/Newswire/)).toBeTruthy()
  })
})

describe('DirectionChoice', () => {
  it('reports the chosen direction on click', () => {
    const w: Widget = { id: 'd', kind: 'direction-choice', config: { allowed: ['long', 'short', 'skip'] } }
    const spy = renderControlled(DirectionChoice, w)
    fireEvent.click(screen.getByRole('radio', { name: /long/i }))
    expect(spy).toHaveBeenLastCalledWith({ kind: 'direction-choice', direction: 'long' })
  })

  it('only renders the allowed subset', () => {
    const w: Widget = { id: 'd', kind: 'direction-choice', config: { allowed: ['long', 'skip'] } }
    render(<DirectionChoice widget={w} onChange={() => {}} />)
    expect(screen.queryByRole('radio', { name: /short/i })).toBeNull()
  })
})

describe('SizeSlider', () => {
  it('commits a sensible in-range default on mount and updates on change', () => {
    const w: Widget = { id: 's', kind: 'size-slider', config: { min: 10, max: 100, unit: 'shares' } }
    const spy = renderControlled(SizeSlider, w)
    expect(spy).toHaveBeenCalled()
    const first = spy.mock.calls[0][0]
    expect(first.kind).toBe('size-slider')
    expect(first.size).toBeGreaterThanOrEqual(10)
    expect(first.size).toBeLessThanOrEqual(100)
    const input = screen.getByRole('slider', { name: /position size/i }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '50' } })
    expect(spy).toHaveBeenLastCalledWith({ kind: 'size-slider', size: 50 })
  })
})

describe('RiskSlider', () => {
  it('reports risk percent', () => {
    const w: Widget = { id: 'r', kind: 'risk-slider', config: { minPct: 0.5, maxPct: 3, step: 0.5 } }
    const spy = renderControlled(RiskSlider, w)
    const input = screen.getByRole('slider', { name: /risk/i }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '2' } })
    expect(spy).toHaveBeenLastCalledWith({ kind: 'risk-slider', riskPct: 2 })
  })
})

describe('Confidence', () => {
  it('commits a default and reports confidence on change', () => {
    const w: Widget = { id: 'c', kind: 'confidence', config: {} }
    const spy = renderControlled(Confidence, w)
    expect(spy).toHaveBeenCalled()
    const input = screen.getByRole('slider', { name: /confidence/i }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '70' } })
    expect(spy).toHaveBeenLastCalledWith({ kind: 'confidence', confidence: 70 })
  })
})

describe('MultipleChoice', () => {
  it('single-select reports one id', () => {
    const w: Widget = {
      id: 'mc', kind: 'multiple-choice',
      config: { prompt: 'Why?', options: [{ id: 'a', label: 'Trend' }, { id: 'b', label: 'News' }] },
    }
    const spy = renderControlled(MultipleChoice, w)
    fireEvent.click(screen.getByRole('radio', { name: /trend/i }))
    expect(spy).toHaveBeenLastCalledWith({ kind: 'multiple-choice', selected: ['a'] })
  })

  it('multi-select accumulates ids', () => {
    const w: Widget = {
      id: 'mc', kind: 'multiple-choice',
      config: { prompt: 'Pick all', multiSelect: true, options: [{ id: 'a', label: 'Trend' }, { id: 'b', label: 'News' }] },
    }
    const spy = renderControlled(MultipleChoice, w)
    fireEvent.click(screen.getByRole('checkbox', { name: /trend/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /news/i }))
    expect(spy).toHaveBeenLastCalledWith({ kind: 'multiple-choice', selected: ['a', 'b'] })
  })
})

describe('Checklist', () => {
  it('reports checked item ids', () => {
    const w: Widget = {
      id: 'ck', kind: 'checklist',
      config: { items: [{ id: 'x', label: 'Has a stop' }, { id: 'y', label: 'R:R ≥ 2' }] },
    }
    const spy = renderControlled(Checklist, w)
    fireEvent.click(screen.getByRole('checkbox', { name: /has a stop/i }))
    expect(spy).toHaveBeenLastCalledWith({ kind: 'checklist', checked: ['x'] })
  })
})
