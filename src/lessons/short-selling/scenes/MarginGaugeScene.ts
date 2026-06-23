import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, color } from '../../../engine/palette'

interface MarginGaugeParams {
  shares?: number // 100
  entry?: number // 30 (short proceeds = entry*shares)
  /** Starting account equity (your cash margin). Default $1,500 (Reg-T +50%). */
  startEquity?: number
  /** Maintenance fraction of current position value. Default 0.30. */
  maintFrac?: number
  /** Adverse rising path end price. Default $48 (a +60% move). */
  peakPrice?: number
}

/**
 * M7 TEACH/INTERACTIVE — "Margin Calls & Forced Buy-In".
 * A rising (adverse) price path advances; equity erodes toward a maintenance line. On
 * breach a MARGIN CALL flashes; at the call the learner picks Add cash / Cover / Do
 * nothing (→ forced buy-in). A scripted lender RECALL toast also forces a cover.
 * Mechanics exact: equity = startEquity + proceeds − price·shares; maint = maintFrac·price·shares.
 */
export default class MarginGaugeScene extends ModuleScene {
  private shares = 100
  private entry = 30
  private startEquity = 1500
  private maintFrac = 0.3
  private peakPrice = 48

  private proceeds = 3000
  private day = 0
  private days = 28
  private price = 30
  private called = false
  private resolved = false
  private running = false

  private equityBar!: Phaser.GameObjects.Graphics
  private gaugeX = 70
  private gaugeY = 90
  private gaugeW = 90
  private gaugeH = 230
  private maxEquity = 4000

  private priceG!: Phaser.GameObjects.Graphics
  private plot = { l: 200, r: 560, t: 90, b: 320 }
  private banner?: Phaser.GameObjects.Container
  private choiceBtns: Phaser.GameObjects.Container[] = []

  private priceText!: Phaser.GameObjects.Text
  private pnlText!: Phaser.GameObjects.Text
  private equityText!: Phaser.GameObjects.Text
  private maintText!: Phaser.GameObjects.Text

  protected build(): void {
    const p = this.params as MarginGaugeParams
    this.shares = p.shares ?? 100
    this.entry = p.entry ?? 30
    this.startEquity = p.startEquity ?? 1500
    this.maintFrac = p.maintFrac ?? 0.3
    this.peakPrice = p.peakPrice ?? 48
    this.proceeds = this.entry * this.shares
    this.price = this.entry

    this.label(this.W / 2, 22, 'Margin calls & forced buy-in', { size: 16, bold: true, col: C.ink, align: 'center' })
    this.label(this.W / 2, 40, 'illustrative simulation · mechanics exact', { size: 11, col: C.muted, align: 'center' })

    // Equity gauge frame + maintenance line
    this.label(this.gaugeX + this.gaugeW / 2, this.gaugeY - 14, 'Equity', { size: 12, bold: true, col: C.muted, align: 'center' })
    const frame = this.add.graphics()
    frame.lineStyle(1.5, C.hairline)
    frame.strokeRoundedRect(this.gaugeX, this.gaugeY, this.gaugeW, this.gaugeH, 8)
    this.equityBar = this.add.graphics()

    // price-path axis
    const ax = this.add.graphics()
    ax.lineStyle(1, C.hairline)
    ax.lineBetween(this.plot.l, this.plot.b, this.plot.r, this.plot.b)
    this.priceG = this.add.graphics()

    // readouts
    this.priceText = this.label(200, 336, '', { size: 12, col: C.ink })
    this.pnlText = this.label(200, 356, '', { size: 12, bold: true, col: C.red })
    this.equityText = this.label(400, 336, '', { size: 12, col: C.ink })
    this.maintText = this.label(400, 356, '', { size: 12, col: C.muted })

    // starting-equity slider
    this.label(70, 350, 'Starting equity', { size: 12, bold: true, col: C.ink })
    this.slider(70, 372, 110, 500, 3000, this.startEquity, (v) => {
      if (this.running) return
      this.startEquity = Math.round(v / 50) * 50
      this.update0()
    }, { step: 50, col: C.blue })

    // run button
    this.button(620, 110, 'Run path', () => this.run(), { w: 110, h: 34 })

    this.update0()
    this.emitReady()
  }

