import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'
import { intrinsic, pnlPerShare, breakeven, maxLoss, maxGain, type OptType, type Side } from './optionMath'

/**
 * PayoffParams — drives the workhorse P&L-vs-price diagram.
 *  x = underlying price S at expiry, y = profit/loss per share (×100 = per contract).
 *
 * Modes:
 *  - 'teach'        full draw-in + the long↔short reflection demo when `showMirror`.
 *  - 'interactive'  in-canvas sliders (K, premium) + LONG/SHORT + CALL/PUT toggles,
 *                   a draggable "spot at expiry" dot with a live P&L readout.
 *  - 'quiz'         draws the masked setup; onReveal() snaps the hidden breakeven /
 *                   completes the leg.
 *  - 'challenge'    self-grading interactive (see `challenge`): either an EXERCISE vs
 *                   LET-EXPIRE decision (challenge:'exercise') or a draggable breakeven
 *                   marker (challenge:'breakeven'). onSubmit() simulates + reports.
 */
export interface PayoffParams {
  type?: OptType
  side?: Side
  K?: number
  premium?: number
  /** Visible price range on the x-axis. */
  sMin?: number
  sMax?: number
  mode?: 'teach' | 'interactive' | 'quiz' | 'challenge'
  /** teach: animate long → reflected short to show the flip. */
  showMirror?: boolean
  /** interactive: allow in-canvas controls + draggable spot dot. */
  controls?: boolean
  /** interactive: show the CALL/PUT + LONG/SHORT segmented toggles (default true). */
  legToggles?: boolean
  /** interactive: starting spot for the draggable dot. */
  spot0?: number
  /** quiz: hide the breakeven marker until reveal. */
  hideBreakeven?: boolean
  /** quiz: distractor price dots to expose on reveal {S, label, good}. */
  revealDots?: Array<{ S: number; label: string; good?: boolean }>
  /** challenge variant. 'exercise' = exercise-vs-expire buttons; 'breakeven' = drag a marker. */
  challenge?: 'exercise' | 'breakeven'
  /** challenge:'exercise' — the underlying price at expiry the decision is made at. */
  expiryS?: number
}

const PAD = { left: 56, right: 18, top: 46, bottom: 76 }

export default class PayoffScene extends ModuleScene {
  protected p!: Required<Pick<PayoffParams, 'type' | 'side' | 'K' | 'premium' | 'sMin' | 'sMax' | 'mode'>> &
    PayoffParams

  // plot rect / scales
  protected plot = { l: 0, r: 0, t: 0, b: 0, w: 0, h: 0 }
  protected yMin = 0
  protected yMax = 1

  // live graphics handles
  private curve!: Phaser.GameObjects.Graphics
  private shade!: Phaser.GameObjects.Graphics
  private beMarker?: Phaser.GameObjects.Container
  private spotDot?: Phaser.GameObjects.Arc
  private spotGuide?: Phaser.GameObjects.Graphics
  private pnlLabel?: Phaser.GameObjects.Text
  private riskBadge?: Phaser.GameObjects.Container
  private revealed = false

  // --- challenge state ---
  private submitted = false
  /** challenge:'exercise' — current pick (true = exercise, false = let expire). */
  private exercisePick = false
  private exerciseBtns: Array<{
    key: 'exercise' | 'expire'
    bg: Phaser.GameObjects.Graphics
    txt: Phaser.GameObjects.Text
    x: number
    y: number
    w: number
    h: number
  }> = []
  /** challenge:'breakeven' — current dragged guess for the breakeven price. */
  private beGuess = 0
  private beGuessLine?: Phaser.GameObjects.Graphics
  private beGuessDot?: Phaser.GameObjects.Arc
  private beGuessLabel?: Phaser.GameObjects.Text

