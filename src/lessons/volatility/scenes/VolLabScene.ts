import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import {
  type Leg,
  type Side,
  straddle,
  strangle,
  combinedPnL,
  breakevens,
  totalPremium,
  isShort,
  fmt,
  fmtSigned,
  fmtDollars,
} from './payoffMath'

interface Preset {
  name: string
  structure: 'straddle' | 'strangle'
  side: Side
  K?: number
  total?: number
  Kp?: number
  Kc?: number
  S: number
}

/**
 * Module 14 INTERACTIVE — "Volatility Lab: Tune the Whole Trade".
 *
 * A free sandbox: structure + long/short toggles, strike/premium sliders, and a
 * realized-move dial all jointly drive the payoff curve, breakevens, and a P&L dot
 * that walks the curve. Live readouts: cost, both breakevens, P&L, a bold
 * "cleared a breakeven?" flag, and a short-risk badge. No pass/fail. Preset buttons
 * load a clean winner and a "moved-but-lost" loser. All math exact per payoffMath.
 */
export default class VolLabScene extends ModuleScene {
  private structure: 'straddle' | 'strangle' = 'straddle'
  private side: Side = 'long'
  private K = 100
  private total = 7
  private Kp = 95
  private Kc = 105
  private S = 100

  // plot
  private plot = { l: 60, r: 470, t: 36, b: 250 }
  private xMin = 80
  private xMax = 120
  private yMin = -14
  private yMax = 14

  private curveG!: Phaser.GameObjects.Graphics
  private shadeG!: Phaser.GameObjects.Graphics
  private beG!: Phaser.GameObjects.Graphics
  /** Persistent breakeven marker labels (lower, upper) — created once, repositioned. */
  private beLabelLo!: Phaser.GameObjects.Text
  private beLabelHi!: Phaser.GameObjects.Text
  private beChip!: Phaser.GameObjects.Graphics
  private dot!: Phaser.GameObjects.Arc
  private dotLabel!: Phaser.GameObjects.Text
  private dotChip!: Phaser.GameObjects.Graphics
  private readoutTexts: Phaser.GameObjects.Text[] = []
  private flagText!: Phaser.GameObjects.Text
  private flagPanel!: Phaser.GameObjects.Graphics
  private riskText!: Phaser.GameObjects.Text
  private structBtns: Phaser.GameObjects.Container[] = []
  private sideBtns: Phaser.GameObjects.Container[] = []
  private premLabel!: Phaser.GameObjects.Text
  private kLabel!: Phaser.GameObjects.Text
  private spreadLabel!: Phaser.GameObjects.Text
  private moveLabel!: Phaser.GameObjects.Text
  private kSlider?: { set: (v: number) => void }
  private spreadSlider?: { set: (v: number) => void }
  private premSlider?: { set: (v: number) => void }
  private moveSlider?: { set: (v: number) => void }

  private readonly presets: Preset[] = [
    { name: 'Clean winner', structure: 'straddle', side: 'long', K: 100, total: 7, S: 112 },
    { name: 'Moved-but-lost', structure: 'straddle', side: 'long', K: 100, total: 7, S: 104 },
    { name: 'Sell the quiet', structure: 'straddle', side: 'short', K: 100, total: 7, S: 102 },
  ]

  protected build(): void {
    this.label(20, 14, 'Volatility Lab — tune the whole trade', { size: this.fs(15, 14, 18), bold: true, col: C.ink })

    this.shadeG = this.add.graphics()
    this.curveG = this.add.graphics()
    this.beG = this.add.graphics()
    this.dot = this.add.circle(0, 0, 9, C.blue).setStrokeStyle(3, C.white)
    this.dotChip = this.add.graphics()
    this.dotLabel = this.label(0, 0, '', { size: this.fs(13, 12, 16), col: C.ink, bold: true, align: 'center' })
    // persistent BE labels: lower rides higher, upper lower, so they never collide; chipped
    this.beChip = this.add.graphics()
    this.beLabelLo = this.label(0, this.plot.t + 8, '', { size: this.fs(12, 12, 15), col: C.blueDark, bold: true, align: 'center' })
    this.beLabelHi = this.label(0, this.plot.t + 26, '', { size: this.fs(12, 12, 15), col: C.blueDark, bold: true, align: 'center' })

    this.drawStaticAxes()
    this.buildControls()
    this.redraw()

    this.label(20, this.H - 12, 'Build a winner, then one where the stock moves and you still lose. Drag the dials; the breakevens decide.', {
      size: this.fs(12, 12, 15), col: C.muted,
    })
    this.time.delayedCall(600, () => this.emitReady())
  }

