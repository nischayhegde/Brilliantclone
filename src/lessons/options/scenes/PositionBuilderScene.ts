import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'
import { pnlPerShare, maxLoss, maxGain, type OptType, type Side } from './optionMath'

interface BuilderParams {
  K?: number
  premium?: number
  sMin?: number
  sMax?: number
}

const PAD = { left: 56, right: 18, top: 50, bottom: 96 }

/**
 * PositionBuilderScene (module 11 challenge) — the learner BUILDS a single-leg option
 * by toggling CALL/PUT and LONG/SHORT; the payoff redraws live. On Submit the curve is
 * stress-drawn past the frame and the position is graded: only the naked SHORT CALL has
 * a loss tail that runs off the top of the frame (unlimited loss). Every other leg is
 * bounded — the explanation says why. All P&L / max-loss math comes from optionMath.
 */
export default class PositionBuilderScene extends ModuleScene {
  private p!: Required<BuilderParams>
  private type: OptType = 'call'
  private side: Side = 'long'
  private submitted = false

  private plot = { l: 0, r: 0, t: 0, b: 0, w: 0, h: 0 }
  private yMin = -1
  private yMax = 1
  private curve!: Phaser.GameObjects.Graphics
  private shade!: Phaser.GameObjects.Graphics
  private overlay!: Phaser.GameObjects.Graphics
  private titleTxt!: Phaser.GameObjects.Text
  private riskTxt!: Phaser.GameObjects.Text
  private riskChip!: Phaser.GameObjects.Graphics

  protected build(): void {
    const raw = this.params as BuilderParams
    this.p = {
      K: raw.K ?? 100,
      premium: raw.premium ?? 5,
      sMin: raw.sMin ?? 60,
      sMax: raw.sMax ?? 140,
    }
    this.plot = {
      l: PAD.left,
      r: this.W - PAD.right,
      t: PAD.top,
      b: this.H - PAD.bottom,
      w: this.W - PAD.left - PAD.right,
      h: this.H - PAD.top - PAD.bottom,
    }
    // Fixed symmetric y-scale so the four legs share a frame and the short-call tail
    // genuinely overflows it. premium*2.4 keeps the bounded legs comfortably inside.
    const span = this.p.premium * 2.4
    this.yMin = -span
    this.yMax = span

    this.label(this.plot.l, 20, 'BUILD A POSITION — who carries unlimited risk?', {
      size: 16,
      col: C.ink,
      bold: true,
    })
    this.titleTxt = this.label(this.plot.l, this.plot.t - 16, '', { size: 13, col: C.ink, bold: true })

    this.drawAxes()
    this.curve = this.add.graphics()
    this.shade = this.add.graphics()
    this.overlay = this.add.graphics()
    this.riskChip = this.add.graphics()
    this.riskTxt = this.label((this.plot.l + this.plot.r) / 2, this.plot.t + 22, '', {
      size: 13,
      col: C.muted,
      bold: true,
      align: 'center',
    })

    this.buildToggles()
    this.redraw()
    this.setCanSubmit(true)
    this.emitReady()
  }

  private xFor(S: number): number {
    const t = (S - this.p.sMin) / (this.p.sMax - this.p.sMin)
    return this.plot.l + t * this.plot.w
  }
  private yFor(v: number): number {
    const t = (v - this.yMin) / (this.yMax - this.yMin)
    return this.plot.b - t * this.plot.h
  }

  private drawAxes(): void {
    const g = this.add.graphics()
    const y0 = this.yFor(0)
    g.lineStyle(1.5, C.gray200)
    g.lineBetween(this.plot.l, y0, this.plot.r, y0)
    g.lineStyle(1, C.hairline)
    g.lineBetween(this.plot.l, this.plot.t, this.plot.l, this.plot.b)
    g.lineBetween(this.plot.l, this.plot.b, this.plot.r, this.plot.b)
    this.label(this.plot.l - 6, y0, '0', { size: 11, col: C.muted, align: 'right' })
    this.add
      .text(14, this.plot.t + this.plot.h / 2, 'profit / loss', {
        fontFamily: FONT,
        fontSize: '12px',
        color: hex(C.muted),
      })
      .setOrigin(0.5)
      .setAngle(-90)
    const ticks = 6
    for (let i = 0; i <= ticks; i++) {
      const S = this.p.sMin + ((this.p.sMax - this.p.sMin) * i) / ticks
      const x = this.xFor(S)
      g.lineStyle(1, C.gray100)
      g.lineBetween(x, this.plot.t, x, this.plot.b)
      this.label(x, this.plot.b + 12, S.toFixed(0), { size: 10, col: C.muted, align: 'center' })
    }
    this.label((this.plot.l + this.plot.r) / 2, this.plot.b + 28, 'stock price at the deadline', {
      size: 11,
      col: C.muted,
      align: 'center',
    })
    // strike marker (blue)
    const xk = this.xFor(this.p.K)
    g.lineStyle(1.5, C.blue)
    for (let yy = this.plot.t; yy < this.plot.b; yy += 12) {
      g.lineBetween(xk, yy, xk, Math.min(yy + 7, this.plot.b))
    }
    this.label(xk, this.plot.t - 6, `strike $${this.p.K}`, { size: 13, col: C.blue, bold: true, align: 'center', bg: true })
  }

