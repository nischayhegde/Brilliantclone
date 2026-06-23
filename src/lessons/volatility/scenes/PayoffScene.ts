import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'
import {
  type Leg,
  combinedPnL,
  breakevens,
  totalPremium,
  isShort,
  straddle,
  strangle,
  fmt,
  fmtSigned,
  fmtDollars,
} from './payoffMath'

type Structure = 'straddle' | 'strangle'

interface SliderCfg {
  /** Which parameter this slider edits. */
  key: 'K' | 'callPremium' | 'putPremium' | 'spread' | 'total' | 'Kc' | 'Kp'
  label: string
  min: number
  max: number
  step?: number
}

interface PayoffParams {
  structure?: Structure
  side?: 'long' | 'short'
  /** Straddle anchor strike. */
  K?: number
  callPremium?: number
  putPremium?: number
  /** Strangle strikes. */
  Kp?: number
  Kc?: number
  /** Strangle per-leg premiums (default 1.25 put / 1.75 call → total 3). */
  putPremiumStrangle?: number
  callPremiumStrangle?: number

  title?: string
  caption?: string

  /** Draw the breakeven markers + profit/loss shading (modules 4, 7, 8, ...). */
  showBreakevens?: boolean
  /** Animate the two legs drawing then summing (modules 2, 3, 6). */
  showLegMerge?: boolean
  /** Ghost a straddle V behind a strangle for contrast (module 6). */
  ghostStraddle?: boolean
  /** Overlay BOTH a straddle V and a strangle valley (module 8 compare). */
  compareBoth?: boolean

  /** A draggable "price at expiry" dot that reads live P&L. */
  draggableDot?: boolean
  /** Starting price for the dot. */
  dotStart?: number

  /** In-canvas interactive sliders that rebuild the curve live. */
  sliders?: SliderCfg[]

  /** QUIZ mode: hide breakevens behind a panel until reveal. */
  quiz?: boolean
  /** On reveal, snap breakevens to these (defaults to computed). */
  // (computed from current legs)
}

const PAD = { left: 52, right: 24, top: 30, bottom: 92 }

/**
 * The workhorse payoff-diagram scene for Lesson 5. x = stock price at expiry,
 * y = P&L per share. Sums one or two legs into the combined shape — the straddle V
 * (vertex −total at K) or the strangle flat-bottom valley (−total across Kp..Kc) —
 * marks both breakevens (blue dashed), shades profit green / loss red, and can carry
 * a draggable price dot, in-canvas sliders, a ghost overlay, or a quiz mask.
 *
 * Reused by modules 2, 3, 4, 6, 7, 8, 12 via params.
 */
export default class PayoffScene extends ModuleScene {
  private p!: PayoffParams

  // current editable state
  private structure: Structure = 'straddle'
  private side: 'long' | 'short' = 'long'
  private K = 100
  private callPremium = 4
  private putPremium = 3
  private Kp = 95
  private Kc = 105
  private putPremiumS = 1.25
  private callPremiumS = 1.75

  // plot geometry
  private plot = { l: 0, r: 0, t: 0, b: 0, w: 0, h: 0 }
  private xMin = 80
  private xMax = 120
  private yMin = -12
  private yMax = 12

  // redrawable layers
  private curveG!: Phaser.GameObjects.Graphics
  private shadeG!: Phaser.GameObjects.Graphics
  private beG!: Phaser.GameObjects.Graphics
  private beLabels: Phaser.GameObjects.Text[] = []
  private ghostG?: Phaser.GameObjects.Graphics
  private dot?: Phaser.GameObjects.Arc
  private dotLabel?: Phaser.GameObjects.Text
  private dotPrice = 100
  private readoutText?: Phaser.GameObjects.Text
  private maskG?: Phaser.GameObjects.Container
  private revealed = false

