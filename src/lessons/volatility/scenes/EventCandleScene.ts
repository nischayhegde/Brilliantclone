import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import {
  type Leg,
  straddle,
  strangle,
  combinedPnL,
  breakevens,
  clearedBreakeven,
  fmt,
  fmtSigned,
  fmtDollars,
} from './payoffMath'

interface EventParams {
  title?: string
  caption?: string
  interactive?: boolean
}

/**
 * Module 9 TEACH — "When You'd Use Them: Earnings & Binary Events".
 *
 * A calendar strip with an earnings flag; the price coils into the date, then an event
 * candle whips. The chosen straddle V / strangle valley overlays so the learner sees
 * profit can come from EITHER whip — as long as it clears a breakeven. Interactive:
 * choose the event type + structure + direction + size, trigger the event, read live
 * P&L. A tiny move foreshadows the IV-crush trap (module 10).
 */
export default class EventCandleScene extends ModuleScene {
  private p!: EventParams
  private anchor = 100
  private direction: 1 | -1 = 1
  private sizePct = 10
  private structure: 'straddle' | 'strangle' = 'straddle'
  private eventType = 'Earnings'

  // chart panel (left)
  private cx = 40
  private cy = 70
  private cw = 380
  private ch = 250
  private priceMin = 80
  private priceMax = 120

  // mini payoff (right)
  private vx = 470
  private vy = 70
  private vw = 250
  private vh = 250

  private coilG!: Phaser.GameObjects.Graphics
  private candleG!: Phaser.GameObjects.Graphics
  private vG!: Phaser.GameObjects.Graphics
  private armG!: Phaser.GameObjects.Graphics
  private pnlText!: Phaser.GameObjects.Text
  private badge!: Phaser.GameObjects.Text
  private badgePanel!: Phaser.GameObjects.Graphics
  private structBtns: Phaser.GameObjects.Container[] = []

