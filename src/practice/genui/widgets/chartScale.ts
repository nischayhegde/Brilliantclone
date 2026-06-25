/**
 * Pure, resolution-independent candle-chart scale math. This is the single source of
 * truth the React `candle-chart` widget and its SVG overlays (`price-lines`,
 * `annotate-chart`) all share, so a line and its label can never drift from the bars.
 *
 * The SVG renders into a FIXED viewBox (width × height), so every coordinate is in
 * viewBox units and the browser scales the whole surface responsively — overlays stay
 * pixel-aligned with the chart without any DOM measurement. NO React/DOM imports here.
 */
import type { Candle } from '../../../data/candles'

export interface PlotRect {
  l: number
  r: number
  t: number
  b: number
  w: number
  h: number
}

export interface ChartScale {
  /** Padded price-axis extremes (the y-domain). */
  pmin: number
  pmax: number
  /** The drawable plot rectangle inside the padded viewBox. */
  plot: PlotRect
  width: number
  height: number
  /** Number of candles. */
  n: number
  /** Candle body width in viewBox units. */
  bodyW: number
  /** Horizontal step between candle centers. */
  step: number
  /** Candle index → x (center of the bar). */
  xFor(i: number): number
  /** Price → y (clamped domain). */
  yFor(price: number): number
  /** y (viewBox units) → price, clamped to the plot. */
  priceFor(y: number): number
  /** x (viewBox units) → nearest candle index, clamped to range. */
  indexFor(x: number): number
  /** Format a price for axis/readouts. */
  fmtPrice(p: number): string
}

export interface ChartScaleOptions {
  width?: number
  height?: number
  pad?: { left: number; right: number; top: number; bottom: number }
  /** Fraction of the price range added as headroom above/below. */
  padFrac?: number
}

/** Right gutter leaves room for the price knobs + value chips of the overlays. */
export const DEFAULT_CHART_PAD = { left: 8, right: 64, top: 16, bottom: 28 }
export const DEFAULT_CHART_WIDTH = 480
export const DEFAULT_CHART_HEIGHT = 280

/** Padded [low, high] envelope of a candle slice. Safe on empty / flat slices. */
export function priceRange(candles: Candle[], padFrac = 0.08): { min: number; max: number } {
  let lo = Infinity
  let hi = -Infinity
  for (const c of candles) {
    if (c.l < lo) lo = c.l
    if (c.h > hi) hi = c.h
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1 }
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.05 || 1
    return { min: lo - pad, max: hi + pad }
  }
  const pad = (hi - lo) * padFrac
  return { min: lo - pad, max: hi + pad }
}

export function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return '—'
  return p.toFixed(2)
}

/**
 * Build the pure scale for a candle slice at a given viewBox size. Mirrors the proven
 * Phaser `CandleChartScene` math (xFor/yFor/yToPrice) but free of any engine deps.
 */
export function makeChartScale(candles: Candle[], opts: ChartScaleOptions = {}): ChartScale {
  const width = opts.width ?? DEFAULT_CHART_WIDTH
  const height = opts.height ?? DEFAULT_CHART_HEIGHT
  const pad = opts.pad ?? DEFAULT_CHART_PAD
  const { min: pmin, max: pmax } = priceRange(candles, opts.padFrac)

  const plot: PlotRect = {
    l: pad.left,
    r: width - pad.right,
    t: pad.top,
    b: height - pad.bottom,
    w: width - pad.left - pad.right,
    h: height - pad.top - pad.bottom,
  }
  const n = candles.length
  const step = plot.w / Math.max(1, n)
  const bodyW = Math.max(1.5, Math.min(11, step * 0.62))
  const span = pmax - pmin || 1

  const xFor = (i: number): number => plot.l + i * step + step / 2
  const yFor = (price: number): number => plot.b - ((price - pmin) / span) * plot.h
  const priceFor = (y: number): number => {
    const cy = Math.max(plot.t, Math.min(plot.b, y))
    return pmin + ((plot.b - cy) / plot.h) * span
  }
  const indexFor = (x: number): number => {
    const i = Math.floor((x - plot.l) / step)
    return Math.max(0, Math.min(n - 1, i))
  }

  return { pmin, pmax, plot, width, height, n, bodyW, step, xFor, yFor, priceFor, indexFor, fmtPrice }
}
