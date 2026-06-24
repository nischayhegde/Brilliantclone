import Phaser from 'phaser'
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

/**
 * Trade challenge: the learner drags a take-profit + stop-loss (or chooses to stay
 * out); on Submit the hidden candles reveal and the trade is simulated bar-by-bar.
 * Used by `type: 'challenge'` modules with mode:'quiz'.
 */
interface TradeChallenge {
  direction: 'long' | 'short'
  /** Entry price (the breakout/decision level at the split). */
  entry: number
  /** Optional initial take-profit / stop-loss (else sensible defaults). */
  tp0?: number
  sl0?: number
  /** Did the pattern actually complete? Used to grade a "stay out" decision. */
  completes: boolean
  /** Position size for the dollar P&L (default 100). */
  shares?: number
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
  /** Present → this is an interactive TP/SL trade challenge (see onSubmit). */
  trade?: TradeChallenge
}

/** A draggable price control (take-profit / stop-loss). */
interface TradeControl {
  get: () => number
  setActive: (active: boolean) => void
  isActive: () => boolean
  pixelY: () => number
  setFromPointerY: (py: number) => void
}

const PAD = { left: 12, right: 78, top: 22, bottom: 30 }

/**
 * Reusable real-OHLC candlestick scene. Drives Reading the Charts (teach overlays +
 * quiz mask/reveal) and Short Selling's real-chart modules entirely via params — no
 * per-module code.
 *
 * Craft notes:
 *  - Colors follow the warm Trilliant identity: green = buy/long, red = sell/stop,
 *    amber = the level/target (the brand "attention" accent), ink = your entry.
 *  - All on-canvas text is sized through `fs()` so it stays legible after the canvas
 *    is FIT-scaled down on phones, and dense structural labels are dropped on compact
 *    (phone) widths so the chart never clutters.
 *  - Every text label is de-collided vertically (`placeLabel`) so nothing overlaps.
 *  - Motion is intentional and respects `prefers-reduced-motion`.
 */
export default class CandleChartScene extends ModuleScene {
  private candles: Candle[] = []
  private pmin = 0
  private pmax = 1
  private plot = { l: 0, r: 0, t: 0, b: 0, w: 0, h: 0 }
  private bodyW = 6
  private revealed = false
  private p!: CandleParams

  /** Occupied label rectangles, used to nudge new labels clear of existing ones. */
  private labelRects: Phaser.Geom.Rectangle[] = []

  // --- trade challenge state ---
  private took = true
  private locked = false
  /** Set once the trade controls exist, so an eager Submit can't run on undefined lines. */
  private tradeReady = false
  /** A Submit that arrived during the intro draw is replayed the moment setup finishes. */
  private pendingSubmit = false
  private tpCtl?: TradeControl
  private slCtl?: TradeControl
  private tradeControls: TradeControl[] = []
  private dragging?: TradeControl
  private toggleBtns: Array<{
    key: 'take' | 'stay'
    bg: Phaser.GameObjects.Graphics
    txt: Phaser.GameObjects.Text
    w: number
    h: number
    x: number
    y: number
  }> = []

