// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Candle } from '../../../data/candles'
import type { Widget } from '../types'
import { ChartDataProvider } from './context'
import PriceLines from './PriceLines'

afterEach(cleanup)

const candles: Candle[] = Array.from({ length: 20 }, (_, i) => {
  const base = 100 + i
  return { t: i + 1, o: base, h: base + 2, l: base - 2, c: base + 1 }
})

function renderLines(require: ('entry' | 'stop' | 'target')[], onChange = vi.fn()) {
  const w: Widget = { id: 'lines', kind: 'price-lines', config: { require } }
  render(
    <ChartDataProvider candles={candles}>
      <PriceLines widget={w} onChange={onChange} />
    </ChartDataProvider>,
  )
  return onChange
}

describe('PriceLines', () => {
  it('renders a labelled, keyboard-operable slider for each required line', () => {
    renderLines(['entry', 'stop', 'target'])
    expect(screen.getByRole('slider', { name: /entry/i })).toBeTruthy()
    expect(screen.getByRole('slider', { name: /stop/i })).toBeTruthy()
    expect(screen.getByRole('slider', { name: /target/i })).toBeTruthy()
  })

  it('reports all required lines once the learner adjusts one (keyboard)', () => {
    const onChange = renderLines(['entry', 'stop', 'target'])
    const entry = screen.getByRole('slider', { name: /entry/i })
    fireEvent.keyDown(entry, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalled()
    const out = onChange.mock.calls.at(-1)![0]
    expect(out.kind).toBe('price-lines')
    expect(typeof out.entry).toBe('number')
    expect(typeof out.stop).toBe('number')
    expect(typeof out.target).toBe('number')
  })

  it('ArrowUp raises and ArrowDown lowers the entry price', () => {
    const onChange = renderLines(['entry'])
    const entry = screen.getByRole('slider', { name: /entry/i })
    fireEvent.keyDown(entry, { key: 'ArrowUp' })
    const up = onChange.mock.calls.at(-1)![0].entry as number
    fireEvent.keyDown(entry, { key: 'ArrowDown' })
    fireEvent.keyDown(entry, { key: 'ArrowDown' })
    const down = onChange.mock.calls.at(-1)![0].entry as number
    expect(down).toBeLessThan(up)
  })

  it('omits lines that are not required', () => {
    const onChange = renderLines(['entry'])
    fireEvent.keyDown(screen.getByRole('slider', { name: /entry/i }), { key: 'ArrowUp' })
    const out = onChange.mock.calls.at(-1)![0]
    expect(out.stop).toBeUndefined()
    expect(out.target).toBeUndefined()
    expect(screen.queryByRole('slider', { name: /stop/i })).toBeNull()
  })
})
