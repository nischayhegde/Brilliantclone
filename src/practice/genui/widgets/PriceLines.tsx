import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { WidgetProps } from '../WidgetHost'
import type { PriceLineId, WidgetOutput } from '../types'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { makeChartScale, type ChartScale } from './chartScale'
import { ChartFrame, provenanceText, svgPoint, tickerFromKey } from './ChartBase'
import { timeframeFromAsset, timeframeLabel } from '../../chartContext'
import { useResolvedCandles } from './context'
import { rewardRisk, fmtRR } from './rewardRisk'
import { WidgetCard, WidgetHint } from './ui'

type Prices = Record<PriceLineId, number>

const LINE_META: Record<PriceLineId, { label: string; color: string }> = {
  entry: { label: 'Entry', color: 'var(--color-ink)' },
  stop: { label: 'Stop', color: 'var(--color-brand-red)' },
  target: { label: 'Target', color: 'var(--color-brand-green)' },
}

const round2 = (n: number) => Math.round(n * 100) / 100

function defaultPrices(scale: ChartScale, lastClose: number): Prices {
  const span = scale.pmax - scale.pmin
  return {
    entry: round2(lastClose),
    stop: round2(lastClose - span * 0.12),
    target: round2(lastClose + span * 0.2),
  }
}

/** Draggable + keyboard entry/stop/target lines over the shared chart. → Decision lines. */
export default function PriceLines({ widget, onChange }: WidgetProps) {
  // Hooks run UNCONDITIONALLY (Rules of Hooks) — only the rendered OUTPUT is gated below.
  const reduced = useReducedMotion()
  const { candles, status, ref } = useResolvedCandles()
  const scale = useMemo(() => makeChartScale(candles), [candles])
  const lastClose = candles.length ? candles[candles.length - 1].c : (scale.pmin + scale.pmax) / 2

  const [prices, setPrices] = useState<Prices>(() => defaultPrices(scale, lastClose))
  const dragging = useRef<PriceLineId | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (widget.kind !== 'price-lines') return null
  const require = widget.config.require
  const minRR = widget.config.minRR

  const tick = Math.max(0.01, round2((scale.pmax - scale.pmin) * 0.005))

  const emit = (next: Prices) => {
    const out: Extract<WidgetOutput, { kind: 'price-lines' }> = { kind: 'price-lines' }
    for (const id of require) out[id] = next[id]
    onChange(out)
  }

  const setLine = (id: PriceLineId, value: number) => {
    const clamped = round2(Math.max(scale.pmin, Math.min(scale.pmax, value)))
    setPrices((prev) => {
      const next = { ...prev, [id]: clamped }
      emit(next)
      return next
    })
  }

  const onKey = (id: PriceLineId) => (e: ReactKeyboardEvent) => {
    let delta = 0
    switch (e.key) {
      case 'ArrowUp':
      case 'Right':
      case 'ArrowRight':
        delta = tick
        break
      case 'ArrowDown':
      case 'Left':
      case 'ArrowLeft':
        delta = -tick
        break
      case 'PageUp':
        delta = tick * 5
        break
      case 'PageDown':
        delta = -tick * 5
        break
      case 'Home':
        e.preventDefault()
        setLine(id, scale.pmax)
        return
      case 'End':
        e.preventDefault()
        setLine(id, scale.pmin)
        return
      default:
        return
    }
    e.preventDefault()
    setLine(id, prices[id] + delta)
  }

  const onSvgMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    const p = svgPoint(svgRef.current, e.clientX, e.clientY)
    if (p) setLine(dragging.current, scale.priceFor(p.y))
  }
  const endDrag = () => {
    dragging.current = null
  }

  if (candles.length === 0) {
    return (
      <WidgetCard label="Price levels">
        <div className="grid h-40 place-items-center rounded-xl bg-surface text-sm text-muted">
          {status === 'loading' ? 'Loading chart…' : 'Chart data unavailable'}
        </div>
      </WidgetCard>
    )
  }

  const rr = rewardRisk(undefined, prices.entry, prices.stop, prices.target)
  const ticker = tickerFromKey(ref?.candlesKey ?? ref?.ohlcAsset)
  const tf = timeframeLabel(timeframeFromAsset(ref?.ohlcAsset))

  return (
    <WidgetCard label="Price levels">
      <ChartFrame
        scale={scale}
        candles={candles}
        ariaLabel="Candlestick chart with draggable price levels"
        provenance={provenanceText(candles, ticker, tf)}
        svgRef={svgRef}
        onPointerMove={onSvgMove}
        onPointerUp={endDrag}
      >
        {require.map((id) => {
          const meta = LINE_META[id]
          const y = scale.yFor(prices[id])
          const knobX = scale.width - 12
          const chipText = `${meta.label} ${scale.fmtPrice(prices[id])}`
          const chipW = chipText.length * 5.4 + 10
          return (
            <g key={id}>
              <line
                x1={scale.plot.l}
                x2={scale.plot.r}
                y1={y}
                y2={y}
                stroke={meta.color}
                strokeWidth={1.6}
                strokeDasharray="5 4"
              />
              <g transform={`translate(${knobX - chipW - 6}, ${y - 8})`}>
                <rect width={chipW} height={16} rx={4} fill="var(--color-paper)" stroke={meta.color} strokeOpacity={0.4} />
                <text x={chipW / 2} y={11} fontSize={9.5} fontWeight={700} textAnchor="middle" fill={meta.color}>
                  {chipText}
                </text>
              </g>
              <circle
                role="slider"
                tabIndex={0}
                aria-label={`${meta.label} price`}
                aria-valuemin={round2(scale.pmin)}
                aria-valuemax={round2(scale.pmax)}
                aria-valuenow={prices[id]}
                aria-valuetext={`${meta.label} ${scale.fmtPrice(prices[id])}`}
                cx={knobX}
                cy={y}
                r={7}
                fill={meta.color}
                stroke="var(--color-paper)"
                strokeWidth={2}
                style={{ cursor: 'ns-resize', outline: 'none', transition: reduced ? undefined : 'cy 80ms linear' }}
                onKeyDown={onKey(id)}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  dragging.current = id
                  ;(e.target as Element).setPointerCapture?.(e.pointerId)
                }}
                onPointerUp={endDrag}
              />
            </g>
          )
        })}
      </ChartFrame>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted">Drag a knob or focus it and use ↑ / ↓ (Home / End for extremes).</span>
        {require.includes('entry') && require.includes('stop') && require.includes('target') && (
          <span className="font-semibold tabular-nums text-ink">
            R:R {fmtRR(rr)}
            {minRR != null && <span className="ml-1 text-muted">(aim ≥ {minRR}R)</span>}
          </span>
        )}
      </div>
      {minRR != null && rr != null && rr < minRR && (
        <WidgetHint>Reward:risk is below the {minRR}R target — widen the target or tighten the stop.</WidgetHint>
      )}
    </WidgetCard>
  )
}