  protected build(): void {
    const raw = this.params as PayoffParams
    this.p = {
      ...raw,
      type: raw.type ?? 'call',
      side: raw.side ?? 'long',
      K: raw.K ?? 100,
      premium: raw.premium ?? 5,
      sMin: raw.sMin ?? 70,
      sMax: raw.sMax ?? 130,
      mode: raw.mode ?? 'teach',
    }

    this.plot = {
      l: PAD.left,
      r: this.W - PAD.right,
      t: PAD.top,
      b: this.H - PAD.bottom,
      w: this.W - PAD.left - PAD.right,
      h: this.H - PAD.top - PAD.bottom,
    }
    this.computeY()
    this.drawAxes()
    this.drawTitle()

    this.curve = this.add.graphics()
    this.shade = this.add.graphics()

    if (this.p.mode === 'quiz') {
      this.drawQuizSetup()
    } else if (this.p.mode === 'challenge') {
      this.buildChallenge()
    } else {
      this.redraw()
      if (this.p.mode === 'interactive' && this.p.controls && this.p.legToggles !== false) this.buildControls()
      if (this.p.controls) this.buildSpotDot(this.p.spot0 ?? this.p.K)
      if (this.p.mode === 'teach' && this.p.showMirror) this.runMirrorDemo()
      else this.animateCurveIn()
    }
    this.emitReady()
  }

  // === Challenge mode =======================================================
  private buildChallenge(): void {
    // Always draw the full payoff curve so the learner can reason about it.
    this.redraw()
    this.animateCurveIn()
    if (this.p.challenge === 'breakeven') this.buildBreakevenChallenge()
    else this.buildExerciseChallenge()
    this.setCanSubmit(true)
  }

