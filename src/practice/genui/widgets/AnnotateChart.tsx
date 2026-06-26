import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { WidgetProps } from '../WidgetHost'
import type { Annotation, AnnotationTool } from '../types'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { makeChartScale } from './chartScale'
import { ChartFrame, provenanceText, svgPoint, tickerFromKey } from './ChartBase'
import { timeframeFromAsset, timeframeLabel } from '../../chartContext'
import { useResolvedCandles } from './context'
import { WidgetCard, WidgetPrompt, WidgetHint } from './ui'

const round2 = (n: number) => Math.round(n * 100) / 100
const TOOL_LABEL: Record<AnnotationTool, string> = { level: 'level', zone: 'zone', trendline: 'trendline' }
const ACCENT = 'var(--color-brand-amber)'

/** Mark a level / zone / trendline on the chart (keyboard + pointer). Process signal. */
export default function AnnotateChart({ widget, onChange }: WidgetProps) {
  if (widget.kind !== 'annotate-chart') return null
  const tools: AnnotationTool[] = widget.config.tools?.length ? widget.config.tools : ['level']
  const maxAnnotations = widget.config.maxAnnotations ?? 6
  const reduced = useReducedMotion()
  const { candles, status, ref } = useResolvedCandles()
  const scale = useMemo(() => makeChartScale(candles), [candles])
  const lastIdx = Math.max(0, candles.length - 1)
  const lastClose = candles.length ? candles[lastIdx].c : (scale.pmin + scale.pmax) / 2

  const [tool, setTool] = useState<AnnotationTool>(tools[0])
  const [cursor, setCursor] = useState<{ price: number; index: number }>({ price: round2(lastClose), index: lastIdx })
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [pending, setPending] = useState<{ price: number; index: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const tick = Math.max(0.01, round2((scale.pmax - scale.pmin) * 0.005))

  const commit = (next: Annotation[]) => {
    setAnnotations(next)
    onChange({ kind: 'annotate-chart', annotations: next })
  }

  const add = () => {
    if (annotations.length >= maxAnnotations) return
    if (tool === 'level') {
      commit([...annotations, { tool: 'level', price: cursor.price, index: cursor.index }])
      return
    }
    if (!pending) {
      setPending({ ...cursor })
      return
    }
    commit([
      ...annotations,
      { tool, price: pending.price, index: pending.index, price2: cursor.price, index2: cursor.index },
    ])
    setPending(null)
  }

  const remove = (i: number) => commit(annotations.filter((_, k) => k !== i))

  const moveCursor = (dPrice: number, dIndex: number) =>
    setCursor((c) => ({
      price: round2(Math.max(scale.pmin, Math.min(scale.pmax, c.price + dPrice))),
      index: Math.max(0, Math.min(lastIdx, c.index + dIndex)),
    }))

  const onKey = (e: ReactKeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); moveCursor(tick, 0); break
      case 'ArrowDown':
        e.preventDefault(); moveCursor(-tick, 0); break
      case 'ArrowLeft':
        e.preventDefault(); moveCursor(0, -1); break
      case 'ArrowRight':
        e.preventDefault(); moveCursor(0, 1); break
      case 'Enter':
      case ' ':
        e.preventDefault(); add(); break
      default:
        break
    }
  }

  const onSvgDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = svgPoint(svgRef.current, e.clientX, e.clientY)
    if (p) setCursor({ price: round2(scale.priceFor(p.y)), index: scale.indexFor(p.x) })
  }

  if (candles.length === 0) {
    return (
      <WidgetCard label="Annotate">
        <div className="grid h-40 place-items-center rounded-xl bg-surface text-sm text-muted">
          {status === 'loading' ? 'Loading chart…' : 'Chart data unavailable'}
        </div>
      </WidgetCard>
    )
  }

  const ticker = tickerFromKey(ref?.candlesKey ?? ref?.ohlcAsset)
  const tf = timeframeLabel(timeframeFromAsset(ref?.ohlcAsset))
  const cy = scale.yFor(cursor.price)
  const cx = scale.xFor(cursor.index)

  return (
    <WidgetCard label="Annotate the chart">
      <WidgetPrompt>{widget.config.prompt ?? 'Mark what you see on the chart'}</WidgetPrompt>
      <ChartFrame
        scale={scale}
        candles={candles}
        ariaLabel="Candlestick chart with annotation cursor"
        provenance={provenanceText(candles, ticker, tf)}
        svgRef={svgRef}
        onPointerDown={onSvgDown}
      >
        {/* committed annotations */}
        {annotations.map((a, i) => {
          if (a.tool === 'level') {
            const y = scale.yFor(a.price ?? 0)
            return <line key={i} x1={scale.plot.l} x2={scale.plot.r} y1={y} y2={y} stroke={ACCENT} strokeWidth={1.6} strokeDasharray="5 4" />
          }
          if (a.tool === 'zone') {
            const yA = scale.yFor(a.price ?? 0)
            const yB = scale.yFor(a.price2 ?? 0)
            return <rect key={i} x={scale.plot.l} y={Math.min(yA, yB)} width={scale.plot.w} height={Math.abs(yB - yA)} fill={ACCENT} fillOpacity={0.12} stroke={ACCENT} strokeOpacity={0.5} />
          }
          return (
            <line key={i} x1={scale.xFor(a.index ?? 0)} y1={scale.yFor(a.price ?? 0)} x2={scale.xFor(a.index2 ?? 0)} y2={scale.yFor(a.price2 ?? 0)} stroke={ACCENT} strokeWidth={2} />
          )
        })}
        {/* live cursor crosshair */}
        <g aria-hidden style={{ transition: reduced ? undefined : 'opacity 80ms linear' }}>
          <line x1={scale.plot.l} x2={scale.plot.r} y1={cy} y2={cy} stroke="var(--color-ink)" strokeOpacity={0.5} strokeDasharray="2 3" />
          <line x1={cx} x2={cx} y1={scale.plot.t} y2={scale.plot.b} stroke="var(--color-ink)" strokeOpacity={0.3} strokeDasharray="2 3" />
          <circle cx={cx} cy={cy} r={4} fill="var(--color-ink)" stroke="var(--color-paper)" strokeWidth={1.5} />
        </g>
      </ChartFrame>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          role="slider"
          tabIndex={0}
          aria-label="Annotation price"
          aria-valuemin={round2(scale.pmin)}
          aria-valuemax={round2(scale.pmax)}
          aria-valuenow={cursor.price}
          aria-valuetext={`Price ${scale.fmtPrice(cursor.price)}`}
          onKeyDown={onKey}
          className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold tabular-nums text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35"
        >
          Cursor {scale.fmtPrice(cursor.price)}
        </span>
        {tools.length > 1 &&
          tools.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tool === t}
              onClick={() => setTool(t)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 ${
                tool === t ? 'border-ink bg-ink text-white' : 'border-hairline bg-paper text-ink-soft'
              }`}
            >
              {TOOL_LABEL[t]}
            </button>
          ))}
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-brand-amber bg-brand-amber-soft px-3 py-1.5 text-xs font-semibold text-brand-amber-ink transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35"
        >
          {pending ? `Set second point (${TOOL_LABEL[tool]})` : `Add ${TOOL_LABEL[tool]}`}
        </button>
      </div>
      <WidgetHint>Click the chart or focus the cursor and use arrow keys; press Enter to drop a mark.</WidgetHint>

      {annotations.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {annotations.map((a, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5 text-xs text-ink">
              <span className="capitalize">
                {a.tool} @ {scale.fmtPrice(a.price ?? 0)}
                {a.price2 != null ? ` → ${scale.fmtPrice(a.price2)}` : ''}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${a.tool} annotation`}
                className="rounded px-2 py-0.5 font-semibold text-brand-red hover:bg-brand-red-soft"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
