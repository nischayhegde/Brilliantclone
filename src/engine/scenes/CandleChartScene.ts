import { ModuleScene } from '../ModuleScene'
import { C, color, hex, FONT, type ColorName } from '../palette'
import { CANDLES, type Candle } from '../../data/candles'

type MarkerKind = 'buy' | 'sell' | 'stop' | 'target' | 'dot'

interface HLine {
  price: number
  col?: ColorName | number
  label?: string
  dashed?: boolean
}
interface Zone {
  from?: number
  to?: number
  fromDate?: string
  toDate?: string
  col?: ColorName | number
  label?: string
}
interface Marker {
  /** Position by array index OR by ISO date (date resolves to the nearest candle). */
  index?: number
  date?: string
  price?: number
  kind: MarkerKind
  label?: string
  col?: ColorName | number
}

interface CandleParams {
  candlesKey?: string
  candles?: Candle[]
  mode?: 'teach' | 'quiz'
  /** First hidden index (quiz). Use this OR splitDate. */
  splitIndex?: number
  /** Reveal up to & including this ISO date, hide after (quiz). */
  splitDate?: string
  drawMs?: number
  hlines?: HLine[]
  zones?: Zone[]
  markers?: Marker[]
  /** Shown on reveal (quiz). */
  outcome?: { text: string; good?: boolean }
}

const PAD = { left: 12, right: 76, top: 20, bottom: 30 }

/**
 * Reusable real-OHLC candlestick scene. Drives Lesson 1 (teach overlays + quiz
 * mask/reveal) and Lesson 3's real-chart modules entirely via params — no per-module
 * code. Animated candle draw-in, sequenced annotations, and a sliding quiz reveal.
 */
export default class CandleChartScene extends ModuleScene {
  private candles: Candle[] = []
  private pmin = 0
  private pmax = 1
  private plot = { l: 0, r: 0, t: 0, b: 0, w: 0, h: 0 }
  private bodyW = 6
  private revealed = false
  private p!: CandleParams

  protected build(): void {
    this.p = this.params as CandleParams
    this.candles = this.p.candles ?? (this.p.candlesKey ? CANDLES[this.p.candlesKey] : undefined) ?? []
    if (this.candles.length === 0) {
      this.label(this.W / 2, this.H / 2, 'No chart data', { align: 'center', col: C.muted })
      this.emitReady()
      return
    }

    this.plot = {
      l: PAD.left,
      r: this.W - PAD.right,
      t: PAD.top,
      b: this.H - PAD.bottom,
      w: this.W - PAD.left - PAD.right,
      h: this.H - PAD.top - PAD.bottom,
    }
    const n = this.candles.length
    const step = this.plot.w / n
    this.bodyW = Math.max(1.5, Math.min(11, step * 0.62))

    // Price range over the FULL dataset so a quiz reveal never rescales the axis.
    let lo = Infinity
    let hi = -Infinity
    for (const c of this.candles) {
      lo = Math.min(lo, c.l)
      hi = Math.max(hi, c.h)
    }
    const padY = (hi - lo) * 0.08
    this.pmin = lo - padY
    this.pmax = hi + padY

    this.drawAxis()

    const mode = this.p.mode ?? 'teach'
    const split =
      mode === 'quiz'
        ? this.p.splitIndex ??
          (this.p.splitDate ? this.idxForDate(this.p.splitDate) + 1 : Math.floor(n * 0.6))
        : n

    // Draw candles up to the split (animated). Hidden candles wait for reveal.
    this.drawCandles(0, split, this.p.drawMs ?? 700, () => {
      if (mode === 'quiz') {
        this.drawMask(split)
        this.emitReady()
      } else {
        this.annotate(() => this.emitReady())
      }
    })
  }

  private xFor(i: number): number {
    const step = this.plot.w / this.candles.length
    return this.plot.l + i * step + step / 2
  }
  private yFor(price: number): number {
    const t = (price - this.pmin) / (this.pmax - this.pmin)
    return this.plot.b - t * this.plot.h
  }

