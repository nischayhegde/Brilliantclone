import { useEffect, useRef, useState } from 'react'
import type { WidgetProps } from '../WidgetHost'
import { fmtPrice, fmtShares } from '../../../lessons/order-book/scenes/book'
import { quoteFromMid, ladderLevels } from './quoteMath'
import { useCandles } from './context'
import { WidgetCard, WidgetPrompt } from './ui'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Two-sided market-making quote: bid/ask width, size, inventory cap. → MarketMakingDecision. */
export default function QuoteLadder({ widget, value, onChange }: WidgetProps) {
  if (widget.kind !== 'quote-ladder') return null
  const levels = Math.max(1, widget.config.levels ?? 4)
  const invHint = widget.config.maxInventoryHint
  const { candles } = useCandles()
  const mid = candles.length ? candles[candles.length - 1].c : 0

  const widthMax = round2(Math.max(mid * 0.02, 1))
  const tick = Math.max(0.01, round2(mid * 0.002))
  const invMax = Math.max(100, invHint ?? 2000)

  const init = {
    bidWidth: tick,
    askWidth: tick,
    quoteSize: 100,
    maxInventory: invHint ? Math.round(invHint / 2) : 500,
  }
  const v = value?.kind === 'quote-ladder' ? value : undefined
  const [state, setState] = useState(() => ({
    bidWidth: v?.bidWidth ?? init.bidWidth,
    askWidth: v?.askWidth ?? init.askWidth,
    quoteSize: v?.quoteSize ?? init.quoteSize,
    maxInventory: v?.maxInventory ?? init.maxInventory,
  }))
  const committed = useRef(false)

  const emit = (next: typeof state) => onChange({ kind: 'quote-ladder', ...next })
  const set = (patch: Partial<typeof state>) =>
    setState((prev) => {
      const next = { ...prev, ...patch }
      emit(next)
      return next
    })

  useEffect(() => {
    if (!committed.current && !v) {
      committed.current = true
      emit(state)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const quote = quoteFromMid(mid, state.bidWidth, state.askWidth)
  const bids = ladderLevels(mid, state.bidWidth, levels, 'bid')
  const asks = ladderLevels(mid, state.askWidth, levels, 'ask')

  const sliderRow = (
    label: string,
    key: 'bidWidth' | 'askWidth' | 'quoteSize' | 'maxInventory',
    min: number,
    max: number,
    step: number,
    fmt: (n: number) => string,
  ) => (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs font-semibold text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={state[key]}
        aria-label={label}
        onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<typeof state>)}
        className="h-2 w-full cursor-pointer accent-ink"
      />
      <output className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">{fmt(state[key])}</output>
    </div>
  )

  return (
    <WidgetCard label="Quote ladder">
      <WidgetPrompt>Set your two-sided quote{mid > 0 ? ` (mid ${fmtPrice(mid)})` : ''}</WidgetPrompt>

      {/* live two-sided readout */}
      <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-hairline">
        <div className="bg-brand-green-soft p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-green-text">Bid</p>
          <p className="text-lg font-bold tabular-nums text-brand-green-text">{fmtPrice(quote.bid)}</p>
          <ul className="mt-1 text-[11px] tabular-nums text-muted">
            {bids.map((p, i) => (
              <li key={i}>{fmtPrice(p)}</li>
            ))}
          </ul>
        </div>
        <div className="bg-brand-red-soft p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-red">Ask</p>
          <p className="text-lg font-bold tabular-nums text-brand-red">{fmtPrice(quote.ask)}</p>
          <ul className="mt-1 text-[11px] tabular-nums text-muted">
            {asks.map((p, i) => (
              <li key={i}>{fmtPrice(p)}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mb-4 text-center text-xs text-muted">
        Spread {fmtPrice(quote.spread)} ({(quote.spreadPct * 100).toFixed(2)}%) · quoting {fmtShares(state.quoteSize)} ·
        cap ±{fmtShares(state.maxInventory)}
      </p>

      <div className="flex flex-col gap-3">
        {sliderRow('Bid width', 'bidWidth', 0.01, widthMax, 0.01, (n) => fmtPrice(n))}
        {sliderRow('Ask width', 'askWidth', 0.01, widthMax, 0.01, (n) => fmtPrice(n))}
        {sliderRow('Quote size', 'quoteSize', 1, 1000, 1, (n) => fmtShares(n))}
        {sliderRow('Max inventory', 'maxInventory', 0, invMax, Math.max(1, Math.round(invMax / 100)), (n) => fmtShares(n))}
      </div>
    </WidgetCard>
  )
}
