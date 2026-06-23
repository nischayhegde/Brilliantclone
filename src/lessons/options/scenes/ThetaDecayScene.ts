import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'

interface ThetaParams {
  K?: number
  S?: number
  /** illustrative time value at the start (far from expiry). */
  tv0?: number
  /** total life in days. */
  days?: number
  /** 'ITM' | 'ATM' | 'OTM' starting floor. */
  money?: 'ITM' | 'ATM' | 'OTM'
}

const PLOT = { l: 64, r: 700, t: 70, b: 360 }

/**
 * ThetaDecayScene — time value melts to ZERO by expiry; intrinsic floor holds.
 * Drag time-to-expiry from 60d → 0d; the decay curve steepens near the end.
 */
export default class ThetaDecayScene extends ModuleScene {
  private p!: Required<ThetaParams>
  private money: 'ITM' | 'ATM' | 'OTM' = 'ITM'
  private intr = 5
  private dte = 60

  private bar!: Phaser.GameObjects.Graphics
  private guide!: Phaser.GameObjects.Graphics
  private readouts!: Phaser.GameObjects.Text

  protected build(): void {
    const raw = this.params as ThetaParams
    this.p = {
      K: raw.K ?? 100,
      S: raw.S ?? 105,
      tv0: raw.tv0 ?? 3,
      days: raw.days ?? 60,
      money: raw.money ?? 'ITM',
    }
    this.money = this.p.money
    this.dte = this.p.days
    this.recomputeIntrinsic()

    this.label(40, 26, 'THETA — TIME VALUE DECAYS TO ZERO', { size: 14, col: C.ink, bold: true })
    this.label(40, 46, '(decay curve illustrative; intrinsic-at-expiry exact)', { size: 11, col: C.muted })

    this.drawFrame()
    this.bar = this.add.graphics()
    this.guide = this.add.graphics()
    this.readouts = this.label(PLOT.l, 380, '', { size: 13, col: C.ink, bold: true })

    // moneyness toggle
    this.label(60, 410, 'Moneyness', { size: 11, col: C.muted })
    this.toggle(60, 432, ['OTM', 'ATM', 'ITM'], 2, (i) => {
      this.money = (['OTM', 'ATM', 'ITM'] as const)[i]
      this.recomputeIntrinsic()
      this.refresh()
    })
    // time slider (60d -> 0d). slider min..max maps left..right = far..near
    this.label(380, 410, 'Days to expiry', { size: 12, col: C.muted })
    this.slider(380, 430, 280, 0, this.p.days, this.dte, (v) => {
      this.dte = v
      this.refresh()
    })

    this.drawDecayCurve()
    this.refresh()
    this.emitReady()
  }

  private recomputeIntrinsic(): void {
    // ITM: S>K (call) → S−K ; ATM/OTM floor = 0
    this.intr = this.money === 'ITM' ? Math.max(this.p.S - this.p.K, 0) : 0
  }

  // illustrative decay: time value ∝ sqrt(dte/days) so it steepens near expiry
  private tvAt(dte: number): number {
    return this.p.tv0 * Math.sqrt(Math.max(dte, 0) / this.p.days)
  }

  private xForDte(dte: number): number {
    // far (days) on left, expiry (0) on right
    const t = 1 - dte / this.p.days
    return PLOT.l + t * (PLOT.r - PLOT.l)
  }
  private yForVal(v: number): number {
    const maxV = this.p.tv0 + Math.max(this.p.S - this.p.K, 0) + 2
    return PLOT.b - (v / maxV) * (PLOT.b - PLOT.t)
  }

