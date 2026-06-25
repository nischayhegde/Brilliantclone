/**
 * Shared SVG candle surface. Rendering the base candles + axis in the SAME `<svg>` that
 * an overlay draws into (via `children`) guarantees lines/annotations stay pixel-aligned
 * with the bars — the fixed viewBox makes every coordinate resolution-independent, so
 * there is no DOM measurement and nothing can clip or overlap (the old Phaser bug).
 */
import type { ReactNode, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Candle } from '../../../data/candles'
import type { ChartScale } from './chartScale'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Infer a stock symbol from a candles key, e.g. 'asctri_quiz_AMD' → 'AMD'. */
export function tickerFromKey(key?: string): string | undefined {
  if (!key) return undefined
  const segs = key.split(/[_/.]/)
  for (const s of segs) {
    const m = /^([A-Z]{1,6})\d*$/.exec(s)
    if (m) return m[1]
  }
  const first = segs[0]
  return /^[a-z]{1,6}$/.test(first) ? first.toUpperCase() : undefined
}

/** Human date span of the candle slice (UTC), e.g. "Nov 2021 – Feb 2022". */
export function fmtDateRange(candles: Candle[]): string {
  if (candles.length === 0) return ''
  const d0 = new Date(candles[0].t * 1000)
  const d1 = new Date(candles[candles.length - 1].t * 1000)
  const m0 = MON[d0.getUTCMonth()]
  const m1 = MON[d1.getUTCMonth()]
  const y0 = d0.getUTCFullYear()
  const y1 = d1.getUTCFullYear()
  if (y0 !== y1) return `${m0} ${y0} – ${m1} ${y1}`
  return m0 === m1 ? `${m0} ${y0}` : `${m0}–${m1} ${y0}`
}

export function provenanceText(candles: Candle[], ticker?: string): string {
  const range = fmtDateRange(candles)
  const lead = 'Real market data'
  if (ticker && range) return `${lead} · ${ticker} · ${range}`
  if (range) return `${lead} · ${range}`
  return lead
}

/** Convert a pointer event to viewBox coordinates (null when CTM is unavailable, e.g. jsdom). */
export function svgPoint(svg: SVGSVGElement | null, clientX: number, clientY: number): { x: number; y: number } | null {
  if (!svg || typeof svg.createSVGPoint !== 'function' || typeof svg.getScreenCTM !== 'function') return null
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

function ChartAxis({ scale }: { scale: ChartScale }) {
  const gridlines = [0, 1, 2, 3].map((i) => scale.pmin + ((scale.pmax - scale.pmin) * i) / 3)
  return (
    <g aria-hidden>
      {gridlines.map((p, i) => {
        const y = scale.yFor(p)
        return (
          <g key={i}>
            <line x1={scale.plot.l} x2={scale.plot.r} y1={y} y2={y} stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={scale.plot.r + 6} y={y + 3} fontSize={10} fill="var(--color-muted)">
              {scale.fmtPrice(p)}
            </text>
          </g>
        )
      })}
      <line
        x1={scale.plot.l}
        x2={scale.plot.r}
        y1={scale.plot.b}
        y2={scale.plot.b}
        stroke="var(--color-ink)"
        strokeOpacity={0.25}
        strokeWidth={1}
      />
    </g>
  )
}

function CandleSeries({ scale, candles }: { scale: ChartScale; candles: Candle[] }) {
  return (
    <g aria-hidden>
      {candles.map((c, i) => {
        const up = c.c >= c.o
        const col = up ? 'var(--color-brand-green)' : 'var(--color-brand-red)'
        const x = scale.xFor(i)
        const yo = scale.yFor(c.o)
        const yc = scale.yFor(c.c)
        const top = Math.min(yo, yc)
        const h = Math.max(1, Math.abs(yc - yo))
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={scale.yFor(c.h)} y2={scale.yFor(c.l)} stroke={col} strokeWidth={1} />
            <rect x={x - scale.bodyW / 2} y={top} width={scale.bodyW} height={h} fill={col} />
          </g>
        )
      })}
    </g>
  )
}

export interface ChartFrameProps {
  scale: ChartScale
  candles: Candle[]
  ariaLabel: string
  provenance?: string
  children?: ReactNode
  svgRef?: RefObject<SVGSVGElement>
  onPointerDown?: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerMove?: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerUp?: (e: ReactPointerEvent<SVGSVGElement>) => void
}

/** The base candle SVG; overlays are passed as `children` so they share the viewBox. */
export function ChartFrame({
  scale,
  candles,
  ariaLabel,
  provenance,
  children,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: ChartFrameProps) {
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${scale.width} ${scale.height}`}
      role="img"
      aria-label={ariaLabel}
      className="w-full touch-none select-none rounded-xl bg-surface"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <ChartAxis scale={scale} />
      <CandleSeries scale={scale} candles={candles} />
      {children}
      {provenance && (
        <text x={scale.plot.l} y={scale.height - 8} fontSize={10} fontWeight={600} fill="var(--color-brand-blue)">
          {provenance}
        </text>
      )}
    </svg>
  )
}