  protected build(): void {
    this.p = this.params as CandleParams
    this.candles = this.p.candles ?? (this.p.candlesKey ? CANDLES[this.p.candlesKey] : undefined) ?? []
    if (this.candles.length === 0) {
      this.label(this.W / 2, this.H / 2, 'No chart data', { align: 'center', col: C.muted, size: this.fs(14) })
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
        if (this.p.trade) {
          this.setupTrade()
          this.tradeReady = true
          this.setCanSubmit(true)
          // Honour a Submit that was pressed before setup finished.
          if (this.pendingSubmit) {
            this.pendingSubmit = false
            this.onSubmit()
          }
        }
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
    // 4 horizontal gridlines + right-edge price labels.
    for (let i = 0; i <= 3; i++) {
      const price = this.pmin + ((this.pmax - this.pmin) * i) / 3
      const y = this.yFor(price)
      g.lineStyle(1, C.gray100)
      g.lineBetween(this.plot.l, y, this.plot.r, y)
      this.label(this.plot.r + 8, y, this.fmtPrice(price), { size: this.fs(11), col: C.muted })
    }
    // Baseline drawn last so it sits crisply over the faint grid.
    g.lineStyle(1.25, C.hairline)
    g.lineBetween(this.plot.l, this.plot.b, this.plot.r, this.plot.b)
  }

  private fmtPrice(p: number): string {
    if (p >= 100) return p.toFixed(0)
    if (p >= 10) return p.toFixed(1)
    return p.toFixed(2)
  }

  // ── Candle draw-in ────────────────────────────────────────────────────────
  private drawCandles(from: number, to: number, totalMs: number, done?: () => void): void {
    if (this.reduceMotion) {
      for (let i = from; i < to; i++) this.drawOneCandle(i, true)
      done?.()
      return
    }
    const each = Math.max(5, totalMs / Math.max(1, to - from))
    let i = from
    const drawNext = () => {
      if (i >= to) {
        done?.()
        return
      }
      this.drawOneCandle(i, false)
      i++
      this.time.delayedCall(each, drawNext)
    }
    drawNext()
  }

  private drawOneCandle(i: number, instant: boolean): void {
    const c = this.candles[i]
    const up = c.c >= c.o
    const col = up ? C.green : C.red
    const x = this.xFor(i)
    const g = this.add.graphics()
    g.lineStyle(1.2, col, 1)
    g.lineBetween(x, this.yFor(c.h), x, this.yFor(c.l))
    const yo = this.yFor(c.o)
    const yc = this.yFor(c.c)
    const top = Math.min(yo, yc)
    const bh = Math.max(1.5, Math.abs(yc - yo))
    g.fillStyle(col, 1)
    g.fillRect(x - this.bodyW / 2, top, this.bodyW, bh)
    if (instant) return
    // A short fade + tiny rise as each bar prints — gives the series a sense of
    // being drawn left-to-right without animating layout.
    g.alpha = 0
    g.y = 5
    this.tweens.add({ targets: g, alpha: 1, y: 0, duration: 150, ease: 'Sine.out' })
  }

  // ── Label placement (collision-free) ──────────────────────────────────────
  /** Readable text color for a vibrant line/marker color, on a white chip. */
  private labelInk(col: number): number {
    if (col === C.amber || col === C.amberDark) return C.amberInk
    if (col === C.red) return C.redText
    if (col === C.green || col === C.greenLight) return C.greenText
    return col
  }

  /** Shift a text object horizontally so its bounds stay inside the plot. */
  private clampLabelX(t: Phaser.GameObjects.Text): void {
    const b = t.getBounds()
    if (b.x < this.plot.l + 2) t.x += this.plot.l + 2 - b.x
    const b2 = t.getBounds()
    if (b2.right > this.plot.r - 2) t.x -= b2.right - (this.plot.r - 2)
  }

  /** Nearest vertical center for a label that doesn't overlap any reserved rect. */
  private freeY(t: Phaser.GameObjects.Text, cyWanted: number, pad: number): number {
    const b = t.getBounds()
    const half = b.height / 2 + pad
    const x1 = b.x - pad
    const x2 = b.x + b.width + pad
    const lo = this.plot.t + half + 1
    const hi = this.plot.b - half - 1
    const clamp = (cy: number) => Math.max(lo, Math.min(hi, cy))
    const hits = (cy: number) =>
      this.labelRects.some(
        (r) => x1 < r.right && x2 > r.x && cy - half < r.bottom && cy + half > r.y,
      )
    const start = clamp(cyWanted)
    if (!hits(start)) return start
    for (let s = 4; s <= 220; s += 4) {
      const up = clamp(cyWanted - s)
      if (!hits(up)) return up
      const dn = clamp(cyWanted + s)
      if (!hits(dn)) return dn
    }
    return start
  }

  /**
   * Create a chip-backed label that never overlaps prior labels. If it gets
   * nudged away from `anchor`, a faint leader line connects them.
   */
  private placeLabel(
    x: number,
    yWanted: number,
    text: string,
    opts: {
      col: number
      align: 'left' | 'center' | 'right'
      sizePx?: number
      delay?: number
      anchor?: { x: number; y: number }
      chipAlpha?: number
    },
  ): Phaser.GameObjects.Text {
    const t = this.label(x, yWanted, text, {
      size: this.fs(opts.sizePx ?? 13),
      col: opts.col,
      bold: true,
      align: opts.align,
    })
    this.clampLabelX(t)
    const pad = 3
    const finalY = this.freeY(t, yWanted, pad)
    t.setY(finalY)
    const b = t.getBounds()
    const rect = new Phaser.Geom.Rectangle(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2)
    this.labelRects.push(rect)

    const chip = this.add.graphics()
    chip.fillStyle(C.white, opts.chipAlpha ?? 0.92)
    chip.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 5)
    this.children.moveBelow(chip, t)

    const objs: Array<Phaser.GameObjects.GameObject & { alpha: number }> = [t, chip]
    if (opts.anchor && Math.abs(opts.anchor.y - finalY) > 12) {
      const leader = this.add.graphics()
      leader.lineStyle(1, opts.col, 0.45)
      leader.lineBetween(opts.anchor.x, opts.anchor.y, t.x - t.originX * t.width + t.width / 2, finalY)
      this.children.moveBelow(leader, chip)
      objs.push(leader)
    }

    if (!this.reduceMotion) {
      objs.forEach((o) => (o.alpha = 0))
      this.tweens.add({ targets: objs, alpha: 1, duration: 300, delay: opts.delay ?? 0, ease: 'Cubic.out' })
    }
    return t
  }

