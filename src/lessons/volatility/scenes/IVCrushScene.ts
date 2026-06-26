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
  /** Quiz mask + reveal (module 11, legacy support). */
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
 * IV-CRUSH scene (modules 10, 11). Plain framing: an option's price splits into REAL value
 * (intrinsic, green — what it's worth if exercised now) and EXTRA value (extrinsic, amber —
 * the "expected move" premium, fat before news). After the news drops, the extra value
 * collapses (IV crush) and the option is worth only its real value. Because the realized
 * move is small (e.g. +4% to 104, INSIDE the breakevens), you can be "right it moved a
 * little" and STILL lose:
 *
 *   P&L (at expiry) = max(S−K,0) + max(K−S,0) − premium   (real value only; no IV term)
 *
 * Left half: a price bar showing what you PAID (a dashed reference line) vs what it's
 * WORTH after the crush — the amber "extra value" drains away, leaving only green real
 * value, and the red gap up to the paid line IS the loss. Right half: the straddle payoff
 * V with the landing dot and the breakevens, so "moved but stayed inside" is visible.
 */
export default class IVCrushScene extends ModuleScene {
  private p!: IVCrushParams
  private premium = 7
  private K = 100
  private move = 0.04

  // mini payoff-V panel (right) — trimmed so the live sliders fit inside the canvas.
  private vx = 462
  private vy = 52
  private vw = 268
  private vh = 196
  private vMin = 86
  private vMax = 114

  // premium "umbrella price" bar (left)
  private barX = 70
  private barW = 52
  private barBottom = 244
  private pxPerUnit = 11

  // left-panel elements
  private header!: Phaser.GameObjects.Text
  private barG!: Phaser.GameObjects.Graphics
  private paidG!: Phaser.GameObjects.Graphics
  private paidChip!: Phaser.GameObjects.Graphics
  private paidLabel!: Phaser.GameObjects.Text
  private surgeLabel!: Phaser.GameObjects.Text
  private resultTag!: Phaser.GameObjects.Text
  /** Animated 1→0 fraction of the extrinsic ("surge") value still present. */
  private surgeFrac = 1
  private crushed = false

  // right payoff V
  private vG!: Phaser.GameObjects.Graphics
  /** Persistent V-axis tick labels (K + the two breakevens), created once & repositioned. */
  private vAxisLabels: Phaser.GameObjects.Text[] = []
  private dot!: Phaser.GameObjects.Arc
  private ledger!: Phaser.GameObjects.Text
  private badge!: Phaser.GameObjects.Text
  private badgePanel!: Phaser.GameObjects.Graphics
  private maskG?: Phaser.GameObjects.Container
  private revealed = false

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

    // --- left panel: the option's price before vs after the news ---
    this.panel(28, 36, 256, 252, { fill: C.surface, stroke: C.hairline, radius: 12 })
    // Header flips from "before" to "after" when the news drops (the extra value is crushed).
    this.header = this.label(156, 50, 'Before earnings: option is expensive', {
      size: this.fs(12, 12, 15), col: C.amberInk, align: 'center', bold: true,
    })
    this.header.setWordWrapWidth(244)

    // colour key — real value (stays) vs the extra value that vanishes after the news
    this.legendSwatch(44, 258, C.green, 'real value (stays)')
    this.legendSwatch(44, 274, C.amber, 'extra value (gone after news)')

    this.barG = this.add.graphics()
    this.paidG = this.add.graphics()
    // "you paid" reference line: a manual chip (kept legible even when it rides over the
    // bar at lab extremes) + the label, both repositioned each drawPaidLine().
    this.paidChip = this.add.graphics()
    this.paidLabel = this.label(48, 0, '', { size: this.fs(12, 12, 15), col: C.ink, bold: true })
    // callout pointing at the amber "extra value" band (sits beside the bar, over the clean panel)
    this.surgeLabel = this.label(132, 0, 'extra value', { size: this.fs(12, 12, 15), col: C.amberInk, bold: true })
    // post-crush result tag (paid → worth = P&L), beside the bar over the clean panel
    this.resultTag = this.label(132, 0, '', { size: this.fs(12, 12, 15), col: C.red, bold: true, align: 'left' }).setVisible(false)