  // --- challenge:'exercise' — EXERCISE vs LET EXPIRE buttons -----------------
  private buildExerciseChallenge(): void {
    const expiryS = this.p.expiryS ?? this.p.K
    // Mark where the stock landed at expiry with a vertical guide.
    const xS = this.xFor(expiryS)
    const g = this.add.graphics()
    g.lineStyle(1.5, C.ink, 0.5)
    for (let yy = this.plot.t; yy < this.plot.b; yy += 10) g.lineBetween(xS, yy, xS, Math.min(yy + 6, this.plot.b))
    this.label(xS, this.plot.t - 6, `S=${expiryS} at expiry`, { size: 11, col: C.ink, bold: true, align: 'center' })

    const defs: Array<{ key: 'exercise' | 'expire'; label: string }> = [
      { key: 'exercise', label: 'EXERCISE' },
      { key: 'expire', label: 'LET EXPIRE' },
    ]
    const w = 150
    const h = 38
    const gap = 16
    const totalW = w * defs.length + gap
    let x = (this.plot.l + this.plot.r) / 2 - totalW / 2
    const y = this.H - 30
    for (const d of defs) {
      const bg = this.add.graphics()
      const txt = this.add
        .text(x + w / 2, y, d.label, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold' })
        .setOrigin(0.5)
      const hit = this.add
        .rectangle(x + w / 2, y, w, h, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => {
        if (this.submitted) return
        this.exercisePick = d.key === 'exercise'
        this.refreshExerciseBtns()
      })
      this.exerciseBtns.push({ key: d.key, bg, txt, x, y, w, h })
      x += w + gap
    }
    this.refreshExerciseBtns()
  }

  private refreshExerciseBtns(): void {
    for (const b of this.exerciseBtns) {
      const selected = (this.exercisePick && b.key === 'exercise') || (!this.exercisePick && b.key === 'expire')
      const fill = selected ? C.blue : C.white
      b.bg.clear()
      b.bg.fillStyle(fill, 1)
      b.bg.fillRoundedRect(b.x, b.y - b.h / 2, b.w, b.h, 10)
      b.bg.lineStyle(1.5, selected ? C.blue : C.hairline)
      b.bg.strokeRoundedRect(b.x, b.y - b.h / 2, b.w, b.h, 10)
      b.txt.setColor(hex(selected ? C.white : C.muted))
    }
  }

  // --- challenge:'breakeven' — drag a marker to where P&L crosses zero -------
  private buildBreakevenChallenge(): void {
    // Start the guess at the strike (a tempting-but-wrong anchor).
    this.beGuess = this.p.K
    this.beGuessLine = this.add.graphics()
    const y0 = this.yFor(0)
    this.beGuessDot = this.add
      .circle(this.xFor(this.beGuess), y0, 8, C.blue)
      .setStrokeStyle(3, C.white)
      .setInteractive({ useHandCursor: true, draggable: true })
    this.input.setDraggable(this.beGuessDot)
    this.beGuessLabel = this.label(0, this.plot.t + 22, '', { size: 12, col: C.blue, bold: true, align: 'center' })
    this.beGuessDot.on('drag', (_p: Phaser.Input.Pointer, dx: number) => {
      if (this.submitted) return
      const t = Phaser.Math.Clamp((dx - this.plot.l) / this.plot.w, 0, 1)
      this.beGuess = this.p.sMin + t * (this.p.sMax - this.p.sMin)
      this.redrawBeGuess()
    })
    this.redrawBeGuess()
    this.label((this.plot.l + this.plot.r) / 2, this.H - 26, '↔ drag the marker to where the line crosses $0', {
      size: 11,
      col: C.muted,
      align: 'center',
    })
  }

  private redrawBeGuess(): void {
    if (!this.beGuessLine || !this.beGuessDot || !this.beGuessLabel) return
    const x = this.xFor(this.beGuess)
    const y0 = this.yFor(0)
    this.beGuessLine.clear()
    this.beGuessLine.lineStyle(1.6, C.blue, 0.9)
    for (let yy = this.plot.t; yy < this.plot.b; yy += 12)
      this.beGuessLine.lineBetween(x, yy, x, Math.min(yy + 7, this.plot.b))
    this.beGuessDot.setPosition(x, y0)
    this.beGuessLabel.setX(x).setText(`your BE ${this.fmt(this.beGuess)}`)
  }

  // --- scales ---------------------------------------------------------------
  /** y-range covers the worst loss / best plotted gain across the visible S range. */
  protected computeY(): void {
    const pos = { type: this.p.type, side: this.p.side, K: this.p.K, premium: this.p.premium }
    let lo = 0
    let hi = 0
    for (let i = 0; i <= 40; i++) {
      const S = this.p.sMin + ((this.p.sMax - this.p.sMin) * i) / 40
      const v = pnlPerShare(pos, S)
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
    // pad and keep zero visible; clamp so unlimited tails don't flatten the curve
    const span = Math.max(hi - lo, this.p.premium * 2, 8)
    this.yMin = lo - span * 0.12
    this.yMax = hi + span * 0.12
  }

  protected xFor(S: number): number {
    const t = (S - this.p.sMin) / (this.p.sMax - this.p.sMin)
    return this.plot.l + t * this.plot.w
  }
  protected yFor(v: number): number {
    const t = (v - this.yMin) / (this.yMax - this.yMin)
    return this.plot.b - t * this.plot.h
  }

  private titleText?: Phaser.GameObjects.Text
  protected drawTitle(): void {
    const label = `${this.p.side.toUpperCase()} ${this.p.type.toUpperCase()}  ·  K=${this.p.K}  ·  premium ${this.fmt(
      this.p.premium,
    )} (illustrative)`
    if (!this.titleText) this.titleText = this.label(this.plot.l, 20, label, { size: 13, col: C.ink, bold: true })
    else this.titleText.setText(label)
  }

  private drawAxes(): void {
    const g = this.add.graphics()
    // zero P&L line (grey)
    const y0 = this.yFor(0)
    g.lineStyle(1.5, C.gray200)
    g.lineBetween(this.plot.l, y0, this.plot.r, y0)
    // axis frame
    g.lineStyle(1, C.hairline)
    g.lineBetween(this.plot.l, this.plot.t, this.plot.l, this.plot.b)
    g.lineBetween(this.plot.l, this.plot.b, this.plot.r, this.plot.b)
    this.label(this.plot.l - 6, y0, '0', { size: 11, col: C.muted, align: 'right' })

    // y label
    this.add
      .text(16, this.plot.t + this.plot.h / 2, 'P&L / share', {
        fontFamily: FONT,
        fontSize: '11px',
        color: hex(C.muted),
      })
      .setOrigin(0.5)
      .setAngle(-90)
    // x ticks
    const ticks = 6
    for (let i = 0; i <= ticks; i++) {
      const S = this.p.sMin + ((this.p.sMax - this.p.sMin) * i) / ticks
      const x = this.xFor(S)
      g.lineStyle(1, C.gray100)
      g.lineBetween(x, this.plot.t, x, this.plot.b)
      this.label(x, this.plot.b + 12, S.toFixed(0), { size: 10, col: C.muted, align: 'center' })
    }
    this.label((this.plot.l + this.plot.r) / 2, this.plot.b + 30, 'underlying price S at expiry', {
      size: 11,
      col: C.muted,
      align: 'center',
    })

    this.strikeLayer = this.add.graphics()
    this.drawStrike()
  }

  private strikeLayer!: Phaser.GameObjects.Graphics
  private strikeLabel?: Phaser.GameObjects.Text
  /** Redrawable strike marker (so the capstone's K slider can move it live). */
  protected drawStrike(): void {
    const xk = this.xFor(this.p.K)
    this.strikeLayer.clear()
    this.strikeLayer.lineStyle(1.5, C.blue)
    for (let yy = this.plot.t; yy < this.plot.b; yy += 12)
      this.strikeLayer.lineBetween(xk, yy, xk, Math.min(yy + 7, this.plot.b))
    if (!this.strikeLabel) {
      this.strikeLabel = this.label(xk, this.plot.t - 6, `K=${this.p.K}`, {
        size: 11,
        col: C.blue,
        bold: true,
        align: 'center',
      })
    } else {
      this.strikeLabel.setText(`K=${this.p.K}`).setX(xk)
    }
  }

  // --- core curve + shading -------------------------------------------------
  /** Recompute y-scale, redraw curve + shading + breakeven + readouts. */
  protected redraw(): void {
    this.curve.clear()
    this.shade.clear()
    const pos = { type: this.p.type, side: this.p.side, K: this.p.K, premium: this.p.premium }
    const y0 = this.yFor(0)

    // sample payoff across the visible range (kinked at K so add K explicitly)
    const pts: Array<{ x: number; y: number; S: number; v: number }> = []
    const samples = [this.p.sMin, this.p.K, this.p.sMax]
    for (let i = 0; i <= 60; i++) samples.push(this.p.sMin + ((this.p.sMax - this.p.sMin) * i) / 60)
    samples.sort((a, b) => a - b)
    for (const S of samples) {
      const v = pnlPerShare(pos, S)
      pts.push({ x: this.xFor(S), y: this.yFor(v), S, v })
    }

    // shade profit (green) above zero, loss (red) below zero, between curve and 0-line
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const profit = (a.v + b.v) / 2 >= 0
      this.shade.fillStyle(profit ? C.green : C.red, 0.1)
      this.shade.beginPath()
      this.shade.moveTo(a.x, y0)
      this.shade.lineTo(a.x, a.y)
      this.shade.lineTo(b.x, b.y)
      this.shade.lineTo(b.x, y0)
      this.shade.closePath()
      this.shade.fillPath()
    }

    // the payoff line: green where profit, red where loss
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const profit = (a.v + b.v) / 2 >= 0
      this.curve.lineStyle(3, profit ? C.green : C.red)
      this.curve.lineBetween(a.x, a.y, b.x, b.y)
    }

    // unlimited tail arrow (short call rises off the loss side; long call upside)
    this.drawTails()
    this.drawBreakeven()
    this.drawRiskBadge()
  }