  // current values at this.price
  private equity(): number {
    // equity = posted cash + (proceeds − cost to cover now)
    return this.startEquity + this.proceeds - this.price * this.shares
  }
  private maintenance(): number {
    return this.maintFrac * this.price * this.shares
  }
  private unrealized(): number {
    return (this.entry - this.price) * this.shares
  }

  private update0(): void {
    this.drawEquity()
    this.refreshReadouts()
  }

  private drawEquity(): void {
    const eq = Math.max(0, this.equity())
    const maint = this.maintenance()
    this.equityBar.clear()
    const t = Math.max(0, Math.min(1, eq / this.maxEquity))
    const h = t * this.gaugeH
    const breach = eq < maint
    this.equityBar.fillStyle(breach ? C.red : C.green, 0.8)
    this.equityBar.fillRoundedRect(this.gaugeX + 4, this.gaugeY + this.gaugeH - h, this.gaugeW - 8, h, 4)
    // maintenance dashed line
    const my = this.gaugeY + this.gaugeH - Math.min(1, maint / this.maxEquity) * this.gaugeH
    this.dashedLine(this.gaugeX - 6, my, this.gaugeX + this.gaugeW + 6, C.red, 5, 4, 1.5)
  }

  private refreshReadouts(): void {
    const u = this.unrealized()
    const eq = this.equity()
    const maint = this.maintenance()
    this.priceText.setText(`Day ${this.day} · Price $${this.price.toFixed(2)}`)
    this.pnlText.setText(`Unrealized P&L: ${u >= 0 ? '+' : '−'}$${Math.abs(u).toFixed(0)}`)
    this.pnlText.setColor(hex(color(u >= 0 ? C.green : C.red)))
    this.equityText.setText(`Equity $${eq.toFixed(0)}  ·  Maint $${maint.toFixed(0)}`)
    this.maintText.setText(`Margin ratio = ${(eq / Math.max(1, maint)).toFixed(2)}× ${eq < maint ? '(BREACHED)' : ''}`)
    this.maintText.setColor(hex(color(eq < maint ? C.red : C.muted)))
  }

  private xForDay(d: number): number {
    return this.plot.l + (d / this.days) * (this.plot.r - this.plot.l)
  }
  private yForPrice(pr: number): number {
    const lo = this.entry * 0.9
    const hi = this.peakPrice * 1.05
    const t = (pr - lo) / (hi - lo)
    return this.plot.b - t * (this.plot.b - this.plot.t)
  }

  private pathPrice(d: number): number {
    // deterministic rising path entry → peak with mild curve
    const t = d / this.days
    return this.entry + (this.peakPrice - this.entry) * (t * t * 0.6 + t * 0.4)
  }

  private run(): void {
    if (this.running) return
    this.running = true
    this.priceG.lineStyle(2, C.red, 0.9)
    let prevX = this.xForDay(0)
    let prevY = this.yForPrice(this.entry)
    const tick = () => {
      if (this.day >= this.days || this.resolved) return
      this.day++
      this.price = this.pathPrice(this.day)
      const x = this.xForDay(this.day)
      const y = this.yForPrice(this.price)
      this.priceG.lineBetween(prevX, prevY, x, y)
      prevX = x
      prevY = y
      this.drawEquity()
      this.refreshReadouts()

      // recall scripted at day 10 (forces a cover regardless of margin)
      if (this.day === 10 && !this.resolved) {
        this.toast('Lender RECALL — cover now', C.blue)
      }
      // margin call when equity < maintenance
      if (!this.called && this.equity() < this.maintenance()) {
        this.called = true
        this.showMarginCall()
        return // pause for the learner's choice
      }
      this.time.delayedCall(180, tick)
    }
    tick()
  }

