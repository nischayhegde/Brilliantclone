import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'
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
  /**
   * CHALLENGE mode (module 11) — the learner drags the post-event landing price on the
   * V panel, then Submit applies the IV crush, lands the dot, and grades whether that
   * price actually PROFITS (cleared a breakeven) vs merely moved.
   */
  challenge?: boolean
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

  // mini payoff-V panel (right) — trimmed so the live sliders fit inside the canvas
  // (the old layout pushed the slider band to y≈438, below the 460-tall canvas).
  private vx = 462
  private vy = 52
  private vw = 268
  private vh = 196
  private vMin = 86
  private vMax = 114

  // premium bar (left)
  private barX = 120
  private barBottom = 230
  private barW = 56
  private pxPerUnit = 13

  private balloon!: Phaser.GameObjects.Arc
  private balloonLabel!: Phaser.GameObjects.Text
  private extrinsicG!: Phaser.GameObjects.Graphics
  private intrinsicG!: Phaser.GameObjects.Graphics
  private vG!: Phaser.GameObjects.Graphics
  /** Persistent V-axis tick labels (K + the two breakevens), created once & repositioned. */
  private vAxisLabels: Phaser.GameObjects.Text[] = []
  private dot!: Phaser.GameObjects.Arc
  private ledger!: Phaser.GameObjects.Text
  private badge!: Phaser.GameObjects.Text
  private badgePanel!: Phaser.GameObjects.Graphics
  private maskG?: Phaser.GameObjects.Container
  private revealed = false
  private popped = false

  // --- challenge state (module 11) ---
  private graded = false
  private guessG!: Phaser.GameObjects.Graphics
  private guessKnob!: Phaser.GameObjects.Arc
  private guessLabel!: Phaser.GameObjects.Text
  private hintLabel?: Phaser.GameObjects.Text
  private challengeRedraw: () => void = () => {}

  protected build(): void {
    this.p = this.params as IVCrushParams
    this.premium = this.p.premium ?? 7
    this.K = this.p.K ?? 100
    this.move = this.p.move ?? 0.04

    if (this.p.title) this.label(20, 16, this.p.title, { size: this.fs(15, 14, 18), bold: true, col: C.ink })

    // --- premium bar scaffolding (left, framed to fill the left half) ---
    const cx = this.barX + this.barW / 2
    this.panel(30, 32, 250, this.barBottom + 24, { fill: C.surface, stroke: C.hairline, radius: 12 })
    this.label(cx, this.barBottom + 14, 'premium', { size: this.fs(12, 12, 15), col: C.muted, align: 'center' })
    // colour key — intrinsic (real value, survives) vs extrinsic (IV/time, gets crushed)
    this.legendSwatch(46, this.barBottom + 32, C.green, 'intrinsic (real)')
    this.legendSwatch(46, this.barBottom + 50, C.amber, 'extrinsic (IV/time)')
    this.extrinsicG = this.add.graphics()
    this.intrinsicG = this.add.graphics()
    // The "IV balloon" = the fat extrinsic value (amber = the volatile energy that pops).
    this.balloon = this.add.circle(cx, this.barBottom - 80, 46, C.amberSoft).setStrokeStyle(2, C.amber)
    this.balloon.setAlpha(0.85)
    this.balloonLabel = this.label(cx, this.barBottom - 142, 'high IV — fat premium', {
      size: this.fs(12, 12, 15), col: C.amberInk, align: 'center', bold: true,
    })

    // --- payoff V panel (right) ---
    this.drawVPanel()
    this.vG = this.add.graphics()
    this.dot = this.add.circle(0, 0, 9, C.red).setStrokeStyle(3, C.white).setVisible(false)

    // --- ledger + badge (clean strip below the panels) ---
    this.ledger = this.label(20, 304, '', { size: this.fs(12, 12, 15), col: C.ink, bold: true })
    this.badgePanel = this.add.graphics()
    this.badge = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${this.fs(13, 12, 16)}px`, color: hex(C.red), fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.drawPremiumBar(false)
    this.drawV()

    if (this.p.challenge) {
      this.setupChallenge()
    } else if (this.p.quiz) {
      this.drawQuizMask()
    } else {
      if (this.p.interactive) this.buildSliders()
      if (this.reduceMotion) {
        // Show the finished post-crush state immediately — never gate the dot/ledger
        // behind a timed pop that won't run under reduced motion or a hidden tab.
        this.balloon.setVisible(false)
        this.balloonLabel.setVisible(false)
        this.popped = true
        this.drawPremiumBar(true)
        this.placeDot()
        this.updateLedger()
      } else {
        this.time.delayedCall(700, () => this.popBalloon())
        this.time.delayedCall(1500, () => this.landDot())
      }
    }
    this.time.delayedCall(800, () => this.emitReady())
  }

  /** Small colour-key row: a filled square + label. */
  private legendSwatch(x: number, y: number, col: number, text: string): void {
    const g = this.add.graphics()
    g.fillStyle(col, col === C.amber ? 0.45 : 0.9)
    g.fillRoundedRect(x, y - 6, 12, 12, 3)
    this.label(x + 18, y, text, { size: this.fs(11, 12, 14), col: C.inkSoft })
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
    // intrinsic (green, solid, bottom) — the real value that survives the crush
    this.intrinsicG.fillStyle(C.green, 0.9)
    this.intrinsicG.fillRect(this.barX, this.barBottom - intrinsicH, this.barW, intrinsicH)
    // extrinsic (amber, translucent, on top) — the IV / time value that gets crushed
    if (extrinsicH > 0) {
      this.extrinsicG.fillStyle(C.amber, 0.45)
      this.extrinsicG.fillRect(this.barX, this.barBottom - intrinsicH - extrinsicH, this.barW, extrinsicH)
    }
  }

  private popBalloon(): void {
    if (this.popped) return
    this.popped = true
    this.balloonLabel.setText('IV crush!').setColor(hex(C.red))
    if (this.reduceMotion) {
      this.balloon.setVisible(false)
      this.balloonLabel.setVisible(false)
      this.drawPremiumBar(true)
      return
    }
    // particle-ish burst (amber, matching the extrinsic value escaping)
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2
      const dotp = this.add.circle(this.balloon.x, this.balloon.y, 4, C.amber, 0.8)
      this.tweens.add({
        targets: dotp,
        x: this.balloon.x + Math.cos(ang) * 56,
        y: this.balloon.y + Math.sin(ang) * 56,
        alpha: 0,
        duration: 500,
        ease: 'Cubic.out',
        onComplete: () => dotp.destroy(),
      })
    }
    this.tweens.add({ targets: this.balloon, scale: 0, alpha: 0, duration: 400, ease: 'Cubic.in' })
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
          this.extrinsicG.fillStyle(C.amber, 0.45)
          this.extrinsicG.fillRect(this.barX, this.barBottom - intrinsicH - extrinsicH, this.barW, extrinsicH)
        }
      },
    })
  }

  // --- payoff V -------------------------------------------------------------
  private drawVPanel(): void {
    this.panel(this.vx - 10, this.vy - 24, this.vw + 20, this.vh + 48, { fill: C.white, stroke: C.hairline, radius: 12 })
    this.label(this.vx + this.vw / 2, this.vy - 12, 'straddle payoff (V)', { size: this.fs(12, 12, 15), col: C.muted, align: 'center' })
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
    const ticks = [
      [this.K, 'K', 0.4],
      [be.lower, fmt(be.lower), 0.9],
      [be.upper, fmt(be.upper), 0.9],
    ] as const
    ticks.forEach(([px, lab, alpha], i) => {
      const x = this.vxFor(px)
      this.dashV(this.vG, x, this.vy, this.vy + this.vh, C.blue, alpha)
      // create the axis label ONCE, then reposition/retext on later redraws (no stacking)
      let t = this.vAxisLabels[i]
      if (!t) {
        t = this.label(x, this.vy + this.vh + 10, lab, { size: this.fs(12, 12, 15), col: C.blueDark, align: 'center' })
        this.vAxisLabels[i] = t
      } else {
        t.setText(lab).setPosition(x, this.vy + this.vh + 10)
      }
    })
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
    this.dot.setFillStyle(this.pnl >= 0 ? C.green : C.red)
    if (this.reduceMotion) {
      this.dot.setVisible(true).setPosition(x, y)
    } else {
      this.dot.setVisible(true).setPosition(this.vxFor(this.K), this.vyFor(-this.premium))
      this.tweens.add({ targets: this.dot, x, y, duration: 600, ease: 'Cubic.out' })
    }
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
    const col = cleared ? C.greenText : C.red
    const badgeY = 332
    this.badge.setText(text).setColor(hex(col))
    this.badge.setPosition(24, badgeY)
    this.badgePanel.clear()
    this.badgePanel.fillStyle(cleared ? C.greenSoft : C.redSoft, 1)
    this.badgePanel.fillRoundedRect(18, badgeY - this.badge.height / 2 - 4, this.badge.width + 12, this.badge.height + 8, 8)
    this.children.bringToTop(this.badge)
  }

  // --- interactive (module 10) ----------------------------------------------
  private buildSliders(): void {
    const y = 404
    const labelFs = this.fs(12, 12, 15)
    const premText = this.label(20, y - 26, '', { size: labelFs, col: C.ink, bold: true })
    const moveText = this.label(390, y - 26, '', { size: labelFs, col: C.ink, bold: true })
    const refresh = () => {
      premText.setText(`pre-event IV (premium): ${fmt(this.premium)}`)
      moveText.setText(`realized move: ${fmtSigned(this.move * 100)}% → S ${fmt(this.S)}`)
      this.drawV()
      // bar shown post-crush (intrinsic only); update dot + ledger live
      this.drawPremiumBar(true)
      this.placeDot()
      this.updateLedger()
    }
    // amber dials — the live "act on me" affordance
    this.slider(20, y, 300, 3, 12, this.premium, (v) => { this.premium = v; refresh() }, { step: 0.5, col: C.amber })
    this.slider(390, y, 300, -0.15, 0.15, this.move, (v) => { this.move = v; refresh() }, { step: 0.01, col: C.amber })
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
        fontFamily: FONT, fontSize: `${this.fs(13, 12, 16)}px`, color: hex(C.blueDark), fontStyle: 'bold', align: 'center',
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
      const stamp = this.label(this.vx + this.vw / 2, this.vy + 40, 'MOVED, STILL LOST', {
        size: this.fs(13, 12, 16), col: C.red, bold: true, align: 'center', bg: true,
      })
      if (!this.reduceMotion) {
        stamp.setAlpha(0)
        this.tweens.add({ targets: stamp, alpha: 1, scale: 1.1, duration: 400, ease: 'Cubic.out' })
      }
    })
  }

  // --- challenge (module 11) ------------------------------------------------

  /** Inverse of vxFor: screen-x → price, clamped to the V panel range. */
  private priceForVx(x: number): number {
    const cx = Phaser.Math.Clamp(x, this.vx, this.vx + this.vw)
    return this.vMin + ((cx - this.vx) / this.vw) * (this.vMax - this.vMin)
  }

  /**
   * Module 11 CHALLENGE — the learner drags a "where does it land?" marker along the
   * V panel; Submit pops the IV balloon, lands the dot, and grades whether the chosen
   * price actually PROFITS (cleared a breakeven) — not merely "moved". The marker starts
   * at 104 (the tempting "it moved 4%, so I won" trap, which loses).
   */
  private setupChallenge(): void {
    // Start the guess at the trap price S=104 (move +4%).
    this.move = 0.04
    this.guessG = this.add.graphics()
    this.guessKnob = this.add.circle(0, this.vy + this.vh / 2, 10, C.amber).setStrokeStyle(3, C.white)
    const guessChip = this.add.graphics()
    // label rides just INSIDE the top of the panel (not above it, where it collided with
    // the "straddle payoff (V)" title)
    this.guessLabel = this.label(0, this.vy + 14, '', { size: this.fs(13, 12, 16), col: C.amberInk, bold: true, align: 'center' })

    const hit = this.add
      .rectangle(this.vx + this.vw / 2, this.vy + this.vh / 2, this.vw + 20, this.vh, 0x000000, 0)
      .setInteractive({ useHandCursor: true })

    const redraw = () => {
      const x = this.vxFor(Phaser.Math.Clamp(this.S, this.vMin, this.vMax))
      this.guessG.clear()
      this.guessG.lineStyle(2, C.amber, this.graded ? 0.3 : 1)
      for (let yy = this.vy; yy < this.vy + this.vh; yy += 10) this.guessG.lineBetween(x, yy, x, Math.min(yy + 6, this.vy + this.vh))
      this.guessKnob.setPosition(x, this.vy + this.vh / 2).setAlpha(this.graded ? 0.4 : 1)
      this.guessLabel.setText(`land at ${fmt(this.S)}`).setPosition(x, this.vy + 14).setAlpha(this.graded ? 0.5 : 1)
      const padX = 6
      const padY = 3
      guessChip.clear()
      guessChip.fillStyle(C.white, this.graded ? 0.5 : 0.88)
      guessChip.fillRoundedRect(
        this.guessLabel.x - this.guessLabel.width / 2 - padX,
        this.guessLabel.y - this.guessLabel.height / 2 - padY,
        this.guessLabel.width + padX * 2,
        this.guessLabel.height + padY * 2,
        5,
      )
      this.children.moveBelow(guessChip, this.guessLabel)
    }
    redraw()

    let dragging = false
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.graded) return
      dragging = true
      this.move = this.priceForVx(p.worldX) / this.K - 1
      redraw()
    })
    const onMove = (p: Phaser.Input.Pointer) => {
      if (dragging && !this.graded) { this.move = this.priceForVx(p.worldX) / this.K - 1; redraw() }
    }
    const onUp = () => { dragging = false }
    this.input.on('pointermove', onMove)
    this.input.on('pointerup', onUp)
    this.input.on('pointerupoutside', onUp)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', onMove)
      this.input.off('pointerup', onUp)
      this.input.off('pointerupoutside', onUp)
    })
    this.challengeRedraw = redraw

    // hint in the clear band below the panels/ledger/badge (the prompt + how-to also
    // live in the footer; this is just an in-canvas nudge by the draggable marker).
    // Removed on grade so the stale "drag … then run" instruction doesn't linger.
    this.hintLabel = this.label(20, 386, 'drag the amber marker on the V → then run earnings + IV crush', {
      size: this.fs(12, 12, 15), col: C.amberInk, bold: true,
    })
    this.setCanSubmit(true)
  }

  protected onSubmit(): void {
    if (!this.p.challenge || this.graded) return
    this.graded = true
    this.setCanSubmit(false)
    this.hintLabel?.setVisible(false)
    this.challengeRedraw()

    // Apply the IV crush + land the dot at the chosen price.
    this.popBalloon()
    this.landDot()

    const be = { lower: this.K - this.premium, upper: this.K + this.premium }
    const cleared = this.S < be.lower || this.S > be.upper
    const correct = cleared

    const stamp = this.label(this.vx + this.vw / 2, this.vy + 40, cleared ? 'CLEARED A BE → PROFIT' : 'MOVED, STILL LOST', {
      size: this.fs(13, 12, 16), col: cleared ? C.greenText : C.red, bold: true, align: 'center', bg: true,
    })
    if (!this.reduceMotion) {
      stamp.setAlpha(0)
      this.tweens.add({ targets: stamp, alpha: 1, scale: 1.1, duration: 400, ease: 'Cubic.out' })
    }

    const title = correct
      ? `Profit — ${fmt(this.S)} cleared a breakeven · ${fmtSigned(this.pnl)}`
      : `Lost — ${fmt(this.S)} is inside 93–107 · ${fmtSigned(this.pnl)}`
    const detail = correct
      ? `At S=${fmt(this.S)} the straddle is worth its intrinsic ${fmt(this.intrinsicTotal)} > the ${fmt(this.premium)} premium, so P&L = ${fmt(this.intrinsicTotal)} − ${fmt(this.premium)} = ${fmtSigned(this.pnl)} (${fmtDollars(this.pnl)}). You cleared a breakeven (${fmt(be.lower)} / ${fmt(be.upper)}) — that is what makes a long straddle profit, not the move alone. (IV crush still wipes any extrinsic value, but here intrinsic is enough.)`
      : `The trap: the stock MOVED to ${fmt(this.S)} but that is INSIDE the breakevens ${fmt(be.lower)}–${fmt(be.upper)}. Intrinsic is only ${fmt(this.intrinsicTotal)}, less than the ${fmt(this.premium)} paid, so P&L = ${fmt(this.intrinsicTotal)} − ${fmt(this.premium)} = ${fmtSigned(this.pnl)} (${fmtDollars(this.pnl)}). To profit you must CLEAR a breakeven (below ${fmt(be.lower)} or above ${fmt(be.upper)}) — moving isn't enough. And IV crush removes any time value you'd hoped to sell.`
    this.report(correct, title, detail)
  }

  private dashV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += 9) g.lineBetween(x, y, x, Math.min(y + 5, y2))
  }
}