  private drawTails(): void {
    // short call: loss → ∞ as S rises; long call: gain → ∞
    const unlimitedLoss = this.p.side === 'short' && this.p.type === 'call'
    const unlimitedGain = this.p.side === 'long' && this.p.type === 'call'
    if (unlimitedLoss) {
      const x = this.xFor(this.p.sMax) - 10
      this.label(x, this.plot.b - 6, '⚠ loss → ∞', { size: 11, col: C.red, bold: true, align: 'right' })
    } else if (unlimitedGain) {
      const x = this.xFor(this.p.sMax) - 10
      this.label(x, this.plot.t + 10, '↑ gain unlimited', { size: 11, col: C.green, bold: true, align: 'right' })
    }
  }

  protected drawBreakeven(): void {
    this.beMarker?.destroy()
    if (this.p.hideBreakeven && !this.revealed) return
    const be = breakeven(this.p.type, this.p.K, this.p.premium)
    if (be < this.p.sMin || be > this.p.sMax) return
    const x = this.xFor(be)
    const y0 = this.yFor(0)
    const g = this.add.graphics()
    g.lineStyle(1.5, C.blue)
    for (let yy = this.plot.t; yy < this.plot.b; yy += 12) g.lineBetween(x, yy, x, Math.min(yy + 7, this.plot.b))
    const dot = this.add.circle(x, y0, 5, C.blue).setStrokeStyle(2, C.white)
    const t = this.label(x, this.plot.t + 22, `BE ${this.fmt(be)}`, {
      size: 11,
      col: C.blue,
      bold: true,
      align: 'center',
    })
    this.beMarker = this.add.container(0, 0, [g, dot, t])
    this.fadeIn(this.beMarker as unknown as Phaser.GameObjects.GameObject & { alpha: number; y: number })
  }