  private showMarginCall(): void {
    this.banner = this.bannerBox('MARGIN CALL — add cash or cover', C.red)
    const y = 408
    this.choiceBtns.push(this.button(140, y, 'Add cash', () => this.choose('add'), { w: 120, h: 30, fill: C.green }))
    this.choiceBtns.push(this.button(275, y, 'Cover early', () => this.choose('cover'), { w: 120, h: 30, fill: C.blue }))
    this.choiceBtns.push(this.button(415, y, 'Do nothing', () => this.choose('nothing'), { w: 120, h: 30, fill: C.muted }))
  }

  private choose(opt: 'add' | 'cover' | 'nothing'): void {
    this.choiceBtns.forEach((b) => b.destroy())
    this.choiceBtns = []
    this.banner?.destroy()
    if (opt === 'add') {
      this.startEquity += 1500
      this.called = false
      this.drawEquity()
      this.refreshReadouts()
      this.toast('Added cash — position survives (capital committed)', C.green)
      this.time.delayedCall(220, () => this.run())
    } else if (opt === 'cover') {
      this.resolved = true
      const loss = (this.entry - this.price) * this.shares
      this.coverMarker('COVER', C.blue)
      this.toast(`Covered at $${this.price.toFixed(2)} — locked ${loss >= 0 ? '+' : '−'}$${Math.abs(loss).toFixed(0)}`, C.blue)
    } else {
      // do nothing → continue to a forced buy-in at the worst price
      this.continueToBuyIn()
    }
  }

  private continueToBuyIn(): void {
    const tick = () => {
      if (this.day >= this.days) {
        this.forcedBuyIn()
        return
      }
      this.day++
      this.price = this.pathPrice(this.day)
      const x = this.xForDay(this.day)
      const y = this.yForPrice(this.price)
      this.priceG.lineStyle(2, C.red, 0.9)
      this.priceG.lineBetween(this.xForDay(this.day - 1), this.yForPrice(this.pathPrice(this.day - 1)), x, y)
      this.drawEquity()
      this.refreshReadouts()
      this.time.delayedCall(150, tick)
    }
    tick()
  }

  private forcedBuyIn(): void {
    this.resolved = true
    const loss = (this.entry - this.price) * this.shares
    this.coverMarker('FORCED BUY-IN', C.red)
    this.toast(`Forced buy-in at $${this.price.toFixed(2)} — locked −$${Math.abs(loss).toFixed(0)} (worst price)`, C.red)
  }

  private coverMarker(text: string, c: number): void {
    const x = this.xForDay(this.day)
    const y = this.yForPrice(this.price)
    this.add.circle(x, y, 6, c).setStrokeStyle(2, C.white)
    this.fadeIn(this.label(x, y - 16, text, { size: 11, bold: true, col: c, align: 'center' }))
  }

  private bannerBox(text: string, c: number): Phaser.GameObjects.Container {
    const w = 320
    const x = this.plot.l + (this.plot.r - this.plot.l) / 2 - w / 2
    const panel = this.panel(x, this.plot.t + 4, w, 30, { fill: C.redSoft, stroke: c, radius: 8 })
    const t = this.label(x + w / 2, this.plot.t + 19, text, { size: 13, bold: true, col: c, align: 'center' })
    const cont = this.add.container(0, 0, [panel, t])
    this.tweens.add({ targets: cont, alpha: { from: 0.3, to: 1 }, duration: 360, yoyo: true, repeat: 3 })
    return cont
  }

  private toast(text: string, c: number): void {
    const t = this.label(this.W / 2, 70, text, { size: 12, bold: true, col: c, align: 'center' })
    this.fadeIn(t)
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 600 })
  }
}
