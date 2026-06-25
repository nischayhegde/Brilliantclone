// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Candle } from '../../../data/candles'
import type { Widget } from '../types'
import { ChartDataProvider } from './context'
import CandleChart from './CandleChart'
import AnnotateChart from './AnnotateChart'

afterEach(cleanup)

const candles: Candle[] = Array.from({ length: 12 }, (_, i) => {
  const base = 50 + i
  return { t: i + 1, o: base, h: base + 1.5, l: base - 1.5, c: base + (i % 2 ? -0.5 : 0.5) }
})

describe('CandleChart', () => {
  it('renders an accessible candlestick chart from the provided slice', () => {
    const w: Widget = { id: 'chart', kind: 'candle-chart', config: {} }
    render(
      <ChartDataProvider candles={candles}>
        <CandleChart widget={w} onChange={() => {}} />
      </ChartDataProvider>,
    )
    expect(screen.getByRole('img', { name: /candlestick/i })).toBeTruthy()
  })

  it('shows a placeholder when there is no data', () => {
    const w: Widget = { id: 'chart', kind: 'candle-chart', config: {} }
    render(<CandleChart widget={w} onChange={() => {}} />)
    expect(screen.getByText(/no chart data|unavailable/i)).toBeTruthy()
  })
})

describe('AnnotateChart', () => {
  it('adds a level annotation at the cursor and reports it', () => {
    const w: Widget = { id: 'a', kind: 'annotate-chart', config: { tools: ['level'] } }
    const onChange = vi.fn()
    render(
      <ChartDataProvider candles={candles}>
        <AnnotateChart widget={w} onChange={onChange} />
      </ChartDataProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /add level/i }))
    const out = onChange.mock.calls.at(-1)![0]
    expect(out.kind).toBe('annotate-chart')
    expect(out.annotations).toHaveLength(1)
    expect(out.annotations[0].tool).toBe('level')
    expect(typeof out.annotations[0].price).toBe('number')
  })

  it('removes an annotation', () => {
    const w: Widget = { id: 'a', kind: 'annotate-chart', config: { tools: ['level'] } }
    const onChange = vi.fn()
    render(
      <ChartDataProvider candles={candles}>
        <AnnotateChart widget={w} onChange={onChange} />
      </ChartDataProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /add level/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    const out = onChange.mock.calls.at(-1)![0]
    expect(out.annotations).toHaveLength(0)
  })
})
