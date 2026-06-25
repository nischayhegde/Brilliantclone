// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Candle } from '../../../data/candles'
import type { ChainSnapshot } from '../../chain'
import type { OptionLegDecision } from '../../types'
import type { Widget } from '../types'
import { ChainDataProvider, ChartDataProvider, LegsProvider } from './context'
import OptionLegBuilder from './OptionLegBuilder'
import PayoffGraph from './PayoffGraph'
import QuoteLadder from './QuoteLadder'

afterEach(cleanup)

const chain: ChainSnapshot = {
  meta: { symbol: 'AAPL', date: '2021-02-17', spot: 130, expirations: ['2021-03-19'] },
  chain: [
    { exp: '2021-03-19', strike: 120, cp: 'C', bid: 12, ask: 12.4, mid: 12.2, iv: 0.4, delta: 0.7, gamma: 0.02, theta: -0.05, vega: 0.1, rho: 0.01 },
    { exp: '2021-03-19', strike: 130, cp: 'C', bid: 5.9, ask: 6.1, mid: 6, iv: 0.38, delta: 0.5, gamma: 0.03, theta: -0.06, vega: 0.12, rho: 0.01 },
    { exp: '2021-03-19', strike: 140, cp: 'C', bid: 2.4, ask: 2.6, mid: 2.5, iv: 0.36, delta: 0.3, gamma: 0.02, theta: -0.05, vega: 0.1, rho: 0.01 },
    { exp: '2021-03-19', strike: 130, cp: 'P', bid: 5.4, ask: 5.6, mid: 5.5, iv: 0.39, delta: -0.5, gamma: 0.03, theta: -0.06, vega: 0.12, rho: -0.01 },
  ],
}

describe('OptionLegBuilder', () => {
  it('adds a leg from the real chain with the snapshot mid as premium', () => {
    const w: Widget = { id: 'builder', kind: 'option-leg-builder', config: { maxLegs: 4 } }
    const onChange = vi.fn()
    render(
      <ChainDataProvider chain={chain}>
        <OptionLegBuilder widget={w} onChange={onChange} />
      </ChainDataProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /add leg/i }))
    const out = onChange.mock.calls.at(-1)![0]
    expect(out.kind).toBe('option-leg-builder')
    expect(out.legs).toHaveLength(1)
    const leg: OptionLegDecision = out.legs[0]
    expect(leg.type).toBe('call')
    expect(leg.K).toBe(130) // default strike nearest spot
    expect(leg.premium).toBe(6) // snapshot mid, never invented
    expect(leg.contracts).toBeGreaterThanOrEqual(1)
  })

  it('blocks completion of a naked short when requireDefinedRisk is set', () => {
    const w: Widget = { id: 'b', kind: 'option-leg-builder', config: { maxLegs: 2, requireDefinedRisk: true } }
    const onChange = vi.fn()
    render(
      <ChainDataProvider chain={chain}>
        <OptionLegBuilder widget={w} onChange={onChange} />
      </ChainDataProvider>,
    )
    fireEvent.click(screen.getByRole('radio', { name: /short/i }))
    fireEvent.click(screen.getByRole('button', { name: /add leg/i }))
    // A naked short must NOT report a completing output (legs gated to undefined).
    const out = onChange.mock.calls.at(-1)![0]
    expect(out).toBeUndefined()
    expect(screen.getByText(/defined risk|undefined risk|naked/i)).toBeTruthy()
  })
})

describe('PayoffGraph', () => {
  const legs: OptionLegDecision[] = [
    { type: 'call', side: 'long', K: 130, expiry: '2021-03-19', premium: 6, contracts: 1 },
  ]

  it('previews the deterministic payoff for the source builder legs', () => {
    const w: Widget = { id: 'pg', kind: 'payoff-graph', config: { source: 'builder' } }
    render(
      <LegsProvider initial={{ builder: legs }}>
        <PayoffGraph widget={w} onChange={() => {}} />
      </LegsProvider>,
    )
    expect(screen.getByRole('img', { name: /payoff/i })).toBeTruthy()
    expect(screen.getByText(/max loss/i)).toBeTruthy()
  })

  it('shows an empty state when there are no legs yet', () => {
    const w: Widget = { id: 'pg', kind: 'payoff-graph', config: { source: 'builder' } }
    render(
      <LegsProvider initial={{}}>
        <PayoffGraph widget={w} onChange={() => {}} />
      </LegsProvider>,
    )
    expect(screen.getByText(/add .*leg/i)).toBeTruthy()
  })
})

describe('QuoteLadder', () => {
  const candles: Candle[] = Array.from({ length: 6 }, (_, i) => ({ t: i + 1, o: 100, h: 101, l: 99, c: 100 }))

  it('commits a default two-sided quote and updates on change', () => {
    const w: Widget = { id: 'q', kind: 'quote-ladder', config: { levels: 3, maxInventoryHint: 500 } }
    const onChange = vi.fn()
    render(
      <ChartDataProvider candles={candles}>
        <QuoteLadder widget={w} onChange={onChange} />
      </ChartDataProvider>,
    )
    expect(onChange).toHaveBeenCalled()
    const first = onChange.mock.calls[0][0]
    expect(first.kind).toBe('quote-ladder')
    expect(typeof first.bidWidth).toBe('number')
    expect(typeof first.askWidth).toBe('number')
    expect(typeof first.quoteSize).toBe('number')
    expect(typeof first.maxInventory).toBe('number')

    const size = screen.getByRole('slider', { name: /quote size/i }) as HTMLInputElement
    fireEvent.change(size, { target: { value: '250' } })
    expect(onChange.mock.calls.at(-1)![0].quoteSize).toBe(250)
  })
})