  private drawFrame(): void {
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline)
    g.lineBetween(PLOT.l, PLOT.t, PLOT.l, PLOT.b)
    g.lineBetween(PLOT.l, PLOT.b, PLOT.r, PLOT.b)
    this.label(PLOT.l - 6, PLOT.t, 'value', { size: 10, col: C.muted, align: 'right' })
    this.label(PLOT.l, PLOT.b + 12, 'now', { size: 10, col: C.muted })
    this.label(PLOT.r, PLOT.b + 12, 'expiry', { size: 10, col: C.muted, align: 'right' })
  }

  private drawDecayCurve(): void {
    const g = this.add.graphics()
    g.lineStyle(2, C.blue, 0.55)
    let first = true
    for (let d = this.p.days; d >= 0; d -= 1) {
      const x = this.xForDte(d)
      const y = this.yForVal(this.intr + this.tvAt(d))
      if (first) {
        g.moveTo(x, y)
        first = false
      } else g.lineTo(x, y)
    }
    g.strokePath()
    // intrinsic floor
    const yFloor = this.yForVal(this.intr)
    const f = this.add.graphics()
    f.lineStyle(1.5, C.blue, 0.4)
    for (let x = PLOT.l; x < PLOT.r; x += 12) f.lineBetween(x, yFloor, Math.min(x + 7, PLOT.r), yFloor)
    this.label(PLOT.r - 4, yFloor - 10, `intrinsic floor ${this.intr.toFixed(2)}`, {
      size: 11,
      col: C.blue,
      bold: true,
      align: 'right',
    })
    g.setData('decay', true)
    f.setData('floor', true)
  }

  private refresh(): void {
    const tv = this.tvAt(this.dte)
    const total = this.intr + tv
    const x = this.xForDte(this.dte)
    // redraw the stacked bar at current x
    this.bar.clear()
    const bw = 26
    const yBase = PLOT.b
    const yIntrTop = this.yForVal(this.intr)
    const yTotTop = this.yForVal(total)
    this.bar.fillStyle(C.blue, 1)
    this.bar.fillRect(x - bw / 2, yIntrTop, bw, yBase - yIntrTop)
    this.bar.fillStyle(C.blue, 0.28)
    this.bar.fillRect(x - bw / 2, yTotTop, bw, yIntrTop - yTotTop)
    this.bar.lineStyle(1, C.blue, 0.5)
    this.bar.strokeRect(x - bw / 2, yTotTop, bw, yBase - yTotTop)

    this.guide.clear()
    this.guide.lineStyle(1, C.muted, 0.5)
    this.guide.lineBetween(x, PLOT.t, x, PLOT.b)

    this.readouts.setText(
      `${this.dte.toFixed(0)} days left   intrinsic ${this.intr.toFixed(2)} (constant)   time value ${tv.toFixed(
        2,
      )} → 0   total premium ${total.toFixed(2)}`,
    )
    this.readouts.setColor(hex(this.dte <= 0 ? C.red : C.ink))
  }

  private toggle(x: number, y: number, labels: string[], start: number, onPick: (i: number) => void): void {
    const segW = 56
    const h = 28
    const x0 = x // left edge
    const bg = this.add.graphics()
    bg.fillStyle(C.gray100, 1)
    bg.fillRoundedRect(x0, y - h / 2, segW * labels.length, h, 8)
    const hi = this.add.graphics()
    const texts: Phaser.GameObjects.Text[] = []
    const draw = (active: number) => {
      hi.clear()
      hi.fillStyle(C.blue, 1)
      hi.fillRoundedRect(x0 + active * segW, y - h / 2, segW, h, 8)
      texts.forEach((t, i) => t.setColor(i === active ? hex(C.white) : hex(C.muted)))
    }
    labels.forEach((lab, i) => {
      const t = this.add
        .text(x0 + i * segW + segW / 2, y, lab, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      t.on('pointerup', () => {
        draw(i)
        onPick(i)
        // redraw decay curve + floor for the new moneyness
        this.children.list.filter((o) => o.getData?.('decay') || o.getData?.('floor')).forEach((o) => o.destroy())
        this.drawDecayCurve()
      })
      texts.push(t)
    })
    draw(start)
  }
}