  protected build(): void {
    this.p = this.params as PayoffParams
    this.structure = this.p.structure ?? 'straddle'
    this.side = this.p.side ?? 'long'
    this.K = this.p.K ?? 100
    this.callPremium = this.p.callPremium ?? 4
    this.putPremium = this.p.putPremium ?? 3
    this.Kp = this.p.Kp ?? 95
    this.Kc = this.p.Kc ?? 105
    this.putPremiumS = this.p.putPremiumStrangle ?? 1.25
    this.callPremiumS = this.p.callPremiumStrangle ?? 1.75
    this.dotPrice = this.p.dotStart ?? 100

    this.plot = {
      l: PAD.left,
      r: this.W - PAD.right,
      t: PAD.top,
      b: this.H - PAD.bottom,
      w: this.W - PAD.left - PAD.right,
      h: this.H - PAD.top - PAD.bottom,
    }

    if (this.p.title) this.label(this.plot.l, 14, this.p.title, { size: 15, bold: true, col: C.ink })

    this.computeRange()
    this.drawAxes()

    // persistent layers (drawn back-to-front)
    this.shadeG = this.add.graphics()
    this.ghostG = this.add.graphics()
    this.curveG = this.add.graphics()
    this.beG = this.add.graphics()

    if (this.p.compareBoth) {
      this.drawCompareBoth()
      // breakevens deferred to reveal for the compare quiz
    } else if (this.p.showLegMerge) {
      this.animateLegMerge()
    } else {
      this.redraw()
      // In quiz mode the breakevens are the answer, so don't draw them yet.
      if (!this.p.quiz) this.maybeShowBreakevens(true)
    }

    if (this.p.quiz) this.drawQuizMask()
    if (this.p.draggableDot && !this.p.quiz) this.addDraggableDot()
    if (this.p.sliders && !this.p.quiz) this.buildSliders(this.p.sliders)
    if (this.p.caption) {
      const cap = this.label(this.plot.l, this.H - 16, this.p.caption, { size: 12, col: C.muted })
      cap.setWordWrapWidth(this.plot.w + 28)
    }

    this.time.delayedCall(this.p.showLegMerge ? 3600 : 800, () => this.emitReady())
  }

  // --- current legs ---------------------------------------------------------
  private legs(): Leg[] {
    return this.structure === 'straddle'
      ? straddle(this.K, this.callPremium, this.putPremium, this.side)
      : strangle(this.Kp, this.Kc, this.putPremiumS, this.callPremiumS, this.side)
  }

  // --- ranges & mapping -----------------------------------------------------
  /**
   * Compute the fixed plot window ONCE (in build()). It must stay constant so the axes,
   * which are drawn a single time, never desync from a slider-driven curve redraw. When
   * the module has sliders we widen the window to cover the slider extremes.
   */
  private computeRange(): void {
    const legs = this.legs()
    const be = breakevens(legs)
    const strikes = legs.map((l) => l.K)
    let lo = Math.min(be.lower, ...strikes, 100) - 6
    let hi = Math.max(be.upper, ...strikes, 100) + 6
    let arm = Math.max(totalPremium(legs) + 5, 12)

    if (this.p.sliders && this.p.sliders.length) {
      // generous fixed window covering the slider ranges (strikes 85..115, big premiums)
      lo = Math.min(lo, 76)
      hi = Math.max(hi, 124)
      arm = Math.max(arm, 22)
    }

    this.xMin = Math.max(0, Math.floor(lo / 2) * 2)
    this.xMax = Math.ceil(hi / 2) * 2
    this.yMin = -arm
    this.yMax = arm
  }

  private xFor(price: number): number {
    const t = (price - this.xMin) / (this.xMax - this.xMin)
    return this.plot.l + t * this.plot.w
  }
  private yFor(pnl: number): number {
    const t = (pnl - this.yMin) / (this.yMax - this.yMin)
    return this.plot.b - t * this.plot.h
  }

  // --- axes -----------------------------------------------------------------
  private drawAxes(): void {
    const g = this.add.graphics()
    // zero P&L line (y=0) emphasised
    const y0 = this.yFor(0)
    g.lineStyle(1.5, C.blue, 0.6)
    g.lineBetween(this.plot.l, y0, this.plot.r, y0)
    // left axis
    g.lineStyle(1, C.hairline)
    g.lineBetween(this.plot.l, this.plot.t, this.plot.l, this.plot.b)
    // x ticks (prices)
    const xticks = this.niceTicks(this.xMin, this.xMax, 5)
    for (const px of xticks) {
      const x = this.xFor(px)
      g.lineStyle(1, C.gray100)
      g.lineBetween(x, this.plot.t, x, this.plot.b)
      this.label(x, this.plot.b + 12, fmt(px), { size: 11, col: C.muted, align: 'center' })
    }
    // y ticks (P&L)
    const yticks = this.niceTicks(this.yMin, this.yMax, 4)
    for (const py of yticks) {
      const y = this.yFor(py)
      this.label(this.plot.l - 8, y, fmtSigned(py), { size: 11, col: C.muted, align: 'right' })
    }
    // axis titles
    this.label(this.plot.l + this.plot.w / 2, this.plot.b + 28, 'stock price at expiry', {
      size: 11,
      col: C.muted,
      align: 'center',
    })
    this.add
      .text(this.plot.l - 38, this.plot.t + this.plot.h / 2, 'P&L', {
        fontFamily: FONT,
        fontSize: '11px',
        color: hex(C.muted),
      })
      .setOrigin(0.5)
      .setAngle(-90)
  }

