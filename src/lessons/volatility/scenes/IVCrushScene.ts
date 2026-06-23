import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmt, fmtSigned, fmtDollars } from './payoffMath'

interface IVCrushParams {
  title?: string
  /** Total premium paid (high-IV, fat). */
  premium?: number
  /** Strike (ATM straddle). */
  K?: number
  /** Realized move as a fraction, e.g. +0.04 → S = K*(1+move). */
  move?: number
  /** Interactive sliders (module 10). */
  interactive?: boolean
  /** Quiz mask + reveal (module 11). */
  quiz?: boolean
  caption?: string
}

/**
 * IV-CRUSH scene (modules 10, 11). Premium inflates pre-event (fat "IV balloon" of
 * extrinsic value), then the extrinsic portion deflates to ~0 at the event leaving
 * only intrinsic value. The realized move is small (e.g. +4% to 104), INSIDE the
 * breakevens, so P&L = intrinsic_after − premium_paid is a LOSS even though the stock
 * moved — the lesson's core point.
 *
 *   P&L (at expiry) = max(S−K,0) + max(K−S,0) − premium   (intrinsic only; no IV term)
 */
export default class IVCrushScene extends ModuleScene {
  private p!: IVCrushParams
  private premium = 7
  private K = 100
  private move = 0.04

  // mini payoff-V panel (right)
  private vx = 470
  private vy = 70
  private vw = 270
  private vh = 240
  private vMin = 86
  private vMax = 114

  // premium bar (left)
  private barX = 120
  private barBottom = 320
  private barW = 70
  private pxPerUnit = 22

  private balloon!: Phaser.GameObjects.Arc
  private balloonLabel!: Phaser.GameObjects.Text
  private extrinsicG!: Phaser.GameObjects.Graphics
  private intrinsicG!: Phaser.GameObjects.Graphics
  private vG!: Phaser.GameObjects.Graphics
  private dot!: Phaser.GameObjects.Arc
  private ledger!: Phaser.GameObjects.Text
  private badge!: Phaser.GameObjects.Text
  private badgePanel!: Phaser.GameObjects.Graphics
  private maskG?: Phaser.GameObjects.Container
  private revealed = false
  private popped = false

