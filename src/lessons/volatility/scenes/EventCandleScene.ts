import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'
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
  /** Last realized price shown (so a structure switch can re-light the dot + readout
   *  consistently instead of leaving stale numbers from the previous structure). */
  private lastS = 100

  // chart panel (left) — heights trimmed so a clean full-width control strip fits
  // below both panels (the old 250-tall panels left every control stacked in a ~40px
  // band at the bottom).
  private cx = 40
  private cy = 50
  private cw = 372
  private ch = 172
  private priceMin = 80
  private priceMax = 120

  // mini payoff (right)
  private vx = 460
  private vy = 50
  private vw = 270
  private vh = 172

  private coilG!: Phaser.GameObjects.Graphics
  private candleG!: Phaser.GameObjects.Graphics
  private vG!: Phaser.GameObjects.Graphics
  private armG!: Phaser.GameObjects.Graphics
  /** Persistent payoff breakeven labels (lower, upper) — created once, repositioned. */
  private beLabelLo!: Phaser.GameObjects.Text
  private beLabelHi!: Phaser.GameObjects.Text
  private pnlText!: Phaser.GameObjects.Text
  private badge!: Phaser.GameObjects.Text
  private badgePanel!: Phaser.GameObjects.Graphics
  private structBtns: Phaser.GameObjects.Container[] = []

  protected build(): void {
    this.p = this.params as EventParams
    if (this.p.title) this.label(20, 16, this.p.title, { size: this.fs(15, 14, 18), bold: true, col: C.ink })

    // chart scaffold
    this.panel(this.cx - 10, this.cy - 20, this.cw + 20, this.ch + 56, { fill: C.white, stroke: C.hairline, radius: 12 })
    this.drawCalendar()
    this.coilG = this.add.graphics()
    this.candleG = this.add.graphics()

    // payoff scaffold
    this.panel(this.vx - 10, this.vy - 20, this.vw + 20, this.vh + 40, { fill: C.white, stroke: C.hairline, radius: 12 })
    this.label(this.vx + this.vw / 2, this.vy - 8, 'your payoff', { size: this.fs(12, 12, 15), col: C.muted, align: 'center' })
    this.vG = this.add.graphics()
    this.armG = this.add.graphics()
    // persistent breakeven axis labels (repositioned in drawPayoff; never re-added)
    this.beLabelLo = this.label(0, this.vy + this.vh + 6, '', { size: this.fs(12, 12, 15), col: C.blueDark, align: 'center' })
    this.beLabelHi = this.label(0, this.vy + this.vh + 6, '', { size: this.fs(12, 12, 15), col: C.blueDark, align: 'center' })

    // live readout + verdict badge, in the clean strip just below the panels
    this.pnlText = this.label(24, 280, '', { size: this.fs(13, 12, 16), col: C.ink, bold: true })
    this.badgePanel = this.add.graphics()
    this.badge = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${this.fs(13, 12, 16)}px`, color: hex(C.greenText), fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.drawCoil()
    this.drawPayoff()
    this.lightArm(this.anchor)
    this.updateReadout(this.anchor)

    // Controls are built immediately (never gated behind the intro animation) so the
    // module is usable even under reduced motion or when the tab is backgrounded.
    if (this.p.interactive) this.buildControls()

    if (this.reduceMotion) {
      // No timed sequence: show one representative up-whip so the lit arm + payoff read.
      this.fireEvent(1, 14)
    } else {
      // Gentle demo: green up-whip then red down-whip (profit on EITHER whip that clears
      // a breakeven), then settle back to the learner's defaults (up, 10%).
      this.time.delayedCall(900, () => this.fireEvent(1, 14))
      this.time.delayedCall(2600, () => this.fireEvent(-1, 14))
      this.time.delayedCall(3600, () => this.fireEvent(1, 10))
    }

    if (this.p.caption) {
      const cap = this.label(24, this.H - 16, this.p.caption, { size: this.fs(12, 12, 15), col: C.muted })
      cap.setWordWrapWidth(this.W - 48)
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
    this.label(fx + 8, this.cy - 10, 'earnings', { size: this.fs(12, 12, 15), col: C.blueDark, bold: true, bg: true })
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

  /**
   * Draw the event candle for a given direction/size. Defaults to the learner's current
   * state (driven by the controls); the scripted intro passes explicit values so it can
   * demo a whip WITHOUT clobbering the learner's selected direction/size.
   */
  private fireEvent(direction: 1 | -1 = this.direction, sizePct: number = this.sizePct): void {
    this.candleG.clear()
    const flagT = 0.72
    const newPrice = this.anchor * (1 + (direction * sizePct) / 100)
    const x0 = this.pxForT(flagT)
    const x1 = this.pxForT(0.9)
    const up = direction > 0
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

    this.lastS = newPrice
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
    this.beLabelLo.setText(fmt(be.lower)).setPosition(this.vxFor(be.lower), this.vy + this.vh + 6)
    this.beLabelHi.setText(fmt(be.upper)).setPosition(this.vxFor(be.upper), this.vy + this.vh + 6)
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
      `${this.structure} · stock ${fmt(S)}  →  ${fmtSigned(pnl)} (${fmtDollars(pnl)})`,
    )
    const text = cleared ? 'cleared a breakeven → profit' : 'small move — didn’t clear a breakeven'
    const col = cleared ? C.greenText : C.red
    const badgeY = 310
    this.badge.setText(text).setColor(hex(col))
    this.badge.setPosition(24, badgeY)
    this.badgePanel.clear()
    this.badgePanel.fillStyle(cleared ? C.greenSoft : C.redSoft, 1)
    this.badgePanel.fillRoundedRect(18, badgeY - this.badge.height / 2 - 4, this.badge.width + 12, this.badge.height + 8, 8)
    this.children.bringToTop(this.badge)
  }

  // --- interactive controls -------------------------------------------------
  /**
   * One tidy control row in the strip below the panels. (The old layout stacked an
   * event-type picker + structure toggle + direction + size + trigger into the same
   * ~40px band; they all overlapped. The event-type picker was purely cosmetic — it
   * only changed a label prefix — so it's dropped to cut clutter; the calendar flag
   * already says "earnings".)
   */
  private buildControls(): void {
    const rowY = 366
    const btnFs = this.fs(13, 13, 16)

    // structure toggle (left)
    this.structBtns = [
      this.button(72, rowY, 'Straddle', () => this.setStructure('straddle'), { w: 100, h: 30 }),
      this.button(180, rowY, 'Strangle', () => this.setStructure('strangle'), { w: 100, h: 30, fill: C.gray200, textCol: C.ink }),
    ]
    this.structBtns.forEach((b) => ((b.list[1] as Phaser.GameObjects.Text).setFontSize(btnFs)))

    // direction toggle
    const dirBtn = this.button(300, rowY, 'Direction: UP ↑', () => {
      this.direction = (this.direction === 1 ? -1 : 1) as 1 | -1
      dirBtn.list.forEach((o) => {
        if (o instanceof Phaser.GameObjects.Text) o.setText(this.direction === 1 ? 'Direction: UP ↑' : 'Direction: DOWN ↓')
      })
    }, { w: 120, h: 30 })
    ;(dirBtn.list[1] as Phaser.GameObjects.Text).setFontSize(btnFs)

    // move-size dial (amber — the live "act on me" affordance)
    const sizeText = this.label(380, rowY - 24, '', { size: this.fs(12, 12, 15), col: C.ink, bold: true })
    sizeText.setText(`move size: ${fmt(this.sizePct)}%`)
    this.slider(380, rowY, 150, 1, 20, this.sizePct, (v) => {
      this.sizePct = v
      sizeText.setText(`move size: ${fmt(this.sizePct)}%`)
    }, { step: 1, col: C.amber })

    // trigger (right)
    const trig = this.button(640, rowY, 'Trigger move', () => this.fireEvent(), { w: 130, h: 32, fill: C.green })
    ;(trig.list[1] as Phaser.GameObjects.Text).setFontSize(this.fs(14, 13, 17))

    // Apply the active-button highlight for the default structure so it reads as
    // selected from the start (not just after the first click).
    this.setStructure(this.structure)
  }

  private setStructure(s: 'straddle' | 'strangle'): void {
    this.structure = s
    this.drawPayoff()
    // Re-light the dot + refresh the live readout for the NEW structure at the same
    // realized price, so the chart, the P&L line, and the verdict badge never disagree
    // (previously the dot was cleared but the text kept the old structure's numbers).
    this.lightArm(this.lastS)
    this.updateReadout(this.lastS)
    // highlight active button
    this.structBtns.forEach((b, i) => {
      const active = (i === 0) === (s === 'straddle')
      const g = b.list[0] as Phaser.GameObjects.Graphics
      g.clear()
      g.fillStyle(active ? C.blue : C.gray200, 1)
      g.fillRoundedRect(-50, -15, 100, 30, 10)
      const t = b.list[1] as Phaser.GameObjects.Text
      t.setColor(hex(active ? C.white : C.ink))
    })
  }

  private dashV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += 9) g.lineBetween(x, y, x, Math.min(y + 5, y2))
  }
}
