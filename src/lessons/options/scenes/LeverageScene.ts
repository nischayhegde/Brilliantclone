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
 * LeverageScene — a call is a MAGNIFYING GLASS over the move. The underlying's
 * small % move sits on a number line; a lens enlarges it into the call's actual
 * (amplified) % return — soaring on the upside, but bottoming at −100% at/below
 * the strike. Same $ budget buys 5 shares OR one contract. All returns are exact.
 */
export default class LeverageScene extends ModuleScene {
  private p!: Required<LeverageParams>
  private movePct = 10

  // lens geometry
  private cx = 380
  private cy = 236
  private r = 78
  // axis geometry
  private axisY = 120
  private axisL = 120
  private axisR = 640

  private lens!: Phaser.GameObjects.Graphics
  private marker!: Phaser.GameObjects.Arc
  private markerChip!: Phaser.GameObjects.Graphics
  private markerTxt!: Phaser.GameObjects.Text
  private connector!: Phaser.GameObjects.Graphics
  private lensBar!: Phaser.GameObjects.Graphics
  private callPctTxt!: Phaser.GameObjects.Text
  private wipeTxt!: Phaser.GameObjects.Text
  private stockTxt!: Phaser.GameObjects.Text
  private callTxt!: Phaser.GameObjects.Text
  private headline!: Phaser.GameObjects.Text
  private headlineChip!: Phaser.GameObjects.Graphics

  protected build(): void {
    const raw = this.params as LeverageParams
    this.p = {
      S0: raw.S0 ?? 100,
      K: raw.K ?? 100,
      premium: raw.premium ?? 5,
      budget: raw.budget ?? 500,
    }

    const shares = this.p.budget / this.p.S0
    this.label(40, 24, `LEVERAGE — same $${this.p.budget} budget`, { size: this.fs(16), col: C.ink, bold: true })
    this.label(
      40,
      46,
      `$${this.p.budget} buys ${shares} shares @ $${this.p.S0}  OR  one $${this.p.premium.toFixed(
        2,
      )} call (controls 100 shares).`,
      { size: this.fs(13), col: C.muted },
    )
    this.label(40, 64, '(premium illustrative; returns exact)', { size: this.fs(13), col: C.muted })

    this.buildAxis()
    this.buildLens()

    // readouts flanking the lens
    this.stockTxt = this.label(176, 372, '', { size: this.fs(13), col: C.green, bold: true, align: 'center' })
    this.callTxt = this.label(580, 372, '', { size: this.fs(13), col: C.blue, bold: true, align: 'center' })

    // exact call-value formula headline (persistent, re-targeted each drag)
    this.headlineChip = this.add.graphics()
    this.headline = this.label(this.cx, 330, '', { size: this.fs(13), col: C.ink, bold: true, align: 'center' })

    // % move dial (slider) — drives the underlying's move
    this.label(120, 410, 'Move in the underlying', { size: this.fs(13), col: C.muted })
    this.slider(
      160,
      434,
      440,
      -30,
      30,
      this.movePct,
      (v) => {
        this.movePct = v
        this.refresh()
      },
      { step: 1 },
    )

    this.refresh()
    this.entrance()
    this.emitReady()
  }

  private buildAxis(): void {
    this.label(this.axisL, 96, 'Underlying move', { size: this.fs(13), col: C.muted })
    const g = this.add.graphics()
    g.lineStyle(2, C.gray200)
    g.lineBetween(this.axisL, this.axisY, this.axisR, this.axisY)
    // zero tick
    g.lineStyle(2, C.blue, 0.6)
    g.lineBetween(this.cx, this.axisY - 7, this.cx, this.axisY + 7)
    this.label(this.cx, this.axisY + 16, '0%', { size: this.fs(12), col: C.muted, align: 'center' })
    this.label(this.axisL, this.axisY + 16, '−30%', { size: this.fs(12), col: C.muted, align: 'center' })
    this.label(this.axisR, this.axisY + 16, '+30%', { size: this.fs(12), col: C.muted, align: 'center' })

    this.connector = this.add.graphics()
    this.markerChip = this.add.graphics()
    this.marker = this.add.circle(this.cx, this.axisY, 8, C.green).setStrokeStyle(3, C.white)
    this.markerTxt = this.label(this.cx, this.axisY - 22, '', { size: this.fs(12), col: C.ink, bold: true, align: 'center' })
  }