  private niceTicks(min: number, max: number, count: number): number[] {
    const raw = (max - min) / count
    const mag = Math.pow(10, Math.floor(Math.log10(raw)))
    const norm = raw / mag
    const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
    const out: number[] = []
    const start = Math.ceil(min / step) * step
    for (let v = start; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
    return out
  }

  // --- the curve ------------------------------------------------------------
  /** Sample the combined payoff across the visible x-range into screen points. */
  private curvePoints(legs: Leg[]): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = []
    const steps = 240
    for (let i = 0; i <= steps; i++) {
      const price = this.xMin + ((this.xMax - this.xMin) * i) / steps
      const pnl = Math.max(this.yMin, Math.min(this.yMax, combinedPnL(legs, price)))
      pts.push({ x: this.xFor(price), y: this.yFor(pnl) })
    }
    return pts
  }

  private strokePath(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[], col: number, width: number, alpha = 1): void {
    g.lineStyle(width, col, alpha)
    g.beginPath()
    g.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
    g.strokePath()
  }

  /** Redraw curve + shading for the current state. The plot window is fixed (set once
   *  in build) so the once-drawn axes never desync from a slider-driven redraw. */
  private redraw(): void {
    const legs = this.legs()
    this.shadeG.clear()
    this.curveG.clear()
    const pts = this.curvePoints(legs)
    const y0 = this.yFor(0)

    // Shade profit (green) above 0, loss (red) below 0, under the curve.
    for (const sign of [1, -1] as const) {
      const col = sign > 0 ? C.green : C.red
      this.shadeG.fillStyle(col, 0.12)
      this.shadeG.beginPath()
      this.shadeG.moveTo(pts[0].x, y0)
      for (const pt of pts) {
        const clampedY = sign > 0 ? Math.min(pt.y, y0) : Math.max(pt.y, y0)
        this.shadeG.lineTo(pt.x, clampedY)
      }
      this.shadeG.lineTo(pts[pts.length - 1].x, y0)
      this.shadeG.closePath()
      this.shadeG.fillPath()
    }

    // The curve itself: green for the long profit potential, but the body color is
    // green throughout (profit zones) with the loss interior already shaded red.
    this.strokePath(this.curveG, pts, C.green, 3)

    // strike markers (blue dashed verticals)
    const strikes = [...new Set(legs.map((l) => l.K))]
    for (const k of strikes) {
      const x = this.xFor(k)
      this.dashLineV(this.curveG, x, this.plot.t, this.plot.b, C.blue, 0.5)
    }
    this.updateDot()
  }