  private legs(): Leg[] {
    if (this.structure === 'straddle') {
      return straddle(this.K, this.total * (4 / 7), this.total * (3 / 7), this.side)
    }
    return strangle(this.Kp, this.Kc, this.total * (1.25 / 3), this.total * (1.75 / 3), this.side)
  }

  // --- geometry -------------------------------------------------------------
  private xFor(p: number): number {
    return this.plot.l + ((p - this.xMin) / (this.xMax - this.xMin)) * (this.plot.r - this.plot.l)
  }
  private yFor(v: number): number {
    return this.plot.b - ((v - this.yMin) / (this.yMax - this.yMin)) * (this.plot.b - this.plot.t)
  }

  private drawStaticAxes(): void {
    const g = this.add.graphics()
    const y0 = this.yFor(0)
    g.lineStyle(1.5, C.blue, 0.6)
    g.lineBetween(this.plot.l, y0, this.plot.r, y0)
    g.lineStyle(1, C.hairline)
    g.lineBetween(this.plot.l, this.plot.t, this.plot.l, this.plot.b)
    for (let px = 80; px <= 120; px += 10) {
      const x = this.xFor(px)
      g.lineStyle(1, C.gray100)
      g.lineBetween(x, this.plot.t, x, this.plot.b)
      this.label(x, this.plot.b + 13, fmt(px), { size: this.fs(12, 12, 15), col: C.muted, align: 'center' })
    }
    this.label(this.plot.l + (this.plot.r - this.plot.l) / 2, this.plot.b + 28, 'stock price at expiry', { size: this.fs(12, 12, 15), col: C.muted, align: 'center' })
  }

  // --- redraw ---------------------------------------------------------------
  private redraw(): void {
    const legs = this.legs()
    this.curveG.clear()
    this.shadeG.clear()
    this.beG.clear()
    const y0 = this.yFor(0)

    // curve points
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i <= 200; i++) {
      const px = this.xMin + ((this.xMax - this.xMin) * i) / 200
      const pnl = Math.max(this.yMin, Math.min(this.yMax, combinedPnL(legs, px)))
      pts.push({ x: this.xFor(px), y: this.yFor(pnl) })
    }
    // shading
    for (const sign of [1, -1] as const) {
      this.shadeG.fillStyle(sign > 0 ? C.green : C.red, 0.12)
      this.shadeG.beginPath()
      this.shadeG.moveTo(pts[0].x, y0)
      for (const pt of pts) this.shadeG.lineTo(pt.x, sign > 0 ? Math.min(pt.y, y0) : Math.max(pt.y, y0))
      this.shadeG.lineTo(pts[pts.length - 1].x, y0)
      this.shadeG.closePath()
      this.shadeG.fillPath()
    }
    // curve
    this.curveG.lineStyle(3, isShort(legs) ? C.red : C.green, 1)
    this.curveG.beginPath()
    this.curveG.moveTo(pts[0].x, pts[0].y)
    for (const pt of pts) this.curveG.lineTo(pt.x, pt.y)
    this.curveG.strokePath()