  private drawRiskBadge(): void {
    this.riskBadge?.destroy()
    const pos = { type: this.p.type, side: this.p.side, K: this.p.K, premium: this.p.premium }
    const ml = maxLoss(pos)
    const mg = maxGain(pos)
    const lossTxt = ml === Infinity ? 'UNLIMITED' : `$${ml.toLocaleString()}`
    const gainTxt = mg === Infinity ? 'unlimited' : `$${mg.toLocaleString()}`
    const danger = ml === Infinity
    const w = 232
    const h = 34
    const x = this.plot.r - w
    const y = this.plot.t - 2
    const panel = this.panel(x, y, w, h, {
      fill: danger ? C.redSoft : C.blueSoft,
      stroke: danger ? C.red : C.blue,
      radius: 8,
    })
    const t = this.label(x + 10, y + h / 2, `Max loss ${lossTxt}  ·  Max gain ${gainTxt}`, {
      size: 11,
      col: danger ? C.red : C.blue,
      bold: true,
    })
    this.riskBadge = this.add.container(0, 0, [panel, t])
  }

  // --- animation: curve sweep + mirror flip ---------------------------------
  private animateCurveIn(): void {
    // simple reveal: wipe a rectangle from left to right over the curve
    const mask = this.add.graphics()
    mask.fillStyle(C.white, 1)
    mask.fillRect(this.plot.l, this.plot.t - 30, this.plot.w + 4, this.plot.h + 60)
    this.tweens.add({
      targets: mask,
      x: this.plot.w + 8,
      duration: 700,
      ease: 'Cubic.inOut',
      onComplete: () => mask.destroy(),
    })
  }