  private buildLens(): void {
    const lens = this.add.graphics()
    // glass
    lens.fillStyle(C.white, 0.65)
    lens.fillCircle(this.cx, this.cy, this.r)
    // handle (down-right, outside the rim)
    const a = Math.PI / 4
    const hx1 = this.cx + Math.cos(a) * this.r
    const hy1 = this.cy + Math.sin(a) * this.r
    const hx2 = this.cx + Math.cos(a) * (this.r + 46)
    const hy2 = this.cy + Math.sin(a) * (this.r + 46)
    lens.lineStyle(11, C.muted, 1)
    lens.lineBetween(hx1, hy1, hx2, hy2)
    // rim on top
    lens.lineStyle(6, C.blue, 1)
    lens.strokeCircle(this.cx, this.cy, this.r)
    this.lens = lens

    this.label(this.cx, this.cy - 50, 'CALL (magnified)', { size: this.fs(13), col: C.blue, bold: true, align: 'center' })
    this.lensBar = this.add.graphics()
    this.callPctTxt = this.label(this.cx, this.cy - 6, '', { size: this.fs(28), col: C.green, bold: true, align: 'center' })
    this.wipeTxt = this.label(this.cx, this.cy + 50, '', { size: this.fs(12), col: C.red, bold: true, align: 'center' })
  }

  private refresh(): void {
    const sNew = this.p.S0 * (1 + this.movePct / 100)
    const stockRet = this.movePct / 100
    const callRet = leverageReturn(this.p.K, this.p.premium, sNew)
    const shares = this.p.budget / this.p.S0
    const stockPnl = this.p.budget * stockRet
    const callPnl = this.p.budget * callRet // one contract = whole budget

    const pct = (rt: number) => `${rt >= 0 ? '+' : '−'}${Math.abs(rt * 100).toFixed(0)}%`
    const usd = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(0)}`

    // marker on the underlying axis
    const markerX = this.cx + (this.movePct / 30) * ((this.axisR - this.axisL) / 2)
    this.marker.setX(markerX).setFillStyle(stockRet >= 0 ? C.green : C.red)
    this.markerTxt.setText(`stock ${pct(stockRet)}`).setX(markerX)
    this.chipFor(this.markerChip, this.markerTxt)

    // connector from the marker into the top of the lens
    this.connector.clear()
    this.connector.lineStyle(1.5, C.muted, 0.5)
    this.dashSeg(this.connector, markerX, this.axisY + 6, this.cx, this.cy - this.r)

    // lens contents: the call's ACTUAL amplified return
    const up = callRet >= 0
    this.callPctTxt.setText(pct(callRet)).setColor(hex(up ? C.green : C.red))
    const maxAbs = 3 // ±300% scale ceiling, matching the exact-return clamp
    const clamped = Phaser.Math.Clamp(callRet, -1, maxAbs)
    const barW = (Math.abs(clamped) / maxAbs) * 120
    this.lensBar.clear()
    this.lensBar.fillStyle(up ? C.green : C.red, 1)
    if (up) this.lensBar.fillRoundedRect(this.cx, this.cy + 18, barW, 12, 4)
    else this.lensBar.fillRoundedRect(this.cx - barW, this.cy + 18, barW, 12, 4)
    const wipeout = callRet <= -0.999
    this.wipeTxt.setText(wipeout ? '⚠ premium wiped out' : '')

    // flanking readouts (with the dollar outcomes)
    this.stockTxt
      .setText(`STOCK · ${shares} shares\n${pct(stockRet)}   (${usd(stockPnl)})`)
      .setColor(hex(stockRet >= 0 ? C.green : C.red))
    this.callTxt
      .setText(`CALL · 1 contract\n${pct(callRet)}   (${usd(callPnl)})`)
      .setColor(hex(callRet >= 0 ? C.green : C.red))

    // exact formula headline
    this.headline.setText(
      `stock S → ${sNew.toFixed(0)}   ·   call value at expiry = max(${sNew.toFixed(0)}−${this.p.K},0) = ${Math.max(
        sNew - this.p.K,
        0,
      ).toFixed(2)}`,
    )
    this.chipFor(this.headlineChip, this.headline)
  }

  private chipFor(g: Phaser.GameObjects.Graphics, t: Phaser.GameObjects.Text): void {
    const padX = 6
    const padY = 3
    g.clear()
    g.fillStyle(C.white, 0.85)
    g.fillRoundedRect(
      t.x - t.originX * t.width - padX,
      t.y - t.originY * t.height - padY,
      t.width + padX * 2,
      t.height + padY * 2,
      5,
    )
    this.children.moveBelow(g, t)
  }

  private dashSeg(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dash = 7, gap = 5): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len === 0) return
    const ux = dx / len
    const uy = dy / len
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(d + dash, len)
      g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e)
    }
  }

  /** Gentle fade-in for the lens + marker (instant under reduced motion). */
  private entrance(): void {
    const targets = [this.lens, this.lensBar, this.callPctTxt, this.marker, this.connector]
    targets.forEach((t) => ((t as unknown as { alpha: number }).alpha = 0))
    this.tweens.add({ targets, alpha: 1, duration: this.dur(380), ease: 'Cubic.out' })
  }
}
