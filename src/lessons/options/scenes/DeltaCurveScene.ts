import Phaser from 'phaser'
import { C } from '../../../engine/palette'
import PayoffScene, { type PayoffParams } from './PayoffScene'

interface DeltaParams extends PayoffParams {
  /** illustrative delta anchors {S, delta} interpolated for the readout. */
  deltaAnchors?: Array<{ S: number; delta: number }>
}

/**
 * DeltaCurveScene — overlays the smooth pre-expiry curve on the at-expiry hockey
 * stick (drawn by PayoffScene), rides a tangent line whose slope = delta, and shows
 * the δ×100 shares-equivalent badge. Drag S; readouts update live.
 */
export default class DeltaCurveScene extends PayoffScene {
  private anchors: Array<{ S: number; delta: number }> = []
  private tangent!: Phaser.GameObjects.Graphics
  private smooth!: Phaser.GameObjects.Graphics
  private deltaText!: Phaser.GameObjects.Text
  private gaugeFill!: Phaser.GameObjects.Graphics
  private gx = 0
  private gy = 0
  private gw = 150

  protected build(): void {
    // force a long-call interactive setup; PayoffScene draws axes + hockey stick
    const raw = this.params as DeltaParams
    this.anchors = raw.deltaAnchors ?? [
      { S: 85, delta: 0.12 },
      { S: 100, delta: 0.5 },
      { S: 110, delta: 0.75 },
      { S: 120, delta: 0.9 },
      { S: 135, delta: 0.97 },
    ]
    super.build()

    // overlay smooth pre-expiry curve (premium offset so it sits above the stick)
    this.smooth = this.add.graphics()
    this.drawSmoothCurve()

    this.tangent = this.add.graphics()
    this.deltaText = this.label(this.plot.l + 8, this.plot.t + 14, '', { size: 13, col: C.blue, bold: true })

    // delta gauge (0 → 1)
    this.gx = this.plot.r - 170
    this.gy = this.plot.t + 16
    this.gw = 150
    const gtrack = this.add.graphics()
    gtrack.fillStyle(C.gray200, 1)
    gtrack.fillRoundedRect(this.gx, this.gy, this.gw, 8, 4)
    this.gaugeFill = this.add.graphics()
    this.label(this.gx, this.gy - 12, 'δ gauge 0 → 1', { size: 10, col: C.muted })

    this.updateDelta(this.deltaSpot())
  }

  // smooth pre-expiry value (per share) ≈ intrinsic + a rounded ATM bump, then minus
  // a constant so it overlays the P&L stick at a similar scale.
  private smoothValue(S: number): number {
    const intr = Math.max(S - this.p.K, 0)
    const bump = 4 * Math.exp(-((S - this.p.K) ** 2) / (2 * 14 * 14))
    return intr + bump - this.p.premium
  }

  private drawSmoothCurve(): void {
    this.smooth.clear()
    this.smooth.lineStyle(2.5, C.blue, 0.8)
    let first = true
    for (let i = 0; i <= 80; i++) {
      const S = this.p.sMin + ((this.p.sMax - this.p.sMin) * i) / 80
      const x = this.xFor(S)
      const y = this.yFor(this.smoothValue(S))
      if (first) {
        this.smooth.moveTo(x, y)
        first = false
      } else this.smooth.lineTo(x, y)
    }
    this.smooth.strokePath()
    this.label(this.xFor(this.p.sMax) - 4, this.yFor(this.smoothValue(this.p.sMax)) - 14, 'pre-expiry curve', {
      size: 10,
      col: C.blue,
      align: 'right',
    })
  }

  private deltaSpot(): number {
    return this.spotOverride ?? this.p.K
  }
  private spotOverride?: number

  // interpolate illustrative delta from anchors
  private deltaAt(S: number): number {
    const a = this.anchors
    if (S <= a[0].S) return a[0].delta
    if (S >= a[a.length - 1].S) return a[a.length - 1].delta
    for (let i = 0; i < a.length - 1; i++) {
      if (S >= a[i].S && S <= a[i + 1].S) {
        const t = (S - a[i].S) / (a[i + 1].S - a[i].S)
        return a[i].delta + t * (a[i + 1].delta - a[i].delta)
      }
    }
    return 0.5
  }

  // override spot-dot updates to also tilt the tangent + delta readouts.
  // (super.build() may call this before the delta overlay is constructed — guard it.)
  protected updateSpot(S: number): void {
    this.spotOverride = S
    super.updateSpot(S)
    if (this.tangent && this.deltaText && this.gaugeFill) this.updateDelta(S)
  }

  private updateDelta(S: number): void {
    const delta = this.deltaAt(S)
    const x = this.xFor(S)
    const y = this.yFor(this.smoothValue(S))
    // tangent: slope = delta in value-per-$; draw a short segment ±9 in S
    const dS = 9
    // value units per S unit on screen
    const yPerVal = this.plot.h / (this.yMax - this.yMin)
    const xPerS = this.plot.w / (this.p.sMax - this.p.sMin)
    const dx = dS * xPerS
    const dy = delta * dS * yPerVal
    this.tangent.clear()
    this.tangent.lineStyle(2.5, C.ink)
    this.tangent.lineBetween(x - dx, y + dy, x + dx, y - dy)

    const shares = Math.round(delta * 100)
    this.deltaText.setText(
      `δ ≈ ${delta.toFixed(2)} (illustrative)   +$1 stock → ~${(delta).toFixed(2)}/sh (≈ $${Math.round(
        delta * 100,
      )}/contract)   shares-equiv ${shares}`,
    )
    // gauge
    this.gaugeFill.clear()
    this.gaugeFill.fillStyle(C.blue, 1)
    this.gaugeFill.fillRoundedRect(this.gx, this.gy, this.gw * delta, 8, 4)
  }

  // keep the smooth curve in sync when CALL/PUT or LONG/SHORT toggles re-scale.
  protected refreshAll(): void {
    super.refreshAll()
    if (this.smooth) this.drawSmoothCurve()
  }
}