  private runMirrorDemo(): void {
    // draw the long first, then reflect to the short (if params say short) — or vice versa
    const finalSide = this.p.side
    this.p.side = finalSide === 'short' ? 'long' : 'short'
    this.computeY()
    this.redraw()
    this.animateCurveIn()
    this.time.delayedCall(1300, () => {
      this.label((this.plot.l + this.plot.r) / 2, this.plot.t + 38, 'flip across the x-axis →', {
        size: 12,
        col: C.muted,
        align: 'center',
      })
    })
    this.time.delayedCall(1900, () => {
      this.p.side = finalSide
      this.computeY()
      this.redraw()
      // a quick scale-y flip cue
      this.curve.setScale(1, -1)
      this.curve.y = 2 * this.yFor(0)
      this.tweens.add({
        targets: this.curve,
        scaleY: 1,
        y: 0,
        duration: 500,
        ease: 'Cubic.out',
        onComplete: () => {
          this.redraw()
          if (this.spotDot) this.updateSpot(this.spotDot.getData('S'))
        },
      })
    })
  }

  // --- interactive controls (in-canvas) -------------------------------------
  private buildControls(): void {
    const baseY = this.H - 30
    // CALL/PUT toggle
    this.segToggle(80, baseY, ['CALL', 'PUT'], this.p.type === 'call' ? 0 : 1, (i) => {
      this.p.type = i === 0 ? 'call' : 'put'
      this.refreshAll()
    })
    // LONG/SHORT toggle
    this.segToggle(230, baseY, ['LONG', 'SHORT'], this.p.side === 'long' ? 0 : 1, (i) => {
      this.p.side = i === 0 ? 'long' : 'short'
      this.refreshAll()
    })
  }

