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

  /**
   * CHALLENGE mode — interactive self-grading (type:'challenge'). One of:
   *  - 'breakevens' : drag the two breakeven markers onto where the V crosses zero (M5)
   *  - 'compareMove': choose straddle vs strangle for a given expected move, run it (M8)
   *  - 'pickVol'    : choose long-vol vs short-vol for a scenario, run it (M13)
   */
  challenge?: 'breakevens' | 'compareMove' | 'pickVol'
  /** compareMove: the expected absolute move from 100 (e.g. 6 → S lands at 106). */
  expectedMove?: number
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

  // --- challenge state ---
  private graded = false
  /** M5: learner-dragged breakeven guesses (prices). */
  private beGuessLo = 90
  private beGuessHi = 110
  /** M8/M13: learner's structure/side pick. */
  private pick: 'straddle' | 'strangle' | null = null
  private volPick: 'long' | 'short' | null = null
  private pickBtns: Array<{
    key: string
    bg: Phaser.GameObjects.Graphics
    txt: Phaser.GameObjects.Text
    x: number
    y: number
    w: number
  }> = []
  private beHandleRedraws: Array<() => void> = []

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
      // In quiz/challenge mode the breakevens are the answer, so don't draw them yet.
      if (!this.p.quiz && this.p.challenge !== 'breakevens') this.maybeShowBreakevens(true)
    }

    if (this.p.quiz) this.drawQuizMask()
    if (this.p.draggableDot && !this.p.quiz && !this.p.challenge) this.addDraggableDot()
    if (this.p.sliders && !this.p.quiz && !this.p.challenge) this.buildSliders(this.p.sliders)

    // Challenge setup (interactive controls + enable Submit). Only when a challenge
    // param is present, so the shared TEACH/QUIZ modules are untouched.
    if (this.p.challenge === 'breakevens') this.setupBreakevenChallenge()
    else if (this.p.challenge === 'compareMove') this.setupCompareChallenge()
    else if (this.p.challenge === 'pickVol') this.setupPickVolChallenge()

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

  protected onSubmit(): void {
    if (this.graded) return
    if (this.p.challenge === 'breakevens') this.gradeBreakevens()
    else if (this.p.challenge === 'compareMove') this.gradeCompare()
    else if (this.p.challenge === 'pickVol') this.gradePickVol()
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

  // ===================== CHALLENGE: M5 — drag the breakevens =================

  /** Convert a screen-x back to a price (inverse of xFor), clamped to the window. */
  private priceFor(x: number): number {
    const cx = Phaser.Math.Clamp(x, this.plot.l, this.plot.r)
    const t = (cx - this.plot.l) / this.plot.w
    return this.xMin + t * (this.xMax - this.xMin)
  }

  /**
   * M5 — two draggable vertical breakeven markers. The learner slides each onto where
   * the V crosses zero; onSubmit grades both vs the exact breakevens (93 / 107) and
   * confirms the vertex (max loss −7 at K=100). The curve + zero line are already drawn.
   */
  private setupBreakevenChallenge(): void {
    // Sensible starting guesses, away from the real answers so it's a real task.
    this.beGuessLo = Math.max(this.xMin + 2, this.K - 12)
    this.beGuessHi = Math.min(this.xMax - 2, this.K + 12)

    this.makeBEHandle(() => this.beGuessLo, (v) => (this.beGuessLo = v))
    this.makeBEHandle(() => this.beGuessHi, (v) => (this.beGuessHi = v))

    this.label(this.plot.l, this.plot.t - 4, 'drag the two markers to where P&L = 0', {
      size: 11, col: C.muted,
    })
    this.setCanSubmit(true)
  }

  private makeBEHandle(get: () => number, set: (v: number) => void): void {
    const y0 = this.yFor(0)
    const lineG = this.add.graphics()
    const knob = this.add.circle(0, y0, 10, C.blue).setStrokeStyle(3, C.white)
    const lbl = this.label(0, this.plot.t - 18, '', { size: 12, col: C.blue, bold: true, align: 'center' })
    // Wide invisible vertical hit strip so the whole marker is grabbable.
    const hit = this.add.rectangle(0, this.plot.t + this.plot.h / 2, 26, this.plot.h, 0x000000, 0)
      .setInteractive({ useHandCursor: true })

    const redraw = () => {
      const price = get()
      const x = this.xFor(price)
      lineG.clear()
      lineG.lineStyle(2, C.blue, this.graded ? 0.35 : 1)
      for (let yy = this.plot.t; yy < this.plot.b; yy += 11) lineG.lineBetween(x, yy, x, Math.min(yy + 6, this.plot.b))
      knob.setPosition(x, y0)
      knob.setAlpha(this.graded ? 0.5 : 1)
      lbl.setPosition(x, this.plot.t - 18)
      lbl.setText(`${fmt(price)}`)
      hit.x = x
    }
    redraw()

    let dragging = false
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.graded) return
      dragging = true
      set(this.priceFor(p.x))
      redraw()
    })
    const onMove = (p: Phaser.Input.Pointer) => {
      if (dragging) { set(this.priceFor(p.x)); redraw() }
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
    // store redraw so grading can dim the handles
    this.beHandleRedraws.push(redraw)
  }

  private gradeBreakevens(): void {
    this.graded = true
    this.setCanSubmit(false)
    const legs = this.legs()
    const be = breakevens(legs)
    const total = totalPremium(legs)
    // Snap the learner's two guesses to lower/upper.
    const guessLo = Math.min(this.beGuessLo, this.beGuessHi)
    const guessHi = Math.max(this.beGuessLo, this.beGuessHi)
    this.beGuessLo = guessLo
    this.beGuessHi = guessHi
    for (const redraw of this.beHandleRedraws) redraw()

    const tol = 1.0 // ±1 price unit is "on the breakeven"
    const okLo = Math.abs(guessLo - be.lower) <= tol
    const okHi = Math.abs(guessHi - be.upper) <= tol
    const correct = okLo && okHi

    // Draw the TRUE breakevens in (animated) + flash the vertex / max loss.
    this.p.showBreakevens = true
    this.drawBreakevens(true)
    const midX = this.xFor(this.K)
    const flash = this.add.circle(midX, this.yFor(-total), 10, C.red).setAlpha(0)
    this.tweens.add({ targets: flash, alpha: 1, scale: 1.6, duration: 240, yoyo: true, repeat: 2 })
    this.label(midX, this.yFor(-total) + 30, `vertex: max loss ${fmtSigned(-total)} at K=${fmt(this.K)}`, {
      size: 11, col: C.red, bold: true, align: 'center',
    })

    const title = correct
      ? `Both breakevens nailed · ${fmt(be.lower)} / ${fmt(be.upper)}`
      : `Off — the breakevens are ${fmt(be.lower)} / ${fmt(be.upper)}`
    const detail = correct
      ? `Right where the V crosses zero. Breakevens = K ± total premium = ${fmt(this.K)} ± ${fmt(total)} = ${fmt(be.lower)} and ${fmt(be.upper)}. The vertex sits at (${fmt(this.K)}, ${fmtSigned(-total)}) — pin at the strike and you lose the full ${fmt(total)} premium (${fmtDollars(-total)}). You must move MORE than the premium to profit.`
      : `You placed ${fmt(guessLo)} / ${fmt(guessHi)}; the V crosses zero at ${fmt(be.lower)} / ${fmt(be.upper)}. Breakevens = K ± TOTAL premium = ${fmt(this.K)} ± ${fmt(total)} (not one leg). Max loss is the vertex ${fmtSigned(-total)} at K=${fmt(this.K)} — you must clear a breakeven, not merely move.`
    this.report(correct, title, detail)
  }

  // ===================== CHALLENGE: M8 — straddle vs strangle ================

  /**
   * M8 — both structures are drawn (compareBoth). A target price for the expected move
   * is marked; the learner picks straddle or strangle, then Submit runs the move and
   * grades which one actually profits at that price (cheaper-but-needs-more tradeoff).
   */
  private setupCompareChallenge(): void {
    const move = this.p.expectedMove ?? 6
    const S = 100 + move
    // mark the expected landing price (label at the TOP of the plot to clear the axis)
    const x = this.xFor(S)
    const g = this.add.graphics()
    this.dashLineV(g, x, this.plot.t, this.plot.b, C.ink, 0.8, 7, 5)
    this.label(x, this.plot.t + 8, `expected → S = ${fmt(S)}`, {
      size: 11, col: C.ink, bold: true, align: 'center',
    })

    // pick buttons along the bottom strip (clear of the x-axis title at plot.b+28)
    const by = this.H - 26
    this.makePickButton('straddle', 'Straddle (cost 7)', this.plot.l + 30, by, 210, C.green, () => {
      this.pick = 'straddle'; this.refreshPickButtons()
    })
    this.makePickButton('strangle', 'Strangle (cost 3)', this.plot.l + 270, by, 210, C.blue, () => {
      this.pick = 'strangle'; this.refreshPickButtons()
    })
    this.refreshPickButtons()
    this.setCanSubmit(false)
  }

  private gradeCompare(): void {
    const pick = this.pick
    if (!pick) return
    this.graded = true
    this.setCanSubmit(false)
    const move = this.p.expectedMove ?? 6
    const S = 100 + move
    const strad = straddle(100, 4, 3, 'long')
    const stran = strangle(95, 105, 1.25, 1.75, 'long')
    const pnlStrad = combinedPnL(strad, S)
    const pnlStran = combinedPnL(stran, S)
    const chosen = pick === 'straddle' ? pnlStrad : pnlStran
    // Best structure AT THIS PRICE = whichever has the higher P&L.
    const best: 'straddle' | 'strangle' = pnlStrad >= pnlStran ? 'straddle' : 'strangle'
    const correct = pick === best

    // Reveal both breakevens + drop a dot for each structure at S.
    this.revealCompareBreakevens()
    for (const [legs, col] of [[strad, C.green], [stran, C.blue]] as const) {
      const pnl = Phaser.Math.Clamp(combinedPnL(legs, S), this.yMin, this.yMax)
      const dot = this.add.circle(this.xFor(S), this.yFor(pnl), 7, col).setStrokeStyle(2, C.white)
      dot.setScale(0)
      this.tweens.add({ targets: dot, scale: 1, duration: 300, ease: 'Back.out' })
    }

    const title = correct
      ? `${capitalize(pick)} wins at S=${fmt(S)} · ${fmtSigned(chosen)}`
      : `${capitalize(pick)} loses here · ${fmtSigned(chosen)}`
    const detail =
      `At S=${fmt(S)}: straddle P&L ${fmtSigned(pnlStrad)} (${fmtDollars(pnlStrad)}), strangle P&L ${fmtSigned(pnlStran)} (${fmtDollars(pnlStran)}). ` +
      (move < 8
        ? `This move clears the straddle's 107 breakeven but NOT the strangle's 108. The cheaper strangle (cost 3) needs the bigger move to escape its 92/108 band — cost vs move. `
        : `A move this big clears both bands; the cheaper strangle (cost 3) keeps more because it paid less premium. `) +
      `Breakeven DISTANCE, not price tag, decides: straddle BE 93/107 (7 from 100), strangle BE 92/108 (8 from 100).`
    this.report(correct, title, detail)
  }

  // ===================== CHALLENGE: M13 — long vs short vol ==================

  /**
   * M13 — a "pin near 100, rich IV" scenario. The learner picks LONG VOL or SHORT VOL;
   * Submit redraws the chosen payoff, walks the dot to the expected pin (S≈100), and
   * grades: short vol fits a pin (collect premium) but carries large risk; long vol is
   * the IV-crush trap here.
   */
  private setupPickVolChallenge(): void {
    // mark the expected pin at 100 (label at top of plot, clear of the axis)
    const xg = this.add.graphics()
    this.dashLineV(xg, this.xFor(100), this.plot.t, this.plot.b, C.ink, 0.8, 7, 5)
    this.label(this.xFor(100), this.plot.t + 8, 'expected pin → S = 100', {
      size: 11, col: C.ink, bold: true, align: 'center',
    })

    const by = this.H - 26
    this.makePickButton('long', 'LONG VOL (buy)', this.plot.l + 30, by, 210, C.green, () => {
      this.volPick = 'long'; this.refreshPickButtons()
    })
    this.makePickButton('short', 'SHORT VOL (sell)', this.plot.l + 270, by, 210, C.red, () => {
      this.volPick = 'short'; this.refreshPickButtons()
    })
    this.refreshPickButtons()
    this.setCanSubmit(false)
  }

  private gradePickVol(): void {
    const volPick = this.volPick
    if (!volPick) return
    this.graded = true
    this.setCanSubmit(false)
    // Rebuild the payoff for the chosen side and reveal its breakevens.
    this.side = volPick
    this.redraw()
    this.p.showBreakevens = true
    this.drawBreakevens(true)

    // Walk a dot to the expected pin (S = 100, the strike).
    const S = 100
    const pnl = combinedPnL(this.legs(), S)
    const dotCol = volPick === 'short' ? C.green : C.red
    const dotY = this.yFor(Phaser.Math.Clamp(pnl, this.yMin, this.yMax))
    const dot = this.add.circle(this.xFor(S), dotY, 8, dotCol).setStrokeStyle(3, C.white)
    dot.setScale(0)
    this.tweens.add({ targets: dot, scale: 1, duration: 320, ease: 'Back.out' })
    this.label(this.xFor(S), dotY - 18, `pin S=100 · P&L ${fmtSigned(pnl)} (${fmtDollars(pnl)})`,
      { size: 11, col: dotCol, bold: true, align: 'center' })

    const correct = volPick === 'short'
    const title = correct
      ? `Short vol fits the pin · ${fmtSigned(pnl)} at S=100`
      : `Long vol is the wrong side here · ${fmtSigned(pnl)} at S=100`
    const detail = correct
      ? `Right call for a confident pin + rich IV: SELLING the straddle keeps the full ${fmt(totalPremium(this.legs()))} premium (${fmtDollars(totalPremium(this.legs()))}) if the stock stays inside 93–107, and IV crush works FOR you. The caveat the payoff shows: the inverted tent has large/undefined risk if the move is bigger than you expect — only right when you truly expect quiet.`
      : `Buying the straddle into a pin is the IV-crush trap (module 11): you pay 7 of rich premium for a move that never comes, so a pin at 100 loses the full ${fmt(totalPremium(straddle(100, 4, 3, 'long')))} (${fmtDollars(-totalPremium(straddle(100, 4, 3, 'long')))}). For an expected pin + rich IV, SELL the premium (short vol) — accepting its large tail risk — or stay flat.`
    this.report(correct, title, detail)
  }

  // --- shared pick-button helpers (M8 / M13) --------------------------------
  private makePickButton(key: string, label: string, x: number, y: number, w: number, col: number, on: () => void): void {
    const bg = this.add.graphics()
    const txt = this.add.text(x + w / 2, y, label, {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold',
    }).setOrigin(0.5)
    const hit = this.add.rectangle(x + w / 2, y, w, 34, 0x000000, 0).setInteractive({ useHandCursor: true })
    hit.on('pointerup', () => { if (!this.graded) on() })
    this.pickBtns.push({ key, bg, txt, x, y, w })
    // colour stashed on the object for refresh
    ;(bg as Phaser.GameObjects.Graphics & { _col?: number })._col = col
  }

  private refreshPickButtons(): void {
    const selectedKey = this.pick ?? this.volPick
    let any = false
    for (const b of this.pickBtns) {
      const col = (b.bg as Phaser.GameObjects.Graphics & { _col?: number })._col ?? C.blue
      const selected = b.key === selectedKey
      if (selected) any = true
      b.bg.clear()
      b.bg.fillStyle(selected ? col : C.white, 1)
      b.bg.fillRoundedRect(b.x, b.y - 17, b.w, 34, 9)
      b.bg.lineStyle(2, selected ? col : C.hairline)
      b.bg.strokeRoundedRect(b.x, b.y - 17, b.w, 34, 9)
      b.txt.setColor(hex(selected ? C.white : col))
    }
    if (any) this.setCanSubmit(true)
  }
}

/** Capitalise the first letter (for banner titles). */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