  // ── Teach annotations (sequenced) ─────────────────────────────────────────
  private annotate(done?: () => void): void {
    const items: Array<() => void> = []
    for (const z of this.p.zones ?? []) items.push(() => this.drawZone(z))
    for (const h of this.p.hlines ?? []) items.push(() => this.drawHLine(h))
    for (const m of this.p.markers ?? []) items.push(() => this.drawMarker(m))

    if (this.reduceMotion) {
      items.forEach((fn) => fn())
      done?.()
      return
    }
    let k = 0
    const next = () => {
      if (k >= items.length) {
        done?.()
        return
      }
      items[k]()
      k++
      this.time.delayedCall(180, next)
    }
    next()
  }

  private drawZone(z: Zone): void {
    const lineCol = color(z.col ?? C.amber)
    const from = z.from ?? (z.fromDate ? this.idxForDate(z.fromDate) : 0)
    const to = z.to ?? (z.toDate ? this.idxForDate(z.toDate) : this.candles.length - 1)
    const x1 = this.xFor(from) - this.bodyW
    const x2 = this.xFor(to) + this.bodyW
    const g = this.add.graphics()
    g.fillStyle(lineCol, 0.1)
    g.fillRoundedRect(x1, this.plot.t, x2 - x1, this.plot.h, 4)
    g.lineStyle(1, lineCol, 0.5)
    g.strokeRoundedRect(x1, this.plot.t, x2 - x1, this.plot.h, 4)
    if (!this.reduceMotion) {
      g.alpha = 0
      this.tweens.add({ targets: g, alpha: 1, duration: 280 })
    }
    if (z.label) {
      this.placeLabel((x1 + x2) / 2, this.plot.t + 11, z.label, {
        col: this.labelInk(lineCol),
        align: 'center',
        sizePx: 12,
      })
    }
  }