  private dashLineV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1, dash = 6, gap = 5): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += dash + gap) g.lineBetween(x, y, x, Math.min(y + dash, y2))
  }

  // --- breakevens + shading -------------------------------------------------
  private maybeShowBreakevens(animate: boolean): void {
    if (!this.p.showBreakevens) return
    this.drawBreakevens(animate)
  }

  private drawBreakevens(animate: boolean): void {
    this.beG.clear()
    for (const t of this.beLabels) t.destroy()
    this.beLabels = []
    const legs = this.legs()
    const be = breakevens(legs)
    const total = totalPremium(legs)

    for (const [price, name] of [
      [be.lower, 'BE ' + fmt(be.lower)],
      [be.upper, 'BE ' + fmt(be.upper)],
    ] as const) {
      const x = this.xFor(price)
      this.dashLineV(this.beG, x, this.plot.t, this.plot.b, C.blue, 1, 8, 6)
      const lbl = this.label(x, this.plot.t - 2, name, { size: 11, col: C.blue, bold: true, align: 'center' })
      this.beLabels.push(lbl)
      if (animate) {
        lbl.alpha = 0
        this.tweens.add({ targets: lbl, alpha: 1, duration: 300 })
      }
    }
    // max-loss readout near the vertex / flat band
    const short = isShort(legs)
    const depthY = this.yFor(short ? total : -total)
    const midX = this.structure === 'straddle' ? this.xFor(this.K) : this.xFor((this.Kp + this.Kc) / 2)
    const tag = short
      ? `max profit ${fmtSigned(total)}`
      : `max loss ${fmtSigned(-total)}`
    const t = this.label(midX, depthY + (short ? -14 : 16), tag, {
      size: 11,
      col: short ? C.green : C.red,
      bold: true,
      align: 'center',
    })
    this.beLabels.push(t)
    if (short) {
      // the loss ramps fall off the bottom of the window — flag the large/undefined risk
      const risk = this.label(this.plot.r - 6, this.plot.b - 12, 'loss grows ↓ (unbounded up / large down)', {
        size: 11, col: C.red, bold: true, align: 'right',
      })
      this.beLabels.push(risk)
    }
  }

  // --- ghost / compare ------------------------------------------------------
  private drawGhost(): void {
    if (!this.ghostG) return
    this.ghostG.clear()
    const ghostLegs = straddle(100, 4, 3, this.side)
    const pts = this.curvePoints(ghostLegs)
    this.strokePath(this.ghostG, pts, C.blue, 1.5, 0.35)
  }

  private drawCompareBoth(): void {
    // Overlay a straddle V (green) and a strangle valley (blue) on one axis.
    this.structure = 'straddle'
    this.computeRange()
    // widen to include both structures' breakevens
    this.xMin = Math.min(this.xMin, 88)
    this.xMax = Math.max(this.xMax, 112)
    this.curveG.clear()
    this.shadeG.clear()
    const strad = straddle(100, 4, 3, 'long')
    const stran = strangle(95, 105, 1.25, 1.75, 'long')
    this.strokePath(this.curveG, this.curvePoints(strad), C.green, 3)
    this.strokePath(this.curveG, this.curvePoints(stran), C.blue, 2.5)
    // legend chips
    this.label(this.plot.l + 8, this.plot.t + 10, 'straddle (cost 7)', { size: 11, col: C.green, bold: true })
    this.label(this.plot.l + 8, this.plot.t + 28, 'strangle (cost 3)', { size: 11, col: C.blue, bold: true })
    // strikes
    for (const k of [95, 100, 105]) this.dashLineV(this.curveG, this.xFor(k), this.plot.t, this.plot.b, C.blue, 0.4)
  }

  // --- leg-merge animation (modules 2, 3, 6) --------------------------------
  private animateLegMerge(): void {
    const legs = this.legs()
    const isStraddle = this.structure === 'straddle'

    // single-leg ghost payoffs (each leg drawn in isolation)
    const legA: Leg = legs[0]
    const legB: Leg = legs[1]
    const ptsA = this.curvePoints([legA])
    const ptsB = this.curvePoints([legB])

    const gA = this.add.graphics()
    const gB = this.add.graphics()
    this.strokePath(gA, ptsA, C.green, 2, 0.55)
    gA.alpha = 0
    this.tweens.add({ targets: gA, alpha: 1, duration: 700 })

    const labA = isStraddle ? `long ${legA.type} (−${fmt(legA.premium)})` : `OTM put (kink ${fmt(legA.K)})`
    const labB = isStraddle ? `long ${legB.type} (−${fmt(legB.premium)})` : `OTM call (kink ${fmt(legB.K)})`
    this.fadeIn(this.label(this.plot.l + 8, this.plot.t + 10, labA, { size: 11, col: C.green }))

    this.time.delayedCall(900, () => {
      this.strokePath(gB, ptsB, C.green, 2, 0.55)
      gB.alpha = 0
      this.tweens.add({ targets: gB, alpha: 1, duration: 700 })
      this.fadeIn(this.label(this.plot.l + 8, this.plot.t + 28, labB, { size: 11, col: C.green }))
    })

    // sum into the combined curve
    this.time.delayedCall(1900, () => {
      this.redraw()
      this.curveG.alpha = 0
      this.tweens.add({ targets: this.curveG, alpha: 1, duration: 900, ease: 'Back.out' })
      this.tweens.add({ targets: [gA, gB], alpha: 0.18, duration: 600 })
      if (this.p.ghostStraddle) this.drawGhost()
      // cost ledger
      const total = totalPremium(legs)
      const ledger = isStraddle
        ? `cost = ${fmt(legA.premium)} + ${fmt(legB.premium)} = ${fmt(total)}  (×100 = $${total * 100})`
        : `cost = ${fmt(this.putPremiumS)} + ${fmt(this.callPremiumS)} = ${fmt(total)}  (×100 = $${total * 100})`
      this.fadeIn(this.label(this.plot.l + 8, this.plot.b - 14, ledger, { size: 12, col: C.blue, bold: true }), 300)
    })

    this.time.delayedCall(3000, () => this.maybeShowBreakevens(true))
  }

  // --- draggable dot --------------------------------------------------------
  private addDraggableDot(): void {
    const legs = this.legs()
    this.dotPrice = Phaser.Math.Clamp(this.dotPrice, this.xMin, this.xMax)
    const pnl = combinedPnL(legs, this.dotPrice)
    this.dot = this.add.circle(this.xFor(this.dotPrice), this.yFor(pnl), 9, C.blue).setStrokeStyle(3, C.white)
    this.dot.setInteractive({ useHandCursor: true, draggable: true })
    this.input.setDraggable(this.dot)
    this.dot.on('drag', (_p: Phaser.Input.Pointer, dx: number) => {
      const t = Phaser.Math.Clamp((dx - this.plot.l) / this.plot.w, 0, 1)
      this.dotPrice = this.xMin + t * (this.xMax - this.xMin)
      this.updateDot()
    })
    this.dotLabel = this.label(0, 0, '', { size: 12, col: C.ink, bold: true, align: 'center' })
    const hint = this.label(this.plot.r, this.plot.t - 2, 'drag the dot →', { size: 11, col: C.muted, align: 'right' })
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 })
    this.updateDot()
  }

  private updateDot(): void {
    if (!this.dot || !this.dotLabel) return
    const legs = this.legs()
    this.dotPrice = Phaser.Math.Clamp(this.dotPrice, this.xMin, this.xMax)
    const pnl = combinedPnL(legs, this.dotPrice)
    const x = this.xFor(this.dotPrice)
    const y = this.yFor(pnl)
    this.dot.setPosition(x, y)
    const profit = pnl > 0.001
    this.dot.setFillStyle(profit ? C.green : pnl < -0.001 ? C.red : C.blue)
    this.dotLabel.setPosition(x, y - 18)
    this.dotLabel.setColor(hex(profit ? C.green : pnl < -0.001 ? C.red : C.muted))
    this.dotLabel.setText(`S=${fmt(this.dotPrice)}  P&L ${fmtSigned(pnl)} (${fmtDollars(pnl)})`)
  }

  // --- in-canvas sliders ----------------------------------------------------
  private buildSliders(cfgs: SliderCfg[]): void {
    const baseY = this.H - 70
    const colW = Math.min(220, (this.plot.w - 20) / Math.min(cfgs.length, 3))
    cfgs.slice(0, 3).forEach((cfg, i) => {
      const x = this.plot.l + i * colW
      const valueText = this.label(x, baseY - 16, '', { size: 12, col: C.ink, bold: true })
      const startVal = this.currentSliderValue(cfg.key)
      const update = (v: number) => {
        this.applySlider(cfg.key, v)
        valueText.setText(`${cfg.label}: ${fmt(this.currentSliderValue(cfg.key))}`)
        this.redraw()
        this.maybeShowBreakevens(false)
        this.refreshReadout()
      }
      this.slider(x, baseY + 8, colW - 24, cfg.min, cfg.max, startVal, update, { step: cfg.step })
      valueText.setText(`${cfg.label}: ${fmt(startVal)}`)
    })
    // live readout line
    this.readoutText = this.label(this.plot.l, this.H - 96, '', { size: 12, col: C.blue, bold: true })
    this.refreshReadout()
  }

  private currentSliderValue(key: SliderCfg['key']): number {
    switch (key) {
      case 'K': return this.K
      case 'callPremium': return this.callPremium
      case 'putPremium': return this.putPremium
      case 'Kc': return this.Kc
      case 'Kp': return this.Kp
      case 'spread': return (this.Kc - this.Kp) / 2
      case 'total': return totalPremium(this.legs())
    }
  }

  private applySlider(key: SliderCfg['key'], v: number): void {
    switch (key) {
      case 'K': this.K = v; break
      case 'callPremium': this.callPremium = v; break
      case 'putPremium': this.putPremium = v; break
      case 'Kc': this.Kc = Math.max(v, this.Kp + 0.5); break
      case 'Kp': this.Kp = Math.min(v, this.Kc - 0.5); break
      case 'spread': {
        // move both strikes symmetrically around 100; cheaper as they widen
        this.Kp = 100 - v
        this.Kc = 100 + v
        // wider OTM => cheaper legs (illustrative): total ≈ max(0.5, 8 - v)
        const t = Math.max(0.5, 8 - v)
        this.putPremiumS = t * (1.25 / 3)
        this.callPremiumS = t * (1.75 / 3)
        break
      }
      case 'total': {
        // scale straddle premiums to hit the requested total, keeping the 4:3 ratio
        if (this.structure === 'straddle') {
          this.callPremium = v * (4 / 7)
          this.putPremium = v * (3 / 7)
        } else {
          this.putPremiumS = v * (1.25 / 3)
          this.callPremiumS = v * (1.75 / 3)
        }
        break
      }
    }
  }

  private refreshReadout(): void {
    if (!this.readoutText) return
    const legs = this.legs()
    const be = breakevens(legs)
    const total = totalPremium(legs)
    this.readoutText.setText(
      `cost ${fmt(total)} (×100 = $${Math.round(total * 100)})   ·   breakevens ${fmt(be.lower)} / ${fmt(be.upper)}`,
    )
  }

  // --- quiz mask + reveal ---------------------------------------------------
  private drawQuizMask(): void {
    // Hide where the arms cross zero (the breakevens) behind two blue panels.
    const y0 = this.yFor(0)
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 0.96)
    // cover the left and right lower regions around the x-axis where BEs sit
    const bandH = 70
    g.fillRect(this.plot.l, y0 - bandH / 2, this.plot.w, bandH)
    g.lineStyle(1.5, C.blue, 0.5)
    g.strokeRect(this.plot.l, y0 - bandH / 2, this.plot.w, bandH)
    const q = this.add
      .text(this.plot.l + this.plot.w / 2, y0, 'breakevens hidden — your call', {
        fontFamily: FONT,
        fontSize: '14px',
        color: hex(C.blue),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.maskG = this.add.container(0, 0, [g, q])
    // The curve is already drawn (build() ran redraw()/drawCompareBoth()); just keep
    // the mask on top so the V/valley shape stays visible but the breakevens are hidden.
    this.children.bringToTop(this.maskG)
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true
    if (this.maskG) {
      this.tweens.add({
        targets: this.maskG,
        alpha: 0,
        duration: 420,
        onComplete: () => this.maskG?.destroy(),
      })
    }
    this.time.delayedCall(220, () => {
      this.p.showBreakevens = true
      if (this.p.compareBoth) {
        this.revealCompareBreakevens()
      } else {
        // snap breakevens in
        this.drawBreakevens(true)
        // flash the loss interior
        const legs = this.legs()
        const total = totalPremium(legs)
        const midX = this.structure === 'straddle' ? this.xFor(this.K) : this.xFor((this.Kp + this.Kc) / 2)
        const flash = this.add.circle(midX, this.yFor(-total), 10, C.red).setAlpha(0)
        this.tweens.add({ targets: flash, alpha: 1, scale: 1.6, duration: 240, yoyo: true, repeat: 2 })
      }
    })
  }

  /** Module 8: snap both structures' breakevens in and draw measuring arrows from 100. */
  private revealCompareBreakevens(): void {
    const strad = straddle(100, 4, 3, 'long')
    const stran = strangle(95, 105, 1.25, 1.75, 'long')
    const beS = breakevens(strad)
    const beT = breakevens(stran)
    const y0 = this.yFor(0)
    for (const [px, lab, col] of [
      [beS.upper, 'straddle BE 107', C.green],
      [beS.lower, 'straddle BE 93', C.green],
      [beT.upper, 'strangle BE 108', C.blue],
      [beT.lower, 'strangle BE 92', C.blue],
    ] as const) {
      const x = this.xFor(px)
      this.dashLineV(this.beG, x, this.plot.t, this.plot.b, col, 1, 8, 6)
      this.beLabels.push(this.label(x, this.plot.t - 2, lab, { size: 10, col, bold: true, align: 'center' }))
    }
    // measuring arrows from 100 to each nearest upper breakeven
    const x100 = this.xFor(100)
    this.measureArrow(x100, this.xFor(beS.upper), y0 - 18, C.green, '7')
    this.measureArrow(x100, this.xFor(beT.upper), y0 - 40, C.blue, '8 (cheaper, farther)')
  }

  private measureArrow(x1: number, x2: number, y: number, col: number, label: string): void {
    const g = this.add.graphics()
    g.lineStyle(2, col, 1)
    g.lineBetween(x1, y, x2, y)
    g.fillStyle(col, 1)
    g.fillTriangle(x2 - 7, y - 4, x2 - 7, y + 4, x2, y)
    g.fillTriangle(x1 + 7, y - 4, x1 + 7, y + 4, x1, y)
    this.label((x1 + x2) / 2, y - 9, label, { size: 10, col, bold: true, align: 'center' })
  }
}