    // strikes + breakevens
    const be = breakevens(legs)
    for (const k of [...new Set(legs.map((l) => l.K))]) this.dashV(this.beG, this.xFor(k), this.plot.t, this.plot.b, C.blue, 0.4)
    this.dashV(this.beG, this.xFor(be.lower), this.plot.t, this.plot.b, C.blue, 1, 8, 6)
    this.dashV(this.beG, this.xFor(be.upper), this.plot.t, this.plot.b, C.blue, 1, 8, 6)
    // reposition the persistent (non-stacking) BE labels + redraw their chips
    this.beLabelLo.setText('BE ' + fmt(be.lower)).setPosition(this.xFor(be.lower), this.plot.t + 8)
    this.beLabelHi.setText('BE ' + fmt(be.upper)).setPosition(this.xFor(be.upper), this.plot.t + 28)
    this.beChip.clear()
    for (const t of [this.beLabelLo, this.beLabelHi]) {
      const padX = 5
      const padY = 3
      this.beChip.fillStyle(C.white, 0.88)
      this.beChip.fillRoundedRect(t.x - t.width / 2 - padX, t.y - t.height / 2 - padY, t.width + padX * 2, t.height + padY * 2, 5)
    }
    this.children.moveBelow(this.beChip, this.beLabelLo)
    this.updateDot()
    this.updateReadout()
  }

  private updateDot(): void {
    const legs = this.legs()
    const Sc = Phaser.Math.Clamp(this.S, this.xMin, this.xMax)
    const pnl = combinedPnL(legs, Sc)
    const x = this.xFor(Sc)
    const y = this.yFor(Math.max(this.yMin, Math.min(this.yMax, pnl)))
    this.dot.setPosition(x, y)
    const profit = pnl > 0.001
    this.dot.setFillStyle(profit ? C.green : pnl < -0.001 ? C.red : C.blue)
    const clampedX = Phaser.Math.Clamp(x, this.plot.l + 24, this.plot.r - 24)
    this.dotLabel.setText(`S=${fmt(this.S)}`).setPosition(clampedX, y - 16).setColor(hex(profit ? C.greenText : C.red))
    // chip tracks the moving readout
    const padX = 6
    const padY = 3
    this.dotChip.clear()
    this.dotChip.fillStyle(C.white, 0.88)
    this.dotChip.fillRoundedRect(
      this.dotLabel.x - this.dotLabel.width / 2 - padX,
      this.dotLabel.y - this.dotLabel.height / 2 - padY,
      this.dotLabel.width + padX * 2,
      this.dotLabel.height + padY * 2,
      5,
    )
    this.children.moveBelow(this.dotChip, this.dotLabel)
  }

  private updateReadout(): void {
    const legs = this.legs()
    const be = breakevens(legs)
    const total = totalPremium(legs)
    const pnl = combinedPnL(legs, this.S)
    const short = isShort(legs)

    const lines = [
      `cost: ${short ? 'collect' : 'pay'} ${fmt(total)} (×100 = $${Math.round(total * 100)})`,
      `breakevens: ${fmt(be.lower)} (down) / ${fmt(be.upper)} (up)`,
      `P&L at S=${fmt(this.S)}: ${fmtSigned(pnl)}  (${fmtDollars(pnl)})`,
    ]
    this.readoutTexts.forEach((t, i) => t.setText(lines[i] ?? ''))

    // bold flag
    const win = pnl > 0
    this.flagText.setText(win ? (short ? 'STAYED INSIDE → profit' : 'CLEARED a breakeven → profit') : (short ? 'BROKE OUT → loss' : 'inside breakevens → loss'))
    this.flagText.setColor(hex(win ? C.greenText : C.red))
    this.flagPanel.clear()
    this.flagPanel.fillStyle(win ? C.greenSoft : C.redSoft, 1)
    this.flagPanel.fillRoundedRect(this.flagText.x - 8, this.flagText.y - 13, this.flagText.width + 16, 26, 8)
    this.children.bringToTop(this.flagText)

    // risk badge
    this.riskText.setText(short ? 'risk: unbounded up / large down' : 'risk: max loss = premium (defined)')
    this.riskText.setColor(hex(short ? C.red : C.muted))
  }

  // --- controls -------------------------------------------------------------
  private buildControls(): void {
    const px = 500
    const muteFs = this.fs(12, 12, 15)
    const labelFs = this.fs(13, 12, 16)
    // structure toggle
    this.label(px, 40, 'Structure', { size: muteFs, col: C.muted })
    this.structBtns = [
      this.button(px + 50, 60, 'Straddle', () => this.setStructure('straddle'), { w: 92, h: 26 }),
      this.button(px + 150, 60, 'Strangle', () => this.setStructure('strangle'), { w: 92, h: 26, fill: C.gray200, textCol: C.ink }),
    ]
    // side toggle
    this.label(px, 88, 'Side', { size: muteFs, col: C.muted })
    this.sideBtns = [
      this.button(px + 50, 108, 'Long', () => this.setSide('long'), { w: 92, h: 26 }),
      this.button(px + 150, 108, 'Short', () => this.setSide('short'), { w: 92, h: 26, fill: C.gray200, textCol: C.ink }),
    ]

    // sliders (amber dials — the live "act on me" affordance)
    this.kLabel = this.label(px, 140, '', { size: labelFs, col: C.ink, bold: true })
    this.kSlider = this.slider(px, 158, 200, 90, 110, this.K, (v) => { this.K = v; this.refreshLabels(); this.redraw() }, { step: 1, col: C.amber })

    this.spreadLabel = this.label(px, 184, '', { size: labelFs, col: C.ink, bold: true })
    this.spreadSlider = this.slider(px, 202, 200, 3, 12, (this.Kc - this.Kp) / 2, (v) => {
      this.Kp = 100 - v; this.Kc = 100 + v; this.refreshLabels(); this.redraw()
    }, { step: 1, col: C.amber })

    this.premLabel = this.label(px, 228, '', { size: labelFs, col: C.ink, bold: true })
    this.premSlider = this.slider(px, 246, 200, 1, 14, this.total, (v) => { this.total = v; this.refreshLabels(); this.redraw() }, { step: 0.5, col: C.amber })

    this.moveLabel = this.label(px, 272, '', { size: labelFs, col: C.ink, bold: true })
    this.moveSlider = this.slider(px, 290, 200, 80, 120, this.S, (v) => { this.S = v; this.refreshLabels(); this.updateDot(); this.updateReadout() }, { step: 0.5, col: C.amber })

    // --- readout cluster: ONE fixed bg panel, non-overlapping lines (bottom-left) ---
    // Width stops short of the right control column so the preset buttons (x≈398+) never
    // sit on top of the panel.
    const panelX = 14
    const panelY = 286
    const panelW = 372
    const panelH = 150
    this.panel(panelX, panelY, panelW, panelH, { fill: C.gray100, stroke: C.hairline, radius: 12 })
    const tx = panelX + 14
    const ry = panelY + 18
    this.readoutTexts = [
      this.label(tx, ry, '', { size: labelFs, col: C.blueDark, bold: true }),
      this.label(tx, ry + 24, '', { size: labelFs, col: C.blueDark, bold: true }),
      this.label(tx, ry + 48, '', { size: labelFs, col: C.ink, bold: true }),
    ]
    this.flagPanel = this.add.graphics()
    this.flagText = this.label(tx + 8, ry + 80, '', { size: labelFs, bold: true })
    this.riskText = this.label(tx, ry + 110, '', { size: muteFs, col: C.muted })

    // presets
    this.label(px, 318, 'Presets', { size: muteFs, col: C.muted })
    this.presets.forEach((preset, i) => {
      this.button(px + 8, 340 + i * 30, preset.name, () => this.loadPreset(preset), {
        w: 220, h: 24, fill: C.amberSoft, textCol: C.amberInk,
      })
    })

    // Apply the active-button highlight for the defaults so the selected structure/side
    // reads as active from the start (not only after the first click).
    this.highlight(this.structBtns, this.structure === 'straddle' ? 0 : 1)
    this.highlight(this.sideBtns, this.side === 'long' ? 0 : 1)

    this.refreshLabels()
  }

  private refreshLabels(): void {
    this.kLabel.setText(`Strike K: ${fmt(this.K)}`)
    this.spreadLabel.setText(`Strangle strikes: ${fmt(this.Kp)} / ${fmt(this.Kc)}`)
    this.premLabel.setText(`Total premium: ${fmt(this.total)}`)
    this.moveLabel.setText(`Realized S: ${fmt(this.S)}`)
  }

  private setStructure(s: 'straddle' | 'strangle'): void {
    this.structure = s
    this.highlight(this.structBtns, s === 'straddle' ? 0 : 1)
    this.redraw()
  }
  private setSide(side: Side): void {
    this.side = side
    this.highlight(this.sideBtns, side === 'long' ? 0 : 1)
    this.redraw()
  }

  private highlight(btns: Phaser.GameObjects.Container[], activeIdx: number): void {
    btns.forEach((b, i) => {
      const g = b.list[0] as Phaser.GameObjects.Graphics
      const t = b.list[1] as Phaser.GameObjects.Text
      const w = b.width
      g.clear()
      g.fillStyle(i === activeIdx ? C.blue : C.gray200, 1)
      g.fillRoundedRect(-w / 2, -13, w, 26, 10)
      t.setColor(hex(i === activeIdx ? C.white : C.ink))
    })
  }

  private loadPreset(p: Preset): void {
    this.structure = p.structure
    this.side = p.side
    if (p.K !== undefined) this.K = p.K
    if (p.total !== undefined) this.total = p.total
    if (p.Kp !== undefined) this.Kp = p.Kp
    if (p.Kc !== undefined) this.Kc = p.Kc
    this.S = p.S
    this.highlight(this.structBtns, p.structure === 'straddle' ? 0 : 1)
    this.highlight(this.sideBtns, p.side === 'long' ? 0 : 1)
    // sync slider knobs to the preset values
    this.kSlider?.set(this.K)
    this.spreadSlider?.set((this.Kc - this.Kp) / 2)
    this.premSlider?.set(this.total)
    this.moveSlider?.set(this.S)
    this.refreshLabels()
    this.redraw()
  }

  private dashV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1, dash = 6, gap = 5): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += dash + gap) g.lineBetween(x, y, x, Math.min(y + dash, y2))
  }
}