  /** Two/three-state segmented toggle; returns nothing, calls onPick(index). */
  protected segToggle(
    cx: number,
    cy: number,
    labels: string[],
    start: number,
    onPick: (i: number) => void,
  ): void {
    const segW = 64
    const h = 26
    const totalW = segW * labels.length
    const x0 = cx - totalW / 2
    const bg = this.add.graphics()
    bg.fillStyle(C.gray100, 1)
    bg.fillRoundedRect(x0, cy - h / 2, totalW, h, 8)
    const hi = this.add.graphics()
    const texts: Phaser.GameObjects.Text[] = []
    const draw = (active: number) => {
      hi.clear()
      hi.fillStyle(C.blue, 1)
      hi.fillRoundedRect(x0 + active * segW, cy - h / 2, segW, h, 8)
      texts.forEach((t, i) => t.setColor(i === active ? hex(C.white) : hex(C.muted)))
    }
    labels.forEach((lab, i) => {
      const t = this.add
        .text(x0 + i * segW + segW / 2, cy, lab, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      t.on('pointerup', () => {
        draw(i)
        onPick(i)
      })
      texts.push(t)
    })
    draw(start)
  }

  protected refreshAll(): void {
    this.computeY()
    this.curve.clear()
    this.shade.clear()
    this.redraw()
    this.drawTitle()
    this.drawStrike()
    if (this.spotDot) this.updateSpot(this.spotDot.getData('S'))
  }

  // --- draggable "spot at expiry" dot with live P&L -------------------------
  protected buildSpotDot(S0: number): void {
    const y0 = this.yFor(0)
    this.spotGuide = this.add.graphics()
    this.spotDot = this.add
      .circle(this.xFor(S0), y0, 8, C.blue)
      .setStrokeStyle(3, C.white)
      .setData('S', S0)
      .setInteractive({ useHandCursor: true, draggable: true })
    this.input.setDraggable(this.spotDot)
    this.pnlLabel = this.label(this.plot.l + 8, this.plot.b - 14, '', { size: 12, col: C.ink, bold: true })
    this.spotDot.on('drag', (_p: Phaser.Input.Pointer, dx: number) => {
      const t = Phaser.Math.Clamp((dx - this.plot.l) / this.plot.w, 0, 1)
      const S = this.p.sMin + t * (this.p.sMax - this.p.sMin)
      this.updateSpot(S)
    })
    this.updateSpot(S0)
    this.label(this.plot.l + 8, this.plot.b - 30, '↔ drag the dot: spot at expiry', { size: 10, col: C.muted })
  }

  protected updateSpot(S: number): void {
    if (!this.spotDot || !this.spotGuide || !this.pnlLabel) return
    const pos = { type: this.p.type, side: this.p.side, K: this.p.K, premium: this.p.premium }
    const v = pnlPerShare(pos, S)
    const x = this.xFor(S)
    const y = this.yFor(v)
    this.spotDot.setPosition(x, y).setData('S', S)
    this.spotDot.setFillStyle(v >= 0 ? C.green : C.red)
    this.spotGuide.clear()
    this.spotGuide.lineStyle(1, C.muted, 0.6)
    this.spotGuide.lineBetween(x, this.plot.b, x, y)
    this.spotGuide.lineBetween(this.plot.l, y, x, y)
    const perContract = v * 100
    const intr = intrinsic(this.p.type, S, this.p.K)
    this.pnlLabel.setText(
      `S=${S.toFixed(1)}  intrinsic ${this.fmt(intr)}  P&L/share ${this.signed(v)}  →  ${this.signed(
        perContract,
        true,
      )}/contract`,
    )
    this.pnlLabel.setColor(hex(v >= 0 ? C.green : C.red))
  }

  // --- quiz mode ------------------------------------------------------------
  private drawQuizSetup(): void {
    this.redraw() // draws the legs; breakeven hidden via hideBreakeven
    // a floating "?" on the rising leg near the breakeven region
    const be = breakeven(this.p.type, this.p.K, this.p.premium)
    const x = this.xFor(be)
    const q = this.add
      .text(x, this.yFor(0) - 4, '?', { fontFamily: FONT, fontSize: '36px', color: hex(C.blue), fontStyle: 'bold' })
      .setOrigin(0.5)
      .setAlpha(0.55)
    q.setData('isQ', true)
    this.tweens.add({ targets: q, alpha: 0.85, yoyo: true, repeat: -1, duration: 700 })
  }

  protected onReveal(): void {
    if (this.revealed || this.p.mode !== 'quiz') return
    this.revealed = true
    // remove the floating "?"
    this.children.list
      .filter((o) => (o as Phaser.GameObjects.Text).getData?.('isQ'))
      .forEach((o) => o.destroy())
    this.drawBreakeven()
    // expose distractor / verdict dots
    const y0 = this.yFor(0)
    ;(this.p.revealDots ?? []).forEach((d, i) => {
      const pos = { type: this.p.type, side: this.p.side, K: this.p.K, premium: this.p.premium }
      const v = pnlPerShare(pos, d.S)
      const x = this.xFor(d.S)
      const y = this.yFor(v)
      const col = d.good ? C.green : C.red
      const dot = this.add.circle(x, y, 5, col).setStrokeStyle(2, C.white).setScale(0)
      const t = this.label(x, y + (v >= 0 ? -16 : 16), d.label, { size: 10, col, bold: true, align: 'center' })
      t.setAlpha(0)
      this.time.delayedCall(160 * i, () => {
        this.tweens.add({ targets: dot, scale: 1, duration: 260, ease: 'Back.out' })
        this.tweens.add({ targets: t, alpha: 1, duration: 260 })
        // guide line down to zero for the dot
        const g = this.add.graphics()
        g.lineStyle(1, col, 0.5)
        g.lineBetween(x, y0, x, y)
      })
    })
  }

  // --- challenge grading ----------------------------------------------------
  protected onSubmit(): void {
    if (this.p.mode !== 'challenge' || this.submitted) return
    this.submitted = true
    this.setCanSubmit(false)
    if (this.p.challenge === 'breakeven') this.gradeBreakeven()
    else this.gradeExercise()
  }

  private gradeExercise(): void {
    const expiryS = this.p.expiryS ?? this.p.K
    const pos = { type: this.p.type, side: this.p.side, K: this.p.K, premium: this.p.premium }
    // The hold-and-let-expire P&L is the long option's payoff at expiry (exact).
    const expireV = pnlPerShare(pos, expiryS)
    // Exercising a call at K when S < K means buying at K into an S market: you take
    // the intrinsic (here 0) AND eat the (K − S) overpay vs the market on top.
    const intr = intrinsic(this.p.type, expiryS, this.p.K)
    const overpay = this.p.type === 'call' ? Math.max(this.p.K - expiryS, 0) : Math.max(expiryS - this.p.K, 0)
    const exerciseV = intr - this.p.premium - overpay

    const correct = !this.exercisePick // letting it expire is the right call here
    const exC = exerciseV * 100
    const expC = expireV * 100
    const fmtMoney = (v: number) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(0)}`

    // Mark the outcomes on the curve at the expiry price.
    const x = this.xFor(expiryS)
    const yExpire = this.yFor(expireV)
    this.add.circle(x, yExpire, 6, correct ? C.green : C.red).setStrokeStyle(2, C.white)
    this.fadeIn(
      this.label(x, yExpire + 16, `let expire ${fmtMoney(expC)}`, {
        size: 11,
        col: C.green,
        bold: true,
        align: 'center',
      }),
    )

    const title = correct
      ? `Let it expire · ${fmtMoney(expC)}`
      : `Exercising overpays · ${fmtMoney(exC)}`
    const detail = correct
      ? `At S=${expiryS} the ${this.p.K}-strike call is out-of-the-money (intrinsic 0). You decline to exercise and lose only the ${this.fmt(
          this.p.premium,
        )} premium → ${fmtMoney(
          expC,
        )}. An option is a right, not an obligation — that decline is exactly why a long option's loss is capped at the premium.`
      : `Exercising buys 100 shares at ${this.p.K} when the market is only ${expiryS} — a ${this.fmt(
          this.p.K - expiryS,
        )}/share overpay on top of the premium, for ${fmtMoney(
          exC,
        )}. Letting it expire loses only the premium (${fmtMoney(expC)}). Never exercise an OTM option.`
    this.report(correct, title, detail)
  }

