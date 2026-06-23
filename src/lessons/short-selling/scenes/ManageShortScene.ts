import { ModuleScene } from '../../../engine/ModuleScene'
import { C, FONT, hex, color } from '../../../engine/palette'
import { CANDLES, type Candle } from '../../../data/candles'

interface ManageShortParams {
  /** Trending (winning) path. Default 'short_winner_PTON'. */
  candlesKey?: string
  /** Adverse (squeeze) path, selectable. Default 'gme_squeeze_2021'. */
  adverseKey?: string
  /** Default shares. */
  shares?: number
  /** Annual borrow rate (example). Default 0.30 (hard-to-borrow). */
  rate?: number
}

/**
 * M14 INTERACTIVE — "Manage a Live Short".
 * Real price path reveals day-by-day; a borrow meter ticks (cumulative fee), a margin
 * gauge tracks equity vs maintenance, and learner-placed STOP (buy-to-cover) / TARGET
 * lines fire when hit. The adverse path can margin-call / recall you. Net P&L = gross −
 * cumulative borrow (exact). Drag the dashed STOP/TARGET lines; pick the path; Run.
 */
export default class ManageShortScene extends ModuleScene {
  private candlesKey = 'short_winner_PTON'
  private adverseKey = 'gme_squeeze_2021'
  private shares = 100
  private rate = 0.3

  private candles: Candle[] = []
  private usingAdverse = false

  private plot = { l: 60, r: 560, t: 70, b: 300 }
  private pmin = 0
  private pmax = 1
  private entry = 0
  private day = 0
  private running = false
  private closed = false
  private cumBorrow = 0

  private chartG!: Phaser.GameObjects.Graphics
  private stopLine!: { line: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; price: number }
  private targetLine!: { line: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; price: number }

  private dayText!: Phaser.GameObjects.Text
  private grossText!: Phaser.GameObjects.Text
  private borrowText!: Phaser.GameObjects.Text
  private netText!: Phaser.GameObjects.Text
  private marginText!: Phaser.GameObjects.Text
  private pathBtnLabel!: Phaser.GameObjects.Text

  protected build(): void {
    const p = this.params as ManageShortParams
    this.candlesKey = p.candlesKey ?? 'short_winner_PTON'
    this.adverseKey = p.adverseKey ?? 'gme_squeeze_2021'
    this.shares = p.shares ?? 100
    this.rate = p.rate ?? 0.3

    this.label(this.W / 2, 20, 'Manage a live short', { size: 16, bold: true, col: C.ink, align: 'center' })
    this.label(this.W / 2, 38, 'real price path · illustrative fee/margin overlays', { size: 11, col: C.muted, align: 'center' })

    this.loadPath(this.candlesKey)
    this.buildOverlays()
    this.emitReady()
  }

  private loadPath(key: string): void {
    this.candles = CANDLES[key] ?? []
    if (this.candles.length === 0) {
      this.label(this.W / 2, this.H / 2, 'No chart data', { align: 'center', col: C.muted })
      return
    }
    let lo = Infinity
    let hi = -Infinity
    for (const c of this.candles) {
      lo = Math.min(lo, c.l)
      hi = Math.max(hi, c.h)
    }
    const pad = (hi - lo) * 0.08
    this.pmin = lo - pad
    this.pmax = hi + pad
    this.entry = this.candles[0].c
  }

  private xForDay(d: number): number {
    return this.plot.l + (d / this.candles.length) * (this.plot.r - this.plot.l) + (this.plot.r - this.plot.l) / this.candles.length / 2
  }
  private yForPrice(pr: number): number {
    const t = (pr - this.pmin) / (this.pmax - this.pmin)
    return this.plot.b - t * (this.plot.b - this.plot.t)
  }