  private drawHLine(h: HLine): void {
    const lineCol = color(h.col ?? C.amber)
    const y = this.yFor(h.price)
    const line = h.dashed
      ? this.dashedLine(this.plot.l, y, this.plot.r, lineCol)
      : (() => {
          const g = this.add.graphics()
          g.lineStyle(1.5, lineCol)
          g.lineBetween(this.plot.l, y, this.plot.r, y)
          return g
        })()
    if (!this.reduceMotion) {
      line.alpha = 0
      this.tweens.add({ targets: line, alpha: 1, duration: 260 })
    }
    if (h.label) {
      this.placeLabel(this.plot.l + 6, y - 12, h.label, {
        col: this.labelInk(lineCol),
        align: 'left',
        sizePx: 13,
      })
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
      target: C.amber,
      dot: C.inkSoft,
    }
    const col = color(m.col ?? defaultCol[m.kind])
    const isAction = m.kind !== 'dot'
    const r = isAction ? 5 : 4
    const dot = this.add.circle(x, y, r, col).setStrokeStyle(2, C.white)
    if (this.reduceMotion) {
      dot.setScale(1)
    } else {
      dot.setScale(0)
      this.tweens.add({ targets: dot, scale: 1, duration: 240, ease: 'Back.out' })
    }

    // On phones, drop the many quiet "structure" dot labels — they're the main
    // source of clutter and the caption restates them. Keep the actionable ones.
    if (this.compact && m.kind === 'dot') return

    const tag = m.label ?? m.kind.toUpperCase()
    const below = m.kind === 'buy'
    const yOff = below ? 16 : -16
    this.placeLabel(x, y + yOff, tag, {
      col: this.labelInk(col),
      align: 'center',
      sizePx: 13,
      anchor: { x, y },
    })
  }