  protected build(): void {
    this.p = this.params as EventParams
    if (this.p.title) this.label(20, 16, this.p.title, { size: 15, bold: true, col: C.ink })

    // chart scaffold
    this.panel(this.cx - 10, this.cy - 20, this.cw + 20, this.ch + 56, { fill: C.white, stroke: C.hairline, radius: 12 })
    this.drawCalendar()
    this.coilG = this.add.graphics()
    this.candleG = this.add.graphics()

    // payoff scaffold
    this.panel(this.vx - 10, this.vy - 20, this.vw + 20, this.vh + 40, { fill: C.white, stroke: C.hairline, radius: 12 })
    this.label(this.vx + this.vw / 2, this.vy - 8, 'payoff overlay', { size: 11, col: C.muted, align: 'center' })
    this.vG = this.add.graphics()
    this.armG = this.add.graphics()

    this.pnlText = this.label(20, this.H - 70, '', { size: 13, col: C.ink, bold: true })
    this.badgePanel = this.add.graphics()
    this.badge = this.add.text(0, 0, '', { fontFamily: '"Segoe UI", sans-serif', fontSize: '13px', color: hex(C.green), fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.drawCoil()
    this.drawPayoff()

    // Scripted intro: green up-whip then red down-whip — both light the arm green
    // (profit on EITHER whip if it clears a breakeven). Then hand off to the controls.
    this.time.delayedCall(900, () => { this.direction = 1; this.sizePct = 14; this.fireEvent() })
    this.time.delayedCall(2600, () => { this.direction = -1; this.sizePct = 14; this.fireEvent() })
    if (this.p.interactive) {
      this.time.delayedCall(3600, () => { this.direction = 1; this.sizePct = 10; this.buildControls() })
    }
    if (this.p.caption) {
      const cap = this.label(20, this.H - 18, this.p.caption, { size: 12, col: C.muted })
      cap.setWordWrapWidth(this.W - 40)
    }
    this.time.delayedCall(800, () => this.emitReady())
  }

  private legs(): Leg[] {
    return this.structure === 'straddle' ? straddle(100, 4, 3, 'long') : strangle(95, 105, 1.25, 1.75, 'long')
  }

  // --- chart helpers --------------------------------------------------------
  private pxForT(t: number): number {
    return this.cx + t * this.cw
  }
  private pyForPrice(price: number): number {
    const t = (price - this.priceMin) / (this.priceMax - this.priceMin)
    return this.cy + this.ch - t * this.ch
  }

  private drawCalendar(): void {
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline)
    g.lineBetween(this.cx, this.cy + this.ch + 14, this.cx + this.cw, this.cy + this.ch + 14)
    // earnings flag near the right
    const fx = this.pxForT(0.72)
    g.lineStyle(2, C.blue)
    g.lineBetween(fx, this.cy, fx, this.cy + this.ch + 14)
    this.add.triangle(fx + 18, this.cy + 6, 0, 0, 0, 18, 22, 9, C.blue).setOrigin(0.5)
    this.label(fx + 8, this.cy - 10, 'earnings', { size: 11, col: C.blue, bold: true })
  }

  private drawCoil(): void {
    this.coilG.clear()
    this.coilG.lineStyle(2.5, C.blue, 1)
    this.coilG.beginPath()
    const segs = 50
    const flagT = 0.72
    this.coilG.moveTo(this.pxForT(0), this.pyForPrice(this.anchor))
    for (let i = 1; i <= segs; i++) {
      const t = (i / segs) * flagT
      const amp = 8 * (1 - i / segs) // amplitude shrinks toward the flag (coiling)
      const price = this.anchor + Math.sin(i * 0.8) * amp
      this.coilG.lineTo(this.pxForT(t), this.pyForPrice(price))
    }
    this.coilG.strokePath()
  }

  private fireEvent(): void {
    this.candleG.clear()
    const flagT = 0.72
    const newPrice = this.anchor * (1 + (this.direction * this.sizePct) / 100)
    const x0 = this.pxForT(flagT)
    const x1 = this.pxForT(0.9)
    const up = this.direction > 0
    const col = up ? C.green : C.red
    // gap candle from anchor to newPrice
    const bodyTop = this.pyForPrice(Math.max(this.anchor, newPrice))
    const bodyBot = this.pyForPrice(Math.min(this.anchor, newPrice))
    this.candleG.fillStyle(col, 0.9)
    this.candleG.fillRect((x0 + x1) / 2 - 8, bodyTop, 16, Math.max(2, bodyBot - bodyTop))
    this.candleG.lineStyle(2, col, 1)
    this.candleG.lineBetween((x0 + x1) / 2, this.pyForPrice(newPrice) - 6, (x0 + x1) / 2, this.pyForPrice(newPrice) + 6)
    // connector from coil end to candle
    this.candleG.lineStyle(2, col, 0.6)
    this.candleG.lineBetween(this.pxForT(flagT), this.pyForPrice(this.anchor), (x0 + x1) / 2, this.pyForPrice(newPrice))

    this.lightArm(newPrice)
    this.updateReadout(newPrice)
  }

  // --- payoff overlay -------------------------------------------------------
  private vxFor(price: number): number {
    return this.vx + ((price - 80) / 40) * this.vw
  }
  private vyFor(pnl: number): number {
    const span = 14
    return this.vy + this.vh - ((pnl + span) / (2 * span)) * this.vh
  }

  private drawPayoff(): void {
    this.vG.clear()
    const legs = this.legs()
    const be = breakevens(legs)
    const y0 = this.vyFor(0)
    this.vG.lineStyle(1.5, C.blue, 0.6)
    this.vG.lineBetween(this.vx, y0, this.vx + this.vw, y0)
    for (const px of [...new Set(legs.map((l) => l.K)), be.lower, be.upper]) {
      const x = this.vxFor(px)
      this.dashV(this.vG, x, this.vy, this.vy + this.vh, C.blue, 0.7)
    }
    this.label(this.vxFor(be.lower), this.vy + this.vh + 4, fmt(be.lower), { size: 10, col: C.blue, align: 'center' })
    this.label(this.vxFor(be.upper), this.vy + this.vh + 4, fmt(be.upper), { size: 10, col: C.blue, align: 'center' })
    // curve
    this.vG.lineStyle(3, C.green, 1)
    this.vG.beginPath()
    let first = true
    for (let px = 80; px <= 120; px += 0.5) {
      const sy = this.vyFor(Math.max(-14, Math.min(14, combinedPnL(legs, px))))
      const sx = this.vxFor(px)
      if (first) { this.vG.moveTo(sx, sy); first = false } else this.vG.lineTo(sx, sy)
    }
    this.vG.strokePath()
  }

  private lightArm(S: number): void {
    this.armG.clear()
    const legs = this.legs()
    const Sc = Phaser.Math.Clamp(S, 80, 120)
    const pnl = combinedPnL(legs, Sc)
    const cleared = clearedBreakeven(legs, Sc)
    const col = cleared ? C.green : C.red
    const dotx = this.vxFor(Sc)
    const doty = this.vyFor(Math.max(-14, Math.min(14, pnl)))
    this.armG.fillStyle(col, 1)
    this.armG.fillCircle(dotx, doty, 7)
    this.armG.lineStyle(2, C.white, 1)
    this.armG.strokeCircle(dotx, doty, 7)
  }

  private updateReadout(S: number): void {
    const legs = this.legs()
    const pnl = combinedPnL(legs, S)
    const cleared = clearedBreakeven(legs, S)
    this.pnlText.setText(
      `${this.eventType} · ${this.structure} · S = ${fmt(S)}   →   P&L ${fmtSigned(pnl)} (${fmtDollars(pnl)})`,
    )
    const text = cleared ? 'cleared a breakeven → profit' : 'small move — did not clear a breakeven (see next module)'
    const col = cleared ? C.green : C.red
    this.badge.setText(text).setColor(hex(col))
    this.badge.setPosition(24, this.H - 44)
    this.badgePanel.clear()
    this.badgePanel.fillStyle(cleared ? C.greenSoft : C.redSoft, 1)
    this.badgePanel.fillRoundedRect(18, this.H - 44 - 12, this.badge.width + 12, 24, 8)
    this.children.bringToTop(this.badge)
  }

  // --- interactive controls -------------------------------------------------
  private buildControls(): void {
    // event-type picker
    const types = ['Earnings', 'FDA decision', 'Court ruling']
    types.forEach((t, i) => {
      this.button(this.cx + 30 + i * 120, this.cy + this.ch + 40, t, () => {
        this.eventType = t
      }, { w: 110, h: 26, fill: C.blueSoft, textCol: C.blue })
    })

    // structure toggle
    const sx = this.vx + 30
    this.structBtns = [
      this.button(sx, this.vy + this.vh + 30, 'Straddle', () => this.setStructure('straddle'), { w: 100, h: 28 }),
      this.button(sx + 120, this.vy + this.vh + 30, 'Strangle', () => this.setStructure('strangle'), { w: 100, h: 28, fill: C.gray200, textCol: C.ink }),
    ]

    // direction toggle + size dial + trigger
    const ctrlY = this.H - 96
    const dirBtn = this.button(120, ctrlY, 'Direction: UP ↑', () => {
      this.direction = (this.direction === 1 ? -1 : 1) as 1 | -1
      dirBtn.list.forEach((o) => {
        if (o instanceof Phaser.GameObjects.Text) o.setText(this.direction === 1 ? 'Direction: UP ↑' : 'Direction: DOWN ↓')
      })
    }, { w: 170, h: 28 })

    const sizeText = this.label(300, ctrlY - 22, '', { size: 11, col: C.ink, bold: true })
    sizeText.setText(`move size: ${fmt(this.sizePct)}%`)
    this.slider(300, ctrlY, 160, 1, 20, this.sizePct, (v) => {
      this.sizePct = v
      sizeText.setText(`move size: ${fmt(this.sizePct)}%`)
    }, { step: 1 })

    this.button(560, ctrlY, 'Trigger event', () => this.fireEvent(), { w: 150, h: 30, fill: C.green })
  }

  private setStructure(s: 'straddle' | 'strangle'): void {
    this.structure = s
    this.drawPayoff()
    this.armG.clear()
    // highlight active button
    this.structBtns.forEach((b, i) => {
      const active = (i === 0) === (s === 'straddle')
      const g = b.list[0] as Phaser.GameObjects.Graphics
      g.clear()
      g.fillStyle(active ? C.blue : C.gray200, 1)
      g.fillRoundedRect(-50, -14, 100, 28, 10)
      const t = b.list[1] as Phaser.GameObjects.Text
      t.setColor(hex(active ? C.white : C.ink))
    })
  }

  private dashV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += 9) g.lineBetween(x, y, x, Math.min(y + 5, y2))
  }
}