  protected build(): void {
    this.p = this.params as IVCrushParams
    this.premium = this.p.premium ?? 7
    this.K = this.p.K ?? 100
    this.move = this.p.move ?? 0.04

    if (this.p.title) this.label(20, 16, this.p.title, { size: 15, bold: true, col: C.ink })

    // --- premium bar scaffolding (left) ---
    this.label(this.barX + this.barW / 2, this.barBottom + 16, 'premium', { size: 11, col: C.muted, align: 'center' })
    this.extrinsicG = this.add.graphics()
    this.intrinsicG = this.add.graphics()
    this.balloon = this.add.circle(this.barX + this.barW / 2, this.barBottom - 80, 64, C.blueSoft).setStrokeStyle(2, C.blue)
    this.balloon.setAlpha(0.5)
    this.balloonLabel = this.label(this.barX + this.barW / 2, this.barBottom - 150, 'high IV — fat premium', {
      size: 11, col: C.blue, align: 'center', bold: true,
    })

    // --- payoff V panel (right) ---
    this.drawVPanel()
    this.vG = this.add.graphics()
    this.dot = this.add.circle(0, 0, 8, C.red).setStrokeStyle(3, C.white).setVisible(false)

    // --- ledger + badge ---
    this.ledger = this.label(20, 344, '', { size: 12, col: C.ink, bold: true })
    this.badgePanel = this.add.graphics()
    this.badge = this.add.text(0, 0, '', { fontFamily: '"Segoe UI", sans-serif', fontSize: '13px', color: hex(C.red), fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.drawPremiumBar(false)
    this.drawV()

    if (this.p.quiz) {
      this.drawQuizMask()
    } else {
      // play the inflate → pop → land sequence
      this.time.delayedCall(700, () => this.popBalloon())
      this.time.delayedCall(1500, () => this.landDot())
      if (this.p.interactive) this.buildSliders()
    }
    this.time.delayedCall(800, () => this.emitReady())
  }

  private get S(): number {
    return this.K * (1 + this.move)
  }
  private get callIntrinsic(): number {
    return Math.max(this.S - this.K, 0)
  }
  private get putIntrinsic(): number {
    return Math.max(this.K - this.S, 0)
  }
  private get intrinsicTotal(): number {
    return this.callIntrinsic + this.putIntrinsic
  }
  private get pnl(): number {
    return this.intrinsicTotal - this.premium
  }

  // --- premium bar ----------------------------------------------------------
  private drawPremiumBar(crushed: boolean): void {
    this.extrinsicG.clear()
    this.intrinsicG.clear()
    const intrinsicH = this.intrinsicTotal * this.pxPerUnit
    const extrinsicH = crushed ? 0 : (this.premium - this.intrinsicTotal) * this.pxPerUnit
    // intrinsic (solid, bottom)
    this.intrinsicG.fillStyle(C.blue, 0.85)
    this.intrinsicG.fillRect(this.barX, this.barBottom - intrinsicH, this.barW, intrinsicH)
    // extrinsic (translucent, on top) — the "IV / time value"
    if (extrinsicH > 0) {
      this.extrinsicG.fillStyle(C.blue, 0.28)
      this.extrinsicG.fillRect(this.barX, this.barBottom - intrinsicH - extrinsicH, this.barW, extrinsicH)
    }
  }

  private popBalloon(): void {
    if (this.popped) return
    this.popped = true
    this.label(this.barX + this.barW / 2, this.barBottom - 150, 'IV CRUSH — extrinsic → 0', {
      size: 11, col: C.red, align: 'center', bold: true,
    }).setAlpha(0)
    this.balloonLabel.setText('IV crush!')
    // particle-ish burst
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2
      const dotp = this.add.circle(this.balloon.x, this.balloon.y, 4, C.blue, 0.7)
      this.tweens.add({
        targets: dotp,
        x: this.balloon.x + Math.cos(ang) * 60,
        y: this.balloon.y + Math.sin(ang) * 60,
        alpha: 0,
        duration: 500,
        onComplete: () => dotp.destroy(),
      })
    }
    this.tweens.add({ targets: this.balloon, scale: 0, alpha: 0, duration: 400 })
    this.tweens.add({ targets: this.balloonLabel, alpha: 0, duration: 400 })
    // deflate the extrinsic portion of the bar
    this.tweens.addCounter({
      from: 1, to: 0, duration: 600,
      onUpdate: (tw) => {
        const f = tw.getValue() ?? 0
        this.extrinsicG.clear()
        const intrinsicH = this.intrinsicTotal * this.pxPerUnit
        const extrinsicH = (this.premium - this.intrinsicTotal) * this.pxPerUnit * f
        if (extrinsicH > 0) {
          this.extrinsicG.fillStyle(C.blue, 0.28)
          this.extrinsicG.fillRect(this.barX, this.barBottom - intrinsicH - extrinsicH, this.barW, extrinsicH)
        }
      },
    })
  }

  // --- payoff V -------------------------------------------------------------
  private drawVPanel(): void {
    this.panel(this.vx - 10, this.vy - 24, this.vw + 20, this.vh + 48, { fill: C.white, stroke: C.hairline, radius: 12 })
    this.label(this.vx + this.vw / 2, this.vy - 12, 'straddle payoff (V)', { size: 11, col: C.muted, align: 'center' })
  }

  private vxFor(price: number): number {
    return this.vx + ((price - this.vMin) / (this.vMax - this.vMin)) * this.vw
  }
  private vyFor(pnl: number): number {
    const span = 12
    const t = (pnl + span) / (2 * span)
    return this.vy + this.vh - t * this.vh
  }

  private drawV(): void {
    this.vG.clear()
    const y0 = this.vyFor(0)
    // zero line + strike + breakevens
    this.vG.lineStyle(1.5, C.blue, 0.6)
    this.vG.lineBetween(this.vx, y0, this.vx + this.vw, y0)
    const be = { lower: this.K - this.premium, upper: this.K + this.premium }
    for (const [px, lab, col] of [
      [this.K, 'K', C.blue],
      [be.lower, fmt(be.lower), C.blue],
      [be.upper, fmt(be.upper), C.blue],
    ] as const) {
      const x = this.vxFor(px)
      this.dashV(this.vG, x, this.vy, this.vy + this.vh, col, px === this.K ? 0.4 : 0.9)
      this.label(x, this.vy + this.vh + 6, lab, { size: 10, col: C.blue, align: 'center' })
    }
    // V curve + red interior shading
    this.vG.fillStyle(C.red, 0.12)
    this.vG.fillRect(this.vxFor(be.lower), this.vy, this.vxFor(be.upper) - this.vxFor(be.lower), this.vh)
    this.vG.lineStyle(3, C.green, 1)
    this.vG.beginPath()
    let first = true
    for (let px = this.vMin; px <= this.vMax; px += 0.5) {
      const pnl = Math.max(-12, Math.min(12, Math.abs(px - this.K) - this.premium))
      const sx = this.vxFor(px)
      const sy = this.vyFor(pnl)
      if (first) { this.vG.moveTo(sx, sy); first = false } else this.vG.lineTo(sx, sy)
    }
    this.vG.strokePath()
  }

  private landDot(): void {
    this.drawPremiumBar(true)
    const S = Phaser.Math.Clamp(this.S, this.vMin, this.vMax)
    const x = this.vxFor(S)
    const y = this.vyFor(Math.max(-12, Math.min(12, this.pnl)))
    this.dot.setVisible(true).setPosition(this.vxFor(this.K), this.vyFor(-this.premium))
    this.tweens.add({ targets: this.dot, x, y, duration: 600, ease: 'Cubic.out' })
    this.dot.setFillStyle(this.pnl >= 0 ? C.green : C.red)
    this.updateLedger()
  }

  /** Snap the dot to its current landing spot (no entry tween) — for live sliders. */
  private placeDot(): void {
    const S = Phaser.Math.Clamp(this.S, this.vMin, this.vMax)
    this.dot.setVisible(true).setPosition(this.vxFor(S), this.vyFor(Math.max(-12, Math.min(12, this.pnl))))
    this.dot.setFillStyle(this.pnl >= 0 ? C.green : C.red)
  }

  private updateLedger(): void {
    this.ledger.setText(
      `S = ${fmt(this.S)}   ·   intrinsic ${fmt(this.callIntrinsic)} + ${fmt(this.putIntrinsic)} = ${fmt(this.intrinsicTotal)}   −   premium ${fmt(this.premium)}   =   P&L ${fmtSigned(this.pnl)} (${fmtDollars(this.pnl)})`,
    )
    const cleared = this.S < this.K - this.premium || this.S > this.K + this.premium
    const text = cleared ? 'cleared BE → profit' : 'moved but lost — inside breakevens'
    const col = cleared ? C.green : C.red
    this.badge.setText(text).setColor(hex(col))
    this.badge.setPosition(24, 372)
    this.badgePanel.clear()
    this.badgePanel.fillStyle(cleared ? C.greenSoft : C.redSoft, 1)
    this.badgePanel.fillRoundedRect(18, 372 - 12, this.badge.width + 12, 24, 8)
    this.children.bringToTop(this.badge)
  }

  // --- interactive (module 10) ----------------------------------------------
  private buildSliders(): void {
    const y = this.H - 22
    const premText = this.label(20, y - 22, '', { size: 11, col: C.ink, bold: true })
    const moveText = this.label(300, y - 22, '', { size: 11, col: C.ink, bold: true })
    const refresh = () => {
      premText.setText(`pre-event IV (premium): ${fmt(this.premium)}`)
      moveText.setText(`realized move: ${fmtSigned(this.move * 100)}% → S ${fmt(this.S)}`)
      this.drawV()
      // bar shown post-crush (intrinsic only); update dot + ledger live
      this.drawPremiumBar(true)
      this.placeDot()
      this.updateLedger()
    }
    this.slider(20, y, 220, 3, 12, this.premium, (v) => { this.premium = v; refresh() }, { step: 0.5 })
    this.slider(300, y, 220, -0.15, 0.15, this.move, (v) => { this.move = v; refresh() }, { step: 0.01 })
    // Set the slider labels now; let the scripted pop/land animation run first, then
    // hand control to the sliders (a drag triggers refresh() from then on).
    premText.setText(`pre-event IV (premium): ${fmt(this.premium)}`)
    moveText.setText(`realized move: ${fmtSigned(this.move * 100)}% → S ${fmt(this.S)}`)
  }

  // --- quiz (module 11) -----------------------------------------------------
  private drawQuizMask(): void {
    // mask the post-event candle + P&L region (premium bar deflation + dot + ledger)
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 0.96)
    g.fillRect(this.vx - 10, this.vy - 24, this.vw + 20, this.vh + 48)
    g.lineStyle(1.5, C.blue, 0.5)
    g.strokeRect(this.vx - 10, this.vy - 24, this.vw + 20, this.vh + 48)
    const q = this.add
      .text(this.vx + this.vw / 2, this.vy + this.vh / 2, '?\nstock gaps up 4% to 104\noutcome hidden', {
        fontFamily: '"Segoe UI", sans-serif', fontSize: '13px', color: hex(C.blue), fontStyle: 'bold', align: 'center',
      })
      .setOrigin(0.5)
    this.maskG = this.add.container(0, 0, [g, q])
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true
    if (this.maskG) {
      this.tweens.add({ targets: this.maskG, alpha: 0, duration: 420, onComplete: () => this.maskG?.destroy() })
    }
    this.time.delayedCall(220, () => {
      this.popBalloon()
      this.landDot()
      // "moved but lost" stamp
      const stamp = this.label(this.vx + this.vw / 2, this.vy + 20, 'MOVED, STILL LOST', {
        size: 13, col: C.red, bold: true, align: 'center',
      })
      stamp.setAlpha(0)
      this.tweens.add({ targets: stamp, alpha: 1, scale: 1.1, duration: 400, yoyo: false })
    })
  }

  private dashV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += 9) g.lineBetween(x, y, x, Math.min(y + 5, y2))
  }
}
