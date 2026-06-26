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
  private stopLine!: { line: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; chip: Phaser.GameObjects.Graphics; price: number }
  private targetLine!: { line: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; chip: Phaser.GameObjects.Graphics; price: number }
  private toastText!: Phaser.GameObjects.Text
  private toastChip!: Phaser.GameObjects.Graphics
  private entryG!: Phaser.GameObjects.Graphics
  private entryChip!: Phaser.GameObjects.Graphics
  private entryLabel!: Phaser.GameObjects.Text

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

    this.label(this.W / 2, 16, 'Real chart — fees and margin shown for practice', { size: 12, col: C.muted, align: 'center' })

    // Single persistent toast (recall / window-end messages reuse it — never stacks).
    this.toastChip = this.add.graphics().setAlpha(0)
    this.toastText = this.label(this.W / 2, 56, '', { size: 12, bold: true, col: C.blue, align: 'center' })
    this.toastText.setAlpha(0)
    this.children.moveBelow(this.toastChip, this.toastText)

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

    // entry line (redrawable so it re-seats when the path — and thus entry — changes)
    this.entryG = this.add.graphics()
    this.entryChip = this.add.graphics()
    this.entryLabel = this.label(this.plot.l + 4, 0, '', { size: 12, bold: true, col: C.ink })
    this.children.moveBelow(this.entryChip, this.entryLabel)
    this.drawEntryLine()

    // STOP line (buy-to-cover) above entry; TARGET below entry. Clamp the initial
    // placement INTO the visible price band so the dashed lines + labels start on-chart
    // (a fixed entry×1.4 can otherwise land above pmax and render above the plot).
    const { stop0, target0 } = this.defaultOrders()
    this.stopLine = this.makeOrderLine(stop0, C.red, 'STOP (cover)')
    this.targetLine = this.makeOrderLine(target0, C.green, 'TARGET (cover)')

    // readouts panel
    this.panel(580, 70, 175, 184, { fill: C.gray100, stroke: C.hairline, radius: 10 })
    this.dayText = this.label(592, 88, '', { size: 12, col: C.ink })
    this.grossText = this.label(592, 112, '', { size: 12, bold: true, col: C.green })
    this.borrowText = this.label(592, 136, '', { size: 12, col: C.red })
    this.netText = this.label(592, 164, '', { size: 16, bold: true, col: C.green })
    this.label(592, 186, 'net = gross − borrow', { size: 12, col: C.muted })
    this.marginText = this.label(592, 212, '', { size: 12, col: C.muted })
    this.marginText.setWordWrapWidth(160)

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
      .text(0, 0, 'Path: PTON (keeps falling)', { fontFamily: FONT, fontSize: '12px', color: hex(C.blue), fontStyle: 'bold' })
      .setOrigin(0.5)
    const tog = this.add.container(430, 332, [bg, this.pathBtnLabel])
    tog.setSize(bw, bh)
    tog.setInteractive({ useHandCursor: true })
    tog.on('pointerup', () => this.togglePath())

    this.label(60, 362, 'Drag the STOP (above) and TARGET (below), pick a path, then Run.', {
      size: 12,
      col: C.muted,
    })

    this.refresh()
  }

  private makeOrderLine(price: number, c: number, tag: string): { line: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; chip: Phaser.GameObjects.Graphics; price: number } {
    const y = this.yForPrice(price)
    const line = this.dashedLine(this.plot.l, y, this.plot.r, c, 7, 5, 1.5)
    const chip = this.add.graphics()
    const knob = this.add.circle(this.plot.r, y, 8, c).setStrokeStyle(2, C.white)
    // Label rides on the RIGHT next to its knob so it never collides with the
    // left-anchored "Entry (short)" label when the order sits close to entry.
    const label = this.label(this.plot.r - 16, y - 11, `${tag} $${price.toFixed(2)}`, { size: 12, bold: true, col: c, align: 'right' })
    this.children.moveBelow(chip, label)
    const obj = { line, knob, label, chip, price }
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
    this.redrawOrderLine(obj, c, tag)
    return obj
  }

  private redrawOrderLine(obj: { line: Phaser.GameObjects.Graphics; knob: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; chip: Phaser.GameObjects.Graphics; price: number }, c: number, tag: string): void {
    const y = this.yForPrice(obj.price)
    obj.line.clear()
    obj.line.lineStyle(1.5, c)
    for (let x = this.plot.l; x < this.plot.r; x += 12) obj.line.lineBetween(x, y, Math.min(x + 7, this.plot.r), y)
    obj.knob.y = y
    obj.label.setY(y - 11)
    obj.label.setText(`${tag} $${obj.price.toFixed(2)}`)
    // chip behind the moving STOP/TARGET label so it reads over the candles + entry
    // line. Label is right-aligned (origin x = 1), so its left edge = x − width.
    const padX = 5
    const padY = 2
    obj.chip.clear()
    obj.chip.fillStyle(C.white, 0.9)
    obj.chip.fillRoundedRect(
      obj.label.x - obj.label.width - padX,
      obj.label.y - obj.label.height / 2 - padY,
      obj.label.width + padX * 2,
      obj.label.height + padY * 2,
      4,
    )
  }

  private drawEntryLine(): void {
    const ey = this.yForPrice(this.entry)
    this.entryG.clear()
    this.entryG.lineStyle(1, C.muted)
    for (let x = this.plot.l; x < this.plot.r; x += 9) this.entryG.lineBetween(x, ey, Math.min(x + 5, this.plot.r), ey)
    this.entryLabel.setY(ey - 11)
    this.entryLabel.setText(`Entry (short) $${this.entry.toFixed(2)}`)
    const padX = 5
    const padY = 2
    this.entryChip.clear()
    this.entryChip.fillStyle(C.white, 0.9)
    this.entryChip.fillRoundedRect(
      this.entryLabel.x - padX,
      this.entryLabel.y - this.entryLabel.height / 2 - padY,
      this.entryLabel.width + padX * 2,
      this.entryLabel.height + padY * 2,
      4,
    )
  }

  /** Sensible STOP (above entry) / TARGET (below entry) defaults inside the price band. */
  private defaultOrders(): { stop0: number; target0: number } {
    return {
      stop0: Math.min(this.entry * 1.4, this.entry + (this.pmax - this.entry) * 0.7),
      target0: Math.max(this.entry * 0.6, this.entry - (this.entry - this.pmin) * 0.7),
    }
  }

  private togglePath(): void {
    if (this.running) return
    this.usingAdverse = !this.usingAdverse
    this.loadPath(this.usingAdverse ? this.adverseKey : this.candlesKey)
    this.pathBtnLabel.setText(this.usingAdverse ? 'Path: GME (squeezes up)' : 'Path: PTON (keeps falling)')
    // reset
    this.day = 0
    this.cumBorrow = 0
    this.closed = false
    this.chartG.clear()
    this.drawEntryLine()
    // Re-seat STOP/TARGET into the NEW path's price scale (entry/pmin/pmax changed), so
    // they don't keep stale prices from the previous chart (e.g. a $97 stop on a $10 GME).
    const { stop0, target0 } = this.defaultOrders()
    this.stopLine.price = stop0
    this.targetLine.price = target0
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
        this.toast('Lender recall — forced to buy back', C.blue)
        this.closeAt(c.c, 'RECALL — BOUGHT BACK', C.blue)
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
    // keep the tag inside the plot horizontally; chip so it reads over the candles
    const lx = Math.min(this.plot.r - 36, Math.max(this.plot.l + 36, x))
    this.fadeIn(this.label(lx, y - 18, tag, { size: 12, bold: true, col: c, align: 'center', bg: true }))
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
    this.marginText.setText(`Cushion $${equity.toFixed(0)} · min $${maint.toFixed(0)}${equity < maint ? '\n⚠ MARGIN CALL' : ''}`)
    this.marginText.setColor(hex(color(equity < maint ? C.red : C.muted)))
  }

  private toast(text: string, c: number): void {
    // Reuse the single persistent toast text + chip so repeated calls never stack.
    this.tweens.killTweensOf(this.toastText)
    this.tweens.killTweensOf(this.toastChip)
    this.toastText.setText(text)
    this.toastText.setColor(hex(c))
    const padX = 7
    const padY = 3
    this.toastChip.clear()
    this.toastChip.fillStyle(C.white, 0.92)
    this.toastChip.fillRoundedRect(
      this.toastText.x - this.toastText.width / 2 - padX,
      this.toastText.y - this.toastText.height / 2 - padY,
      this.toastText.width + padX * 2,
      this.toastText.height + padY * 2,
      5,
    )
    this.toastText.setAlpha(1)
    this.toastChip.setAlpha(1)
    this.tweens.add({ targets: [this.toastText, this.toastChip], alpha: 0, delay: 2200, duration: 600 })
  }
}