  private buildOverlays(): void {
    // axis
    const ax = this.add.graphics()
    ax.lineStyle(1, C.hairline)
    ax.lineBetween(this.plot.l, this.plot.b, this.plot.r, this.plot.b)
    this.chartG = this.add.graphics()

    // entry line
    const ey = this.yForPrice(this.entry)
    this.dashedLine(this.plot.l, ey, this.plot.r, C.muted, 5, 4, 1)
    this.label(this.plot.l + 4, ey - 10, `Entry (short) $${this.entry.toFixed(2)}`, { size: 11, bold: true, col: C.ink })

    // STOP line (buy-to-cover) above entry; TARGET below entry
    this.stopLine = this.makeOrderLine(this.entry * 1.4, C.red, 'STOP (cover)')
    this.targetLine = this.makeOrderLine(this.entry * 0.6, C.green, 'TARGET (cover)')

    // readouts panel
    this.panel(580, 70, 175, 170, { fill: C.gray100, stroke: C.hairline, radius: 10 })
    this.dayText = this.label(592, 90, '', { size: 12, col: C.ink })
    this.grossText = this.label(592, 116, '', { size: 12, bold: true, col: C.green })
    this.borrowText = this.label(592, 142, '', { size: 12, col: C.red })
    this.netText = this.label(592, 172, '', { size: 16, bold: true, col: C.green })
    this.label(592, 196, 'net = gross − borrow', { size: 10, col: C.muted })
    this.marginText = this.label(592, 220, '', { size: 11, col: C.muted })

    // controls
    this.label(60, 330, `Shares: ${this.shares}`, { size: 12, bold: true, col: C.ink })
    this.button(170, 332, 'Run path →', () => this.run(), { w: 120, h: 30 })

    // path toggle
    const bw = 230
    const bh = 30
    const bg = this.add.graphics()
    bg.fillStyle(C.blueSoft, 1)
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8)
    this.pathBtnLabel = this.add
      .text(0, 0, 'Path: PTON 2021–22 (trending)', { fontFamily: FONT, fontSize: '12px', color: hex(C.blue), fontStyle: 'bold' })
      .setOrigin(0.5)
    const tog = this.add.container(430, 332, [bg, this.pathBtnLabel])
    tog.setSize(bw, bh)
    tog.setInteractive({ useHandCursor: true })
    tog.on('pointerup', () => this.togglePath())

    this.label(60, 360, 'Drag the dashed STOP (above) and TARGET (below) lines, choose a path, then Run.', {
      size: 11,
      col: C.muted,
    })

