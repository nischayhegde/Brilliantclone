import Phaser from 'phaser'
import { C, hex, FONT } from '../../../engine/palette'
import PayoffScene, { type PayoffParams } from './PayoffScene'
import { breakeven, maxLoss, maxGain, moneyness, pnlPerContract, pnlPerShare } from './optionMath'

interface CapstoneParams extends PayoffParams {
  /** anchor underlying for moneyness/delta. */
  anchorS?: number
  /** illustrative ATM delta for the readout. */
  delta?: number
  /** the embedded P&L check price (revealed on submit). */
  checkS?: number
}

/**
 * CapstoneScene (module 15) — a position builder (Type/Side/K/Premium) over the
 * PayoffScene workhorse, a live readout panel (breakeven / max loss / max gain /
 * moneyness / delta), an embedded P&L check graded on reveal, and a summary reel.
 */
export default class CapstoneScene extends PayoffScene {
  private cp!: CapstoneParams
  private readoutPanel!: Phaser.GameObjects.Text
  private challengeTxt!: Phaser.GameObjects.Text
  private revealedCheck = false

  protected build(): void {
    this.cp = this.params as CapstoneParams
    // force interactive controls + spot dot; we supply our own leg toggles below.
    ;(this.params as PayoffParams).mode = 'interactive'
    ;(this.params as PayoffParams).controls = true
    ;(this.params as PayoffParams).legToggles = false
    super.build()

    // readout panel (right side, below the risk badge) — in ONE fixed bg panel so its
    // six lines stay legible over the curve/shading and never overlap the axis labels.
    const rpW = 226
    const rpH = 142
    const rpX = this.plot.r - rpW
    const rpY = this.plot.t + 40
    this.panel(rpX, rpY, rpW, rpH, { fill: C.white, stroke: C.blue, radius: 10, alpha: 0.95 })
    this.readoutPanel = this.add.text(rpX + 12, rpY + 12, '', {
      fontFamily: FONT,
      fontSize: '13px',
      color: hex(C.ink),
      lineSpacing: 5,
      wordWrap: { width: rpW - 24 },
    })

    // control strip below the plot (plot.b is at H-76)
    const rowToggles = this.H - 52
    const rowSliders = this.H - 22
    this.label(60, rowToggles, 'Type', { size: 10, col: C.muted })
    this.segToggle(150, rowToggles, ['CALL', 'PUT'], this.p.type === 'call' ? 0 : 1, (i) => {
      this.p.type = i === 0 ? 'call' : 'put'
      this.refreshAll()
    })
    this.label(250, rowToggles, 'Side', { size: 10, col: C.muted })
    this.segToggle(330, rowToggles, ['LONG', 'SHORT'], this.p.side === 'long' ? 0 : 1, (i) => {
      this.p.side = i === 0 ? 'long' : 'short'
      this.refreshAll()
    })
    // strike + premium sliders
    this.label(40, rowSliders, 'K', { size: 11, col: C.muted })
    this.slider(58, rowSliders, 180, this.p.sMin + 5, this.p.sMax - 5, this.p.K, (v) => {
      this.p.K = Math.round(v)
      this.refreshAll()
    }, { step: 1 })
    this.label(280, rowSliders, 'prem', { size: 11, col: C.muted })
    this.slider(320, rowSliders, 150, 1, 20, this.p.premium, (v) => {
      this.p.premium = Math.round(v * 2) / 2
      this.refreshAll()
    }, { step: 0.5 })

    this.challengeTxt = this.label(40, 40, '', { size: 13, col: C.blue, bold: true })
    this.challengeTxt.setWordWrapWidth(440)
    this.updateReadout()
  }

  protected refreshAll(): void {
    super.refreshAll()
    if (this.readoutPanel) this.updateReadout()
  }

  protected updateSpot(S: number): void {
    super.updateSpot(S)
    if (this.readoutPanel) this.updateReadout()
  }