  /** Index of the candle nearest to an ISO date (UTC). */
  private idxForDate(iso: string): number {
    const target = Date.parse(iso + 'T00:00:00Z')
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < this.candles.length; i++) {
      const d = Math.abs(this.candles[i].t * 1000 - target)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  private markerIndex(m: Marker): number {
    if (m.index !== undefined) return m.index
    if (m.date !== undefined) return this.idxForDate(m.date)
    return 0
  }

  private drawAxis(): void {
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline)
    g.lineBetween(this.plot.l, this.plot.b, this.plot.r, this.plot.b)
    // 4 horizontal gridlines + right-edge price labels.
    for (let i = 0; i <= 3; i++) {
      const price = this.pmin + ((this.pmax - this.pmin) * i) / 3
      const y = this.yFor(price)
      g.lineStyle(1, C.gray100)
      g.lineBetween(this.plot.l, y, this.plot.r, y)
      this.label(this.plot.r + 8, y, this.fmtPrice(price), { size: 11, col: C.muted })
    }
  }

  private fmtPrice(p: number): string {
    if (p >= 100) return p.toFixed(0)
    if (p >= 10) return p.toFixed(1)
    return p.toFixed(2)
  }

  private drawCandles(from: number, to: number, totalMs: number, done?: () => void): void {
    const each = Math.max(6, totalMs / Math.max(1, to - from))
    let i = from
    const drawNext = () => {
      if (i >= to) {
        done?.()
        return
      }
      this.drawOneCandle(i)
      i++
      this.time.delayedCall(each, drawNext)
    }
    drawNext()
  }

  private drawOneCandle(i: number): void {
    const c = this.candles[i]
    const up = c.c >= c.o
    const col = up ? C.green : C.red
    const x = this.xFor(i)
    const g = this.add.graphics()
    // wick
    g.lineStyle(1.2, col, 1)
    g.lineBetween(x, this.yFor(c.h), x, this.yFor(c.l))
    // body
    const yo = this.yFor(c.o)
    const yc = this.yFor(c.c)
    const top = Math.min(yo, yc)
    const bh = Math.max(1.5, Math.abs(yc - yo))
    g.fillStyle(col, 1)
    g.fillRect(x - this.bodyW / 2, top, this.bodyW, bh)
    g.alpha = 0
    this.tweens.add({ targets: g, alpha: 1, duration: 120, ease: 'Quad.out' })
  }

  // --- Teach annotations (sequenced) ---------------------------------------
  private annotate(done?: () => void): void {
    const items: Array<() => void> = []
    for (const z of this.p.zones ?? []) items.push(() => this.drawZone(z))
    for (const h of this.p.hlines ?? []) items.push(() => this.drawHLine(h))
    for (const m of this.p.markers ?? []) items.push(() => this.drawMarker(m))

    let k = 0
    const next = () => {
      if (k >= items.length) {
        done?.()
        return
      }
      items[k]()
      k++
      this.time.delayedCall(260, next)
    }
    next()
  }

  private drawZone(z: Zone): void {
    const from = z.from ?? (z.fromDate ? this.idxForDate(z.fromDate) : 0)
    const to = z.to ?? (z.toDate ? this.idxForDate(z.toDate) : this.candles.length - 1)
    const x1 = this.xFor(from) - this.bodyW
    const x2 = this.xFor(to) + this.bodyW
    const g = this.add.graphics()
    g.fillStyle(color(z.col ?? C.blue), 0.08)
    g.fillRect(x1, this.plot.t, x2 - x1, this.plot.h)
    g.lineStyle(1, color(z.col ?? C.blue), 0.5)
    g.strokeRect(x1, this.plot.t, x2 - x1, this.plot.h)
    if (z.label) this.fadeIn(this.label((x1 + x2) / 2, this.plot.t + 12, z.label, { size: 11, col: z.col ?? C.blue, align: 'center', bold: true }))
    g.alpha = 0
    this.tweens.add({ targets: g, alpha: 1, duration: 300 })
  }