    this.refresh()
  }

  private makeOrderLine(price: number, c: number, tag: string): { line: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; price: number } {
    const y = this.yForPrice(price)
    const line = this.dashedLine(this.plot.l, y, this.plot.r, c, 7, 5, 1.5)
    const knob = this.add.circle(this.plot.r, y, 8, c).setStrokeStyle(2, C.white)
    const label = this.label(this.plot.l + 4, y - 10, `${tag} $${price.toFixed(2)}`, { size: 11, bold: true, col: c })
    const obj = { line, knob, label, price }
    knob.setInteractive({ useHandCursor: true, draggable: true })
    this.input.setDraggable(knob)
    knob.on('drag', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
      if (this.running) return
      const ny = Math.max(this.plot.t, Math.min(this.plot.b, dy))
      const t = (this.plot.b - ny) / (this.plot.b - this.plot.t)
      const np = this.pmin + t * (this.pmax - this.pmin)
      obj.price = np
      this.redrawOrderLine(obj, c, tag)
    })
    return obj
  }

  private redrawOrderLine(obj: { line: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; price: number }, c: number, tag: string): void {
    const y = this.yForPrice(obj.price)
    obj.line.clear()
    obj.line.lineStyle(1.5, c)
    for (let x = this.plot.l; x < this.plot.r; x += 12) obj.line.lineBetween(x, y, Math.min(x + 7, this.plot.r), y)
    obj.knob.y = y
    obj.label.setY(y - 10)
    obj.label.setText(`${tag} $${obj.price.toFixed(2)}`)
  }

  private togglePath(): void {
    if (this.running) return
    this.usingAdverse = !this.usingAdverse
    this.loadPath(this.usingAdverse ? this.adverseKey : this.candlesKey)
    this.pathBtnLabel.setText(this.usingAdverse ? 'Path: GME 2021 (adverse)' : 'Path: PTON 2021–22 (trending)')
    // reset
    this.day = 0
    this.cumBorrow = 0
    this.closed = false
    this.chartG.clear()
    this.redrawOrderLine(this.stopLine, C.red, 'STOP (cover)')
    this.redrawOrderLine(this.targetLine, C.green, 'TARGET (cover)')
    this.refresh()
  }

  private dailyFee(price: number): number {
    return (price * this.shares * this.rate) / 365
  }

  private gross(price: number): number {
    return (this.entry - price) * this.shares
  }

  private run(): void {
    if (this.running || this.candles.length === 0) return
    this.running = true
    const tick = () => {
      if (this.day >= this.candles.length || this.closed) {
        this.running = false
        if (!this.closed) this.closeAt(this.candles[this.candles.length - 1].c, 'WINDOW END', C.blue)
        return
      }
      const c = this.candles[this.day]
      this.drawCandle(this.day)
      this.cumBorrow += this.dailyFee(c.c)
      this.day++
      this.refresh(c.c)

      // recall on adverse path
      if (this.usingAdverse && this.day === Math.floor(this.candles.length * 0.55)) {
        this.toast('Lender RECALL — forced to cover', C.blue)
        this.closeAt(c.c, 'RECALL COVER', C.blue)
        this.running = false
        return
      }
      // STOP hit (candle high ≥ stop)
      if (!this.closed && c.h >= this.stopLine.price && this.stopLine.price > this.entry) {
        this.closeAt(this.stopLine.price, 'STOP HIT', C.red)
        this.running = false
        return
      }
      // TARGET hit (candle low ≤ target)
      if (!this.closed && c.l <= this.targetLine.price && this.targetLine.price < this.entry) {
        this.closeAt(this.targetLine.price, 'TARGET HIT', C.green)
        this.running = false
        return
      }
      this.time.delayedCall(60, tick)
    }
    tick()
  }

  private drawCandle(i: number): void {
    const c = this.candles[i]
    const up = c.c >= c.o
    const col = up ? C.green : C.red
    const x = this.xForDay(i)
    const bw = Math.max(1.5, ((this.plot.r - this.plot.l) / this.candles.length) * 0.6)
    this.chartG.lineStyle(1, col, 1)
    this.chartG.lineBetween(x, this.yForPrice(c.h), x, this.yForPrice(c.l))
    const yo = this.yForPrice(c.o)
    const yc = this.yForPrice(c.c)
    this.chartG.fillStyle(col, 1)
    this.chartG.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1.5, Math.abs(yc - yo)))
  }

  private closeAt(price: number, tag: string, c: number): void {
    this.closed = true
    const x = this.xForDay(Math.min(this.day, this.candles.length - 1))
    const y = this.yForPrice(price)
    this.add.circle(x, y, 6, c).setStrokeStyle(2, C.white)
    this.fadeIn(this.label(x, y - 16, tag, { size: 11, bold: true, col: c, align: 'center' }))
    this.refresh(price)
  }

  private refresh(price?: number): void {
    const px = price ?? (this.candles[Math.max(0, this.day - 1)]?.c ?? this.entry)
    const gross = this.gross(px)
    const net = gross - this.cumBorrow
    this.dayText.setText(`Day ${this.day}/${this.candles.length} · $${px.toFixed(2)}`)
    this.grossText.setText(`Gross ${gross >= 0 ? '+' : '−'}$${Math.abs(gross).toFixed(0)}`)
    this.grossText.setColor(hex(color(gross >= 0 ? C.green : C.red)))
    this.borrowText.setText(`Borrow − $${this.cumBorrow.toFixed(0)}`)
    this.netText.setText(`NET ${net >= 0 ? '+' : '−'}$${Math.abs(net).toFixed(0)}`)
    this.netText.setColor(hex(color(net >= 0 ? C.green : C.red)))
    // simple margin proxy: equity vs 30% maintenance
    const proceeds = this.entry * this.shares
    const equity = proceeds * 0.5 + proceeds - px * this.shares
    const maint = 0.3 * px * this.shares
    this.marginText.setText(`Equity $${equity.toFixed(0)} vs maint $${maint.toFixed(0)}${equity < maint ? ' ⚠ CALL' : ''}`)
    this.marginText.setColor(hex(color(equity < maint ? C.red : C.muted)))
  }

  private toast(text: string, c: number): void {
    const t = this.label(this.W / 2, 56, text, { size: 12, bold: true, col: c, align: 'center' })
    this.fadeIn(t)
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 600 })
  }
}