  private updateReadout(): void {
    if (!this.readoutPanel || !this.challengeTxt) return
    const pos = { type: this.p.type, side: this.p.side, K: this.p.K, premium: this.p.premium }
    const be = breakeven(this.p.type, this.p.K, this.p.premium)
    const ml = maxLoss(pos)
    const mg = maxGain(pos)
    const anchorS = this.cp.anchorS ?? this.p.K
    const m = moneyness(this.p.type, anchorS, this.p.K)
    const delta = this.cp.delta ?? 0.5
    const lossTxt = ml === Infinity ? 'UNLIMITED' : `$${ml.toLocaleString()}`
    const gainTxt = mg === Infinity ? 'unlimited' : `$${mg.toLocaleString()}`
    this.readoutPanel.setText(
      [
        'YOUR POSITION',
        `Breakeven  ${be.toFixed(2)}`,
        `Max loss   ${lossTxt}`,
        `Max gain   ${gainTxt}`,
        `Moneyness  ${m} (S=${anchorS})`,
        `Delta      ≈ ${delta.toFixed(2)} (illustrative)`,
      ].join('\n'),
    )

    // Challenge feedback: the target is a long call (bullish, defined risk, the leg the
    // embedded P&L check is built on). Every branch states an accurate fact about the leg.
    if (this.p.type === 'call' && this.p.side === 'long') {
      this.challengeTxt.setText('✓ Bullish with DEFINED risk — a long call. Nice.').setColor(hex(C.green))
    } else if (this.p.type === 'call' && this.p.side === 'short') {
      this.challengeTxt.setText('Short call: Max loss = UNLIMITED — not defined risk (module 11).').setColor(hex(C.red))
    } else if (this.p.type === 'put' && this.p.side === 'short') {
      // A short put IS bullish and its loss IS capped — just nudge toward the target leg.
      this.challengeTxt
        .setText(`Short put: bullish, and its risk is capped at ${lossTxt} — but the classic defined-risk bullish play is the long call.`)
        .setColor(hex(C.blue))
    } else {
      // long put = bearish
      this.challengeTxt
        .setText('A long put is BEARISH (it profits when S falls). Aim for a bullish, defined-risk leg.')
        .setColor(hex(C.blue))
    }
  }

  // embedded P&L check: on reveal drop a marker at checkS and read the P&L
  protected onReveal(): void {
    super.onReveal()
    if (this.revealedCheck) return
    this.revealedCheck = true
    const S = this.cp.checkS ?? this.p.K + this.p.premium + 5
    const pos = { type: this.p.type, side: this.p.side, K: this.p.K, premium: this.p.premium }
    const vShare = pnlPerShare(pos, S)
    const vContract = pnlPerContract(pos, S)
    const x = this.xFor(S)
    const y = this.yFor(vShare)
    const y0 = this.yFor(0)
    const col = vShare >= 0 ? C.green : C.red
    const g = this.add.graphics()
    g.lineStyle(1.5, col, 0.8)
    g.lineBetween(x, this.plot.b, x, y)
    const dot = this.add.circle(x, y, 6, col).setStrokeStyle(2, C.white).setScale(0)
    this.tweens.add({ targets: dot, scale: 1, duration: 300, ease: 'Back.out' })
    g.lineStyle(1, col, 0.4)
    g.lineBetween(this.plot.l, y0, x, y0)
    const sign = (n: number) => `${n >= 0 ? '+' : '−'}`
    const tag = this.label(
      x,
      y + (vShare >= 0 ? -20 : 20),
      `S=${S}: ${sign(vShare)}${Math.abs(vShare).toFixed(2)}/sh = ${sign(vContract)}$${Math.abs(vContract).toFixed(
        0,
      )}/contract`,
      { size: 13, col, bold: true, align: 'center', bg: true },
    )
    tag.setAlpha(0)
    this.tweens.add({ targets: tag, alpha: 1, duration: 300, delay: 200 })

    this.runSummaryReel()
  }

  // summary reel: three one-line takeaways fade in sequence
  private runSummaryReel(): void {
    const lines = [
      'premium = intrinsic + time value',
      'hockey-stick payoff · breakeven = K ± premium',
      'delta & leverage vs the underlying',
    ]
    const panel = this.panel(this.plot.l + 40, this.plot.t + 64, 372, 108, {
      fill: C.blueSoft,
      stroke: C.blue,
      radius: 10,
    })
    panel.setAlpha(0)
    this.tweens.add({ targets: panel, alpha: 1, duration: 300, delay: 600 })
    this.label(this.plot.l + 56, this.plot.t + 84, 'LESSON RECAP', { size: 13, col: C.blue, bold: true }).setAlpha(0)
    lines.forEach((ln, i) => {
      const t = this.label(this.plot.l + 56, this.plot.t + 108 + i * 20, `• ${ln}`, { size: 13, col: C.ink })
      t.setAlpha(0)
      this.tweens.add({ targets: t, alpha: 1, duration: 300, delay: 900 + i * 400 })
    })
  }
}
