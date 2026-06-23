import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { leverageReturn } from './optionMath'

interface LeverageParams {
  /** underlying anchor price. */
  S0?: number
  K?: number
  /** illustrative ATM call premium per share. */
  premium?: number
  /** dollars committed to BOTH sides. */
  budget?: number
}

/**
 * LeverageScene — same budget buys N shares OR one call controlling 100 shares.
 * Drag the % move dial; both columns animate; the call's % swing dwarfs the stock's
 * and bottoms at −100% at/below the strike. All returns computed exactly.
 */
export default class LeverageScene extends ModuleScene {
  private p!: Required<LeverageParams>
  private movePct = 10

  private stockBar!: Phaser.GameObjects.Graphics
  private callBar!: Phaser.GameObjects.Graphics
  private stockTxt!: Phaser.GameObjects.Text
  private callTxt!: Phaser.GameObjects.Text
  private baseY = 300

  protected build(): void {
    const raw = this.params as LeverageParams
    this.p = {
      S0: raw.S0 ?? 100,
      K: raw.K ?? 100,
      premium: raw.premium ?? 5,
      budget: raw.budget ?? 500,
    }

    const shares = this.p.budget / this.p.S0
    this.label(40, 24, `LEVERAGE — same $${this.p.budget} budget`, { size: 14, col: C.ink, bold: true })
    this.label(40, 44, `$${this.p.budget} buys ${shares} shares @ $${this.p.S0}  OR  one $${this.p.premium.toFixed(
      2,
    )} call (controls 100 shares). (premium illustrative; returns exact)`, { size: 11, col: C.muted })

    // two columns
    const sx = 230
    const cx = 520
    this.label(sx, 90, 'STOCK', { size: 16, col: C.green, bold: true, align: 'center' })
    this.label(cx, 90, 'CALL', { size: 16, col: C.blue, bold: true, align: 'center' })
    // zero line
    const g = this.add.graphics()
    g.lineStyle(1.5, C.gray200)
    g.lineBetween(120, this.baseY, 640, this.baseY)
    this.label(110, this.baseY, '0%', { size: 11, col: C.muted, align: 'right' })

    this.stockBar = this.add.graphics()
    this.callBar = this.add.graphics()
    this.stockTxt = this.label(sx, this.baseY + 110, '', { size: 12, col: C.ink, bold: true, align: 'center' })
    this.callTxt = this.label(cx, this.baseY + 110, '', { size: 12, col: C.ink, bold: true, align: 'center' })

    // % move dial (slider)
    this.label(190, 400, 'Move in the underlying', { size: 12, col: C.muted })
    this.slider(190, 422, 360, -30, 30, this.movePct, (v) => {
      this.movePct = v
      this.refresh()
    }, { step: 1 })

    this.refresh()
    this.emitReady()
  }

  private refresh(): void {
    const sNew = this.p.S0 * (1 + this.movePct / 100)
    const stockRet = this.movePct / 100
    const callRet = leverageReturn(this.p.K, this.p.premium, sNew)
    const shares = this.p.budget / this.p.S0
    const stockPnl = this.p.budget * stockRet
    const callPnl = this.p.budget * callRet // one contract = whole budget

    const maxAbs = 3 // ±300% scale ceiling for bar height
    const h = 150
    const barFor = (g: Phaser.GameObjects.Graphics, x: number, ret: number) => {
      g.clear()
      const clamped = Phaser.Math.Clamp(ret, -1, maxAbs)
      const barH = (Math.abs(clamped) / maxAbs) * h
      const up = ret >= 0
      g.fillStyle(up ? C.green : C.red, 1)
      if (up) g.fillRoundedRect(x - 40, this.baseY - barH, 80, barH, 6)
      else g.fillRoundedRect(x - 40, this.baseY, 80, barH, 6)
    }
    barFor(this.stockBar, 230, stockRet)
    barFor(this.callBar, 520, callRet)

    const pct = (r: number) => `${r >= 0 ? '+' : '−'}${Math.abs(r * 100).toFixed(0)}%`
    const usd = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(0)}`
    this.stockTxt.setText(`${shares} shares\n${pct(stockRet)}  (${usd(stockPnl)})`).setColor(
      hex(stockRet >= 0 ? C.green : C.red),
    )
    const wipeout = callRet <= -0.999
    this.callTxt
      .setText(`1 contract\n${pct(callRet)}  (${usd(callPnl)})${wipeout ? '  ⚠ wipeout' : ''}`)
      .setColor(hex(callRet >= 0 ? C.green : C.red))

    // headline at top
    this.headline?.destroy()
    this.headline = this.label(
      380,
      this.baseY - 165,
      `stock S → ${sNew.toFixed(0)}   ·   call value at expiry = max(${sNew.toFixed(0)}−${this.p.K},0) = ${Math.max(
        sNew - this.p.K,
        0,
      ).toFixed(2)}`,
      { size: 12, col: C.ink, bold: true, align: 'center' },
    )
  }
  private headline?: Phaser.GameObjects.Text
}