  private drawHLine(h: HLine): void {
    const y = this.yFor(h.price)
    const line = h.dashed
      ? this.dashedLine(this.plot.l, y, this.plot.r, h.col ?? C.blue)
      : (() => {
          const g = this.add.graphics()
          g.lineStyle(1.5, color(h.col ?? C.blue))
          g.lineBetween(this.plot.l, y, this.plot.r, y)
          return g
        })()
    line.alpha = 0
    this.tweens.add({ targets: line, alpha: 1, duration: 280 })
    if (h.label) {
      const t = this.label(this.plot.l + 6, y - 10, h.label, { size: 11, col: h.col ?? C.blue, bold: true })
      this.fadeIn(t)
    }
  }

  private drawMarker(m: Marker): void {
    const idx = Math.max(0, Math.min(this.markerIndex(m), this.candles.length - 1))
    const x = this.xFor(idx)
    const price = m.price ?? this.candles[idx].c
    const y = this.yFor(price)
    const defaultCol: Record<MarkerKind, number> = {
      buy: C.green,
      sell: C.red,
      stop: C.red,
      target: C.blue,
      dot: C.blue,
    }
    const col = color(m.col ?? defaultCol[m.kind])
    const isLow = m.kind === 'buy'
    const yOff = isLow ? 16 : -16
    const dot = this.add.circle(x, y, 5, col).setStrokeStyle(2, C.white)
    const tag = (m.label ?? m.kind.toUpperCase())
    const t = this.add
      .text(x, y + yOff, tag, { fontFamily: FONT, fontSize: '11px', color: hex(col), fontStyle: 'bold' })
      .setOrigin(0.5)
    dot.setScale(0)
    this.tweens.add({ targets: dot, scale: 1, duration: 260, ease: 'Back.out' })
    this.fadeIn(t)
  }

  // --- Quiz mask + reveal ---------------------------------------------------
  private maskG?: Phaser.GameObjects.Container
  private splitIdx = 0
  private drawMask(split: number): void {
    this.splitIdx = split
    const x = this.xFor(split) - this.bodyW
    const w = this.plot.r - x + 4
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 0.95)
    g.fillRect(x, this.plot.t, w, this.plot.h)
    g.lineStyle(2, C.blue, 0.7)
    // dashed split boundary
    for (let yy = this.plot.t; yy < this.plot.b; yy += 12) g.lineBetween(x, yy, x, Math.min(yy + 7, this.plot.b))
    const q = this.add.text(x + w / 2, this.plot.t + this.plot.h / 2, '?', {
      fontFamily: FONT,
      fontSize: '54px',
      color: hex(C.blue),
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.5)
    const hint = this.add
      .text(x + w / 2, this.plot.t + this.plot.h / 2 + 44, 'outcome hidden', {
        fontFamily: FONT,
        fontSize: '12px',
        color: hex(C.blue),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.7)
    this.maskG = this.add.container(0, 0, [g, q, hint])
    // visible-setup markers (index < split)
    for (const m of this.p.markers ?? []) if (this.markerIndex(m) < split) this.drawMarker(m)
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true
    if (this.maskG) {
      this.tweens.add({
        targets: this.maskG,
        x: this.W,
        alpha: 0,
        duration: 520,
        ease: 'Cubic.inOut',
        onComplete: () => this.maskG?.destroy(),
      })
    }
    // draw the hidden candles
    this.time.delayedCall(180, () => {
      this.drawCandles(this.splitIdx, this.candles.length, 600, () => {
        for (const m of this.p.markers ?? []) if (this.markerIndex(m) >= this.splitIdx) this.drawMarker(m)
        for (const h of this.p.hlines ?? []) this.drawHLine(h)
        if (this.p.outcome) this.showOutcome(this.p.outcome)
      })
    })
  }

  private showOutcome(o: { text: string; good?: boolean }): void {
    const col = o.good ? C.green : C.red
    const w = 300
    const x = this.plot.l + this.plot.w / 2 - w / 2
    const y = this.plot.t + 8
    const panel = this.panel(x, y, w, 34, { fill: o.good ? C.greenSoft : C.redSoft, stroke: col, radius: 10 })
    const t = this.label(x + w / 2, y + 17, o.text, { size: 13, col, bold: true, align: 'center' })
    panel.alpha = 0
    t.alpha = 0
    this.tweens.add({ targets: [panel, t], alpha: 1, duration: 360, delay: 120 })
  }
}