  private redraw(): void {
    const pos = { type: this.type, side: this.side, K: this.p.K, premium: this.p.premium }
    this.curve.clear()
    this.shade.clear()

    // sample, clamping the drawn value into the frame (the real overflow is shown on submit)
    const pts: Array<{ x: number; vy: number; v: number }> = []
    const samples: number[] = [this.p.sMin, this.p.K, this.p.sMax]
    for (let i = 0; i <= 60; i++) samples.push(this.p.sMin + ((this.p.sMax - this.p.sMin) * i) / 60)
    samples.sort((a, b) => a - b)
    for (const S of samples) {
      const v = pnlPerShare(pos, S)
      const clamped = Math.max(this.yMin, Math.min(this.yMax, v))
      pts.push({ x: this.xFor(S), vy: this.yFor(clamped), v })
    }
    const y0 = this.yFor(0)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const profit = (a.v + b.v) / 2 >= 0
      this.shade.fillStyle(profit ? C.green : C.red, 0.1)
      this.shade.beginPath()
      this.shade.moveTo(a.x, y0)
      this.shade.lineTo(a.x, a.vy)
      this.shade.lineTo(b.x, b.vy)
      this.shade.lineTo(b.x, y0)
      this.shade.closePath()
      this.shade.fillPath()
      this.curve.lineStyle(3, profit ? C.green : C.red)
      this.curve.lineBetween(a.x, a.vy, b.x, b.vy)
    }

    this.titleTxt.setText(
      `${this.side === 'long' ? 'BUY' : 'SELL'} ${this.type.toUpperCase()}  ·  strike $${this.p.K}  ·  premium $${this.p.premium.toFixed(
        2,
      )}`,
    )
    const ml = maxLoss(pos)
    const mg = maxGain(pos)
    const lossTxt = ml === Infinity ? 'UNLIMITED' : `$${ml.toLocaleString()}`
    const gainTxt = mg === Infinity ? 'unlimited' : `$${mg.toLocaleString()}`
    this.riskTxt.setText(`Max loss ${lossTxt} · Max gain ${gainTxt}`)
    this.riskTxt.setColor(hex(ml === Infinity ? C.red : C.muted))
    // dynamic white chip behind the (centre-origin) risk readout
    const t = this.riskTxt
    const padX = 6
    const padY = 3
    this.riskChip.clear()
    this.riskChip.fillStyle(C.white, 0.85)
    this.riskChip.fillRoundedRect(
      t.x - t.originX * t.width - padX,
      t.y - t.originY * t.height - padY,
      t.width + padX * 2,
      t.height + padY * 2,
      5,
    )
    this.children.moveBelow(this.riskChip, t)
  }

  // --- CALL/PUT + LONG/SHORT segmented toggles ------------------------------
  private buildToggles(): void {
    const baseY = this.H - 30
    this.segToggle(this.plot.l + 90, baseY, ['CALL', 'PUT'], 0, (i) => {
      if (this.submitted) return
      this.type = i === 0 ? 'call' : 'put'
      this.redraw()
    })
    this.segToggle(this.plot.l + 280, baseY, ['LONG', 'SHORT'], 0, (i) => {
      if (this.submitted) return
      this.side = i === 0 ? 'long' : 'short'
      this.redraw()
    })
  }

  private segToggle(cx: number, cy: number, labels: string[], start: number, onPick: (i: number) => void): void {
    const segW = 70
    const h = 28
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
        if (this.submitted) return
        draw(i)
        onPick(i)
      })
      texts.push(t)
    })
    draw(start)
  }

  // --- grade ----------------------------------------------------------------
  protected onSubmit(): void {
    if (this.submitted) return
    this.submitted = true
    this.setCanSubmit(false)

    const pos = { type: this.type, side: this.side, K: this.p.K, premium: this.p.premium }
    const ml = maxLoss(pos)
    const unlimited = ml === Infinity // exactly the naked short call
    const correct = unlimited

    // Stress-draw the loss tail running off the top of the frame for a short call.
    if (unlimited) {
      const xEdge = this.xFor(this.p.sMax)
      this.overlay.lineStyle(3, C.red)
      this.overlay.lineBetween(this.xFor(this.p.K), this.yFor(this.p.premium), xEdge, this.plot.t - 30)
      this.fadeIn(
        this.label(xEdge - 6, this.plot.t - 24, '⚠ loss → ∞', {
          size: 13,
          col: C.red,
          bold: true,
          align: 'right',
          bg: true,
        }),
      )
    }

    const lossTxt = unlimited ? 'UNLIMITED' : `$${ml.toLocaleString()}`
    const legName = `${this.side === 'long' ? 'bought' : 'sold'} ${this.type}`
    let detail: string
    if (correct) {
      detail = `Selling a call (without owning the stock) forces you to hand over 100 shares at $${this.p.K} no matter how high the stock climbs. Since a stock can rise forever, your loss has no ceiling — the red line runs off the top.`
    } else if (this.side === 'short' && this.type === 'put') {
      detail = `Selling a put feels just as risky, but a stock can't fall below $0 — so the worst case is capped at ${lossTxt}. Only selling a call has no limit. Build that one.`
    } else {
      detail = `Buying a ${this.type} can only lose the premium you paid (${lossTxt}) — you can always walk away. The no-limit loss belongs to a sold call. Switch to SELL + CALL.`
    }
    const title = correct
      ? `Sold call — UNLIMITED loss`
      : `Your ${legName} has a limited loss (${lossTxt})`
    this.report(correct, title, detail)
  }
}