  private gradeBreakeven(): void {
    const be = breakeven(this.p.type, this.p.K, this.p.premium)
    const err = Math.abs(this.beGuess - be)
    const tol = (this.p.sMax - this.p.sMin) * 0.03 // ~3% of the visible range
    const correct = err <= tol

    // Reveal the true breakeven marker (blue) so the learner sees where it should sit.
    this.revealed = true
    this.drawBreakeven()
    // Lock the guess marker's colour to the verdict.
    const verdictCol = correct ? C.green : C.red
    this.beGuessDot?.setFillStyle(verdictCol)
    if (this.beGuessLabel) this.beGuessLabel.setColor(hex(verdictCol))

    const title = correct
      ? `Breakeven ${this.fmt(be)} — nailed it`
      : `Breakeven is ${this.fmt(be)} (you said ${this.fmt(this.beGuess)})`
    const sign = this.p.type === 'call' ? '+' : '−'
    const detail = correct
      ? `Right where the rising leg crosses $0. BE = K ${sign} premium = ${this.p.K} ${sign} ${this.fmt(
          this.p.premium,
        )} = ${this.fmt(
          be,
        )}. At the strike itself the option is worth 0, so you're still down the full premium — profit only starts past breakeven.`
      : `BE = K ${sign} premium = ${this.p.K} ${sign} ${this.fmt(this.p.premium)} = ${this.fmt(
          be,
        )}, marked in blue. A common trap is the strike (${this.p.K}): there the option's intrinsic is exactly 0, so you've still lost the whole premium. You only recoup the premium once intrinsic equals it.`
    this.report(correct, title, detail)
  }

  // --- fmt ------------------------------------------------------------------
  protected fmt(n: number): string {
    return n.toFixed(2)
  }
  protected signed(n: number, dollar = false): string {
    const s = n >= 0 ? '+' : '−'
    const a = Math.abs(n)
    return dollar ? `${s}$${a.toFixed(0)}` : `${s}${a.toFixed(2)}`
  }
}