  // ── Quiz mask + reveal ────────────────────────────────────────────────────
  private maskG?: Phaser.GameObjects.Container
  private splitIdx = 0
  private drawMask(split: number): void {
    this.splitIdx = split
    const x = this.xFor(split) - this.bodyW
    const w = this.plot.r - x + 4
    const g = this.add.graphics()
    g.fillStyle(C.amberSoft, 0.96)
    g.fillRect(x, this.plot.t, w, this.plot.h)
    // Dashed split boundary.
    g.lineStyle(2, C.amber, 0.7)
    for (let yy = this.plot.t; yy < this.plot.b; yy += 12) g.lineBetween(x, yy, x, Math.min(yy + 7, this.plot.b))
    const cx = x + w / 2
    const cy = this.plot.t + this.plot.h / 2
    const q = this.add
      .text(cx, cy - 6, '?', {
        fontFamily: FONT,
        fontSize: `${this.fs(46, 24, 70)}px`,
        color: hex(C.amber),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.6)
    const hint = this.add
      .text(cx, cy + this.fs(30, 18, 44), 'outcome hidden', {
        fontFamily: FONT,
        fontSize: `${this.fs(12)}px`,
        color: hex(C.amberInk),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.maskG = this.add.container(0, 0, [g, q, hint])
    // visible-setup markers (index < split)
    for (const m of this.p.markers ?? []) if (this.markerIndex(m) < split) this.drawMarker(m)
  }

  private slideAwayMask(onDone?: () => void): void {
    if (!this.maskG) {
      onDone?.()
      return
    }
    if (this.reduceMotion) {
      this.maskG.destroy()
      this.maskG = undefined
      onDone?.()
      return
    }
    this.tweens.add({
      targets: this.maskG,
      x: this.W,
      alpha: 0,
      duration: 560,
      ease: 'Expo.out',
      onComplete: () => {
        this.maskG?.destroy()
        this.maskG = undefined
        onDone?.()
      },
    })
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true
    this.slideAwayMask()
    this.time.delayedCall(this.dur(160), () => {
      this.drawCandles(this.splitIdx, this.candles.length, 600, () => {
        for (const m of this.p.markers ?? []) if (this.markerIndex(m) >= this.splitIdx) this.drawMarker(m)
        for (const h of this.p.hlines ?? []) this.drawHLine(h)
        if (this.p.outcome) this.showOutcome(this.p.outcome)
      })
    })
  }

  private showOutcome(o: { text: string; good?: boolean }): void {
    const col = o.good ? C.green : C.red
    const w = Math.min(320, this.plot.w - 24)
    const x = this.plot.l + this.plot.w / 2 - w / 2
    const y = this.plot.t + 8
    const panel = this.panel(x, y, w, 36, {
      fill: o.good ? C.greenSoft : C.redSoft,
      stroke: col,
      radius: 10,
    })
    const t = this.label(x + w / 2, y + 18, o.text, {
      size: this.fs(13),
      col: this.labelInk(col),
      bold: true,
      align: 'center',
    })
    if (!this.reduceMotion) {
      panel.alpha = 0
      t.alpha = 0
      this.tweens.add({ targets: [panel, t], alpha: 1, duration: 340, delay: 120 })
    }
  }

  // ═══════════════════ Trade challenge ═══════════════════
  private yToPrice(y: number): number {
    const cy = Math.max(this.plot.t, Math.min(this.plot.b, y))
    const t = (this.plot.b - cy) / this.plot.h
    return this.pmin + t * (this.pmax - this.pmin)
  }

  private setupTrade(): void {
    const tr = this.p.trade!
    const long = tr.direction === 'long'
    const entry = tr.entry
    const span = this.pmax - this.pmin
    const tick = span * 0.012

    // Entry / current price — neutral ink so it reads as "where you are".
    const ey = this.yFor(entry)
    const eg = this.add.graphics()
    eg.lineStyle(1.5, C.ink, 0.85)
    eg.lineBetween(this.plot.l, ey, this.plot.r, ey)
    this.placeLabel(this.plot.l + 6, ey - 12, `Entry ${this.fmtPrice(entry)}`, {
      col: C.ink,
      align: 'left',
      sizePx: 13,
    })

    // A single full-plot drag band created BEFORE the toggle, so the toggle (added
    // after) wins its own taps while a press anywhere else drags the NEAREST active
    // line. This kills the old bug where two stacked full-width hit-strips made the
    // lower line ungrabbable.
    const band = this.add
      .rectangle((this.plot.l + this.plot.r) / 2, (this.plot.t + this.plot.b) / 2, this.plot.w, this.plot.h, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    band.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.locked) return
      const actives = this.tradeControls.filter((c) => c.isActive())
      if (actives.length === 0) return
      this.dragging = actives.reduce((best, c) =>
        Math.abs(c.pixelY() - p.y) < Math.abs(best.pixelY() - p.y) ? c : best,
      )
      this.dragging.setFromPointerY(p.y)
    })

    const tp0 = tr.tp0 ?? (long ? entry + span * 0.2 : entry - span * 0.2)
    const sl0 = tr.sl0 ?? (long ? entry - span * 0.1 : entry + span * 0.1)
    this.tpCtl = this.addPriceLine(tp0, C.green, 'TP', (pr) =>
      long ? Math.min(this.pmax, Math.max(entry + tick, pr)) : Math.max(this.pmin, Math.min(entry - tick, pr)),
    )
    this.slCtl = this.addPriceLine(sl0, C.red, 'SL', (pr) =>
      long ? Math.max(this.pmin, Math.min(entry - tick, pr)) : Math.min(this.pmax, Math.max(entry + tick, pr)),
    )

    const onMove = (p: Phaser.Input.Pointer) => {
      if (this.dragging && !this.locked) this.dragging.setFromPointerY(p.y)
    }
    const onUp = () => {
      this.dragging = undefined
    }
    this.input.on('pointermove', onMove)
    this.input.on('pointerup', onUp)
    this.input.on('pointerupoutside', onUp)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', onMove)
      this.input.off('pointerup', onUp)
      this.input.off('pointerupoutside', onUp)
    })