    // --- right: payoff V panel ---
    this.drawVPanel()
    this.vG = this.add.graphics()
    this.dot = this.add.circle(0, 0, 9, C.red).setStrokeStyle(3, C.white).setVisible(false)

    // --- ledger + badge (clean strip below the panels) ---
    this.ledger = this.label(20, 308, '', { size: this.fs(12, 12, 15), col: C.ink, bold: true })
    this.badgePanel = this.add.graphics()
    this.badge = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${this.fs(13, 12, 16)}px`, color: hex(C.red), fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.drawBar()
    this.drawPaidLine()
    this.drawV()

    if (this.p.challenge) {
      // Pre-submit: show the fat, surge-priced premium intact — that's what you paid.
      this.setupChallenge()
    } else if (this.p.quiz) {
      this.drawQuizMask()
    } else {
      // Module 10 (interactive) and the plain teach demo both play the crush on load:
      // fat surge-priced premium → storm fizzles → drained to intrinsic, dot lands inside
      // the breakevens. Interactive sliders then re-tune the post-crush state live.
      if (this.p.interactive) this.buildSliders()
      if (this.reduceMotion) {
        this.applyCrushFinal()
        this.placeDot()
        this.updateLedger()
      } else {
        this.time.delayedCall(700, () => this.crushSurge())
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

  // --- premium "umbrella price" bar -----------------------------------------
  /** Draw the bar: green intrinsic (real value) + amber extrinsic ("surge") × surgeFrac. */
  private drawBar(): void {
    this.barG.clear()
    const intrinsicH = this.intrinsicTotal * this.pxPerUnit
    const extrinsicFull = Math.max(0, this.premium - this.intrinsicTotal)
    const extrinsicH = extrinsicFull * this.pxPerUnit * this.surgeFrac
    // intrinsic (green, solid, bottom) — the real value that survives the crush
    this.barG.fillStyle(C.green, 0.9)
    this.barG.fillRect(this.barX, this.barBottom - intrinsicH, this.barW, intrinsicH)
    // extrinsic (amber, translucent, on top) — the IV "surge" that gets crushed
    if (extrinsicH > 0) {
      this.barG.fillStyle(C.amber, 0.45)
      this.barG.fillRect(this.barX, this.barBottom - intrinsicH - extrinsicH, this.barW, extrinsicH)
      // keep the surge callout riding the middle of the amber band (pre-crush only)
      if (!this.crushed) {
        this.surgeLabel.setVisible(true).setPosition(this.barX + this.barW + 12, this.barBottom - intrinsicH - extrinsicH / 2)
      }
    }
  }

  /** The dashed "you paid" reference line across the panel + its (chipped) label. */
  private drawPaidLine(): void {
    this.paidG.clear()
    const yPaid = this.barBottom - this.premium * this.pxPerUnit
    this.paidG.lineStyle(1.5, C.ink, 0.9)
    for (let x = 44; x < 272; x += 8) this.paidG.lineBetween(x, yPaid, Math.min(x + 5, 272), yPaid)
    this.paidLabel.setText(`paid ${fmt(this.premium)}`).setPosition(48, yPaid - 11)
    const padX = 5
    const padY = 2
    this.paidChip.clear()
    this.paidChip.fillStyle(C.surface, 0.92)
    this.paidChip.fillRoundedRect(
      this.paidLabel.x - padX,
      this.paidLabel.y - this.paidLabel.height / 2 - padY,
      this.paidLabel.width + padX * 2,
      this.paidLabel.height + padY * 2,
      5,
    )
    this.children.moveBelow(this.paidChip, this.paidLabel)
  }

  /**
   * Post-crush: shade the gap between what it's WORTH (intrinsic top) and what you PAID
   * (the dashed line). Red = a loss (worth < paid); green = a surplus (worth > paid).
   */
  private updateResultTag(): void {
    if (!this.crushed) {
      this.resultTag.setVisible(false)
      return
    }
    const yPaid = this.barBottom - this.premium * this.pxPerUnit
    const yWorth = this.barBottom - this.intrinsicTotal * this.pxPerUnit
    const profit = this.pnl >= 0
    const top = Math.min(yPaid, yWorth)
    const h = Math.abs(yPaid - yWorth)
    // shade the shortfall/surplus band over the bar
    this.barG.fillStyle(profit ? C.green : C.red, 0.22)
    this.barG.fillRect(this.barX, top, this.barW, Math.max(1, h))
    this.resultTag
      .setVisible(true)
      .setText(`paid ${fmt(this.premium)} → worth ${fmt(this.intrinsicTotal)} = ${fmtSigned(this.pnl)}`)
      .setColor(hex(profit ? C.greenText : C.red))
      .setPosition(this.barX + this.barW + 12, (top + (top + h)) / 2)
  }

  /** Animate the amber "surge" draining to zero (the storm fizzles → IV crush). */
  private crushSurge(): void {
    if (this.crushed) return
    this.crushed = true
    this.header.setText('After earnings: option is cheap').setColor(hex(C.red))
    this.surgeLabel.setVisible(false)
    if (this.reduceMotion) {
      this.applyCrushFinal()
      return
    }
    this.tweens.addCounter({
      from: 1, to: 0, duration: this.dur(600), ease: 'Cubic.in',
      onUpdate: (tw) => {
        this.surgeFrac = tw.getValue() ?? 0
        this.drawBar()
      },
      onComplete: () => {
        this.surgeFrac = 0
        this.drawBar()
        this.updateResultTag()
      },
    })
  }

  /** Snap the bar to its fully crushed state (no animation). */
  private applyCrushFinal(): void {
    this.crushed = true
    this.surgeFrac = 0
    this.header.setText('After earnings: option is cheap').setColor(hex(C.red))
    this.surgeLabel.setVisible(false)
    this.drawBar()
    this.updateResultTag()
  }

  // --- payoff V -------------------------------------------------------------
  private drawVPanel(): void {
    this.panel(this.vx - 10, this.vy - 24, this.vw + 20, this.vh + 48, { fill: C.white, stroke: C.hairline, radius: 12 })
    this.label(this.vx + this.vw / 2, this.vy - 12, 'your straddle (V)', { size: this.fs(12, 12, 15), col: C.muted, align: 'center' })
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
    // V curve + red interior shading (the "still a loss" zone between breakevens)
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
    if (!this.crushed) this.crushSurge()
    const S = Phaser.Math.Clamp(this.S, this.vMin, this.vMax)
    const x = this.vxFor(S)
    const y = this.vyFor(Math.max(-12, Math.min(12, this.pnl)))
    this.dot.setFillStyle(this.pnl >= 0 ? C.green : C.red)
    if (this.reduceMotion) {
      this.dot.setVisible(true).setPosition(x, y)
    } else {
      this.dot.setVisible(true).setPosition(this.vxFor(this.K), this.vyFor(-this.premium))
      this.tweens.add({ targets: this.dot, x, y, duration: this.dur(600), ease: 'Cubic.out' })
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
      `Stock at ${fmt(this.S)}  ·  worth ${fmt(this.intrinsicTotal)} − paid ${fmt(this.premium)} = ${fmtSigned(this.pnl)} (${fmtDollars(this.pnl)})`,
    )
    const cleared = this.S < this.K - this.premium || this.S > this.K + this.premium
    const text = cleared ? 'cleared a breakeven → profit' : 'moved but still lost (inside breakevens)'
    const col = cleared ? C.greenText : C.red
    const badgeY = 336
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
      premText.setText(`option price: ${fmt(this.premium)}`)
      moveText.setText(`stock move: ${fmtSigned(this.move * 100)}% → ${fmt(this.S)}`)
      this.drawV()
      this.drawPaidLine()
      // bar shown post-crush (intrinsic only); update dot + ledger + result live
      this.drawBar()
      this.updateResultTag()
      this.placeDot()
      this.updateLedger()
    }
    // amber dials — the live "act on me" affordance
    this.slider(20, y, 300, 3, 12, this.premium, (v) => { this.premium = v; refresh() }, { step: 0.5, col: C.amber })
    this.slider(390, y, 300, -0.15, 0.15, this.move, (v) => { this.move = v; refresh() }, { step: 0.01, col: C.amber })
    premText.setText(`option price: ${fmt(this.premium)}`)
    moveText.setText(`stock move: ${fmtSigned(this.move * 100)}% → ${fmt(this.S)}`)
  }

  // --- quiz (module 11, legacy) ---------------------------------------------
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
      this.tweens.add({ targets: this.maskG, alpha: 0, duration: this.dur(420), onComplete: () => this.maskG?.destroy() })
    }
    this.time.delayedCall(this.dur(220), () => {
      this.crushSurge()
      this.landDot()
      // "moved but lost" stamp
      const stamp = this.label(this.vx + this.vw / 2, this.vy + 40, 'MOVED, STILL LOST', {
        size: this.fs(13, 12, 16), col: C.red, bold: true, align: 'center', bg: true,
      })
      if (!this.reduceMotion) {
        stamp.setAlpha(0)
        this.tweens.add({ targets: stamp, alpha: 1, scale: 1.1, duration: this.dur(400), ease: 'Cubic.out' })
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
   * V panel; Submit crushes the surge, lands the dot, and grades whether the chosen
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
    this.hintLabel = this.label(20, 388, 'Drag the marker, then run it.', {
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

    // Crush the surge (IV crush) + land the dot at the chosen price.
    this.crushSurge()
    this.landDot()

    const be = { lower: this.K - this.premium, upper: this.K + this.premium }
    const cleared = this.S < be.lower || this.S > be.upper
    const correct = cleared

    const stamp = this.label(this.vx + this.vw / 2, this.vy + 40, cleared ? 'CLEARED A BREAKEVEN' : 'MOVED, STILL LOST', {
      size: this.fs(13, 12, 16), col: cleared ? C.greenText : C.red, bold: true, align: 'center', bg: true,
    })
    if (!this.reduceMotion) {
      stamp.setAlpha(0)
      this.tweens.add({ targets: stamp, alpha: 1, scale: 1.1, duration: this.dur(400), ease: 'Cubic.out' })
    }

    const title = correct
      ? `Profit — ${fmt(this.S)} cleared a breakeven · ${fmtSigned(this.pnl)}`
      : `Lost — ${fmt(this.S)} is inside ${fmt(be.lower)}–${fmt(be.upper)} · ${fmtSigned(this.pnl)}`
    const detail = correct
      ? `At ${fmt(this.S)}, the straddle is worth ${fmt(this.intrinsicTotal)} — more than the ${fmt(this.premium)} you paid — so you profit ${fmtSigned(this.pnl)} (${fmtDollars(this.pnl)}). You cleared a breakeven (${fmt(be.lower)} or ${fmt(be.upper)}). That's what makes a long straddle win — not the move alone.`
      : `The trap: the stock moved to ${fmt(this.S)}, but that's still inside the breakevens (${fmt(be.lower)}–${fmt(be.upper)}). It's only worth ${fmt(this.intrinsicTotal)}, less than the ${fmt(this.premium)} you paid, so you lose ${fmtSigned(this.pnl)} (${fmtDollars(this.pnl)}). To win, you must clear a breakeven — moving isn't enough.`
    this.report(correct, title, detail)
  }

  private dashV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += 9) g.lineBetween(x, y, x, Math.min(y + 5, y2))
  }
}