    this.buildTradeToggle()
  }

  private addPriceLine(
    price0: number,
    col: number,
    prefix: string,
    constrain: (p: number) => number,
  ): TradeControl {
    let price = constrain(price0)
    let active = true
    const labelCol = this.labelInk(col)
    const lineG = this.add.graphics()
    const chip = this.add.graphics()
    const lbl = this.label(this.plot.r - 20, 0, '', { size: this.fs(13), col: labelCol, bold: true, align: 'right' })
    // Generous knob (a clear grab handle) in the right gutter, comfy on touch.
    const knobR = this.compact ? 10 : 8
    const halo = this.add.circle(this.plot.r - 10, 0, knobR + 7, col, 0.16).setVisible(false)
    const knob = this.add.circle(this.plot.r - 10, 0, knobR, col).setStrokeStyle(2.5, C.white)

    const redraw = () => {
      const y = this.yFor(price)
      lineG.clear()
      lineG.lineStyle(1.8, col, active ? 1 : 0.22)
      for (let x = this.plot.l; x < this.plot.r - 14; x += 10)
        lineG.lineBetween(x, y, Math.min(x + 6, this.plot.r - 14), y)
      knob.y = y
      halo.y = y
      knob.setAlpha(active ? 1 : 0.28)
      lbl.setText(`${prefix} ${this.fmtPrice(price)}`)
      lbl.setPosition(this.plot.r - 22, y)
      lbl.setAlpha(active ? 1 : 0.45)
      const padX = 5
      const padY = 2
      const h = lbl.height + padY * 2
      chip.clear()
      chip.fillStyle(C.white, active ? 0.92 : 0.55)
      chip.fillRoundedRect(lbl.x - lbl.width - padX, y - h / 2, lbl.width + padX * 2, h, 4)
    }
    redraw()

    const ctl: TradeControl = {
      get: () => price,
      isActive: () => active,
      pixelY: () => this.yFor(price),
      setActive: (a: boolean) => {
        active = a
        halo.setVisible(false)
        redraw()
      },
      setFromPointerY: (py: number) => {
        if (!active) return
        price = constrain(this.yToPrice(py))
        halo.setVisible(true)
        redraw()
      },
    }
    this.tradeControls.push(ctl)
    return ctl
  }

  private buildTradeToggle(): void {
    const size = this.fs(13)
    const padX = 14
    const y = this.plot.t + (this.compact ? 18 : 16)
    let x = this.plot.l + 6
    for (const [key, label] of [
      ['take', 'Take trade'],
      ['stay', 'Stay out'],
    ] as Array<['take' | 'stay', string]>) {
      const txt = this.add
        .text(0, y, label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold' })
        .setOrigin(0, 0.5)
      const w = txt.width + padX * 2
      const h = txt.height + 14
      txt.setX(x + padX)
      const bg = this.add.graphics()
      this.children.moveBelow(bg, txt)
      const hit = this.add.rectangle(x + w / 2, y, w, h, 0x000000, 0).setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => {
        if (this.locked) return
        this.took = key === 'take'
        this.refreshToggle()
        this.tpCtl?.setActive(this.took)
        this.slCtl?.setActive(this.took)
      })
      this.toggleBtns.push({ key, bg, txt, w, h, x, y })
      x += w + 8
    }
    this.refreshToggle()
  }

  private refreshToggle(): void {
    for (const b of this.toggleBtns) {
      const selected = (this.took && b.key === 'take') || (!this.took && b.key === 'stay')
      const fill = selected ? (b.key === 'take' ? C.green : C.ink) : C.white
      b.bg.clear()
      b.bg.fillStyle(fill, 1)
      b.bg.fillRoundedRect(b.x, b.y - b.h / 2, b.w, b.h, 8)
      b.bg.lineStyle(1.5, selected ? fill : C.hairline)
      b.bg.strokeRoundedRect(b.x, b.y - b.h / 2, b.w, b.h, 8)
      b.txt.setColor(hex(selected ? C.white : C.muted))
    }
  }

  protected onSubmit(): void {
    if (!this.p.trade || this.locked) return
    // Eager click during the intro candle draw (before setupTrade): remember it and
    // replay once the TP/SL lines exist, instead of dereferencing undefined controls.
    if (!this.tradeReady || !this.tpCtl || !this.slCtl) {
      this.pendingSubmit = true
      return
    }
    this.locked = true
    this.dragging = undefined
    this.setCanSubmit(false)
    this.slideAwayMask()
    this.time.delayedCall(this.dur(150), () => {
      this.drawCandles(this.splitIdx, this.candles.length, 600, () => this.simulateTrade())
    })
  }

  private simulateTrade(): void {
    const tr = this.p.trade!
    const long = tr.direction === 'long'
    const shares = tr.shares ?? 100
    const entry = tr.entry

    if (!this.took) {
      const correct = !tr.completes
      const title = correct ? 'Good discipline — you stayed out' : 'You sat out a winner'
      const detail = tr.completes
        ? 'The pattern confirmed and ran in the trade’s favour, so staying out left profit on the table. When a setup confirms, a measured entry with a stop is the play.'
        : 'The setup faked out and broke the wrong way — standing aside avoided the loss. Knowing when NOT to trade is half the edge.'
      this.report(correct, title, detail)
      return
    }

    const tp = this.tpCtl!.get()
    const sl = this.slCtl!.get()
    let exit = this.candles[this.candles.length - 1].c
    let hit: 'tp' | 'sl' | 'end' = 'end'
    let exitIdx = this.candles.length - 1
    for (let i = this.splitIdx; i < this.candles.length; i++) {
      const c = this.candles[i]
      // Stop checked first within a bar (conservative).
      if (long ? c.l <= sl : c.h >= sl) {
        exit = sl
        hit = 'sl'
        exitIdx = i
        break
      }
      if (long ? c.h >= tp : c.l <= tp) {
        exit = tp
        hit = 'tp'
        exitIdx = i
        break
      }
    }
    const perShare = long ? exit - entry : entry - exit
    const pnl = perShare * shares
    const correct = pnl > 0
    const money = `${pnl >= 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(0)}`
    this.drawExitMarker(exitIdx, exit, hit, correct)

    let title: string
    let detail: string
    if (hit === 'tp') {
      title = `Take-profit hit · ${money}`
      detail = `Price reached your target at ${this.fmtPrice(tp)} before your stop — you banked ${money} on ${shares} shares (entry ${this.fmtPrice(entry)} → ${this.fmtPrice(exit)}).`
    } else if (hit === 'sl') {
      title = `Stopped out · ${money}`
      detail = tr.completes
        ? `Your stop at ${this.fmtPrice(sl)} was hit even though the pattern ultimately worked — too tight a stop got shaken out on the noise. Give a confirmed trade room beyond the recent swing.`
        : `Your stop at ${this.fmtPrice(sl)} was hit: the setup faked out and broke the wrong way. The stop did its job and capped the loss at ${money}.`
    } else {
      title = `Closed at the end · ${money}`
      detail = `Neither your target (${this.fmtPrice(tp)}) nor your stop (${this.fmtPrice(sl)}) was reached, so the trade closed at ${this.fmtPrice(exit)} for ${money}.`
    }
    this.report(correct, title, detail)
  }

  private drawExitMarker(idx: number, price: number, hit: 'tp' | 'sl' | 'end', good: boolean): void {
    const x = this.xFor(idx)
    const y = this.yFor(price)
    const col = good ? C.green : C.red
    const dot = this.add.circle(x, y, 6, col).setStrokeStyle(2, C.white)
    if (this.reduceMotion) {
      dot.setScale(1)
    } else {
      dot.setScale(0)
      this.tweens.add({ targets: dot, scale: 1, duration: 300, ease: 'Back.out' })
    }
    const tag = hit === 'tp' ? 'TP hit' : hit === 'sl' ? 'SL hit' : 'exit'
    this.placeLabel(x, y - 18, tag, { col: this.labelInk(col), align: 'center', sizePx: 13, anchor: { x, y } })
  }
}
