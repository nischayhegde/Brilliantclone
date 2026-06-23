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

/**
 * Module 15 CAPSTONE — "Trade an Earnings Event".
 *
 * Recap reel (V → valley → IV balloon pop → short mirror) then a build → commit →
 * run → grade flow. The learner picks structure + side + expectation, runs an earnings
 * event (a labeled realized move + IV crush), and gets a scorecard graded against the
 * breakevens. All math exact per payoffMath. Self-contained in-canvas interactivity.
 */
export default class CapstoneScene extends ModuleScene {
  private phase: 'reel' | 'build' = 'reel'
  private structure: 'straddle' | 'strangle' = 'straddle'
  private side: Side = 'long'
  private expectBig = true
  private realizedS = 106 // default realized move +6% → 106 (a "moved but lost" for the long straddle)

  // payoff mini-panel
  private vx = 40
  private vy = 64
  private vw = 320
  private vh = 200

  private reelG!: Phaser.GameObjects.Graphics
  private reelLabel!: Phaser.GameObjects.Text
  private payoffG!: Phaser.GameObjects.Graphics
  private structBtns: Phaser.GameObjects.Container[] = []
  private sideBtns: Phaser.GameObjects.Container[] = []
  private expectBtns: Phaser.GameObjects.Container[] = []
  private scoreContainer?: Phaser.GameObjects.Container

  protected build(): void {
    this.label(20, 14, 'Capstone — Trade an Earnings Event', { size: 15, bold: true, col: C.ink })
    this.reelG = this.add.graphics()
    this.reelLabel = this.label(this.W / 2, this.H - 40, '', { size: 13, col: C.blue, bold: true, align: 'center' })
    this.playReel()
  }

  // --- recap reel -----------------------------------------------------------
  private playReel(): void {
    const cx = this.W / 2
    const cy = 210
    const drawShape = (kind: 'V' | 'valley' | 'balloon' | 'short', cap: string) => {
      this.reelG.clear()
      this.reelLabel.setText(cap)
      const g = this.reelG
      const sx = (p: number) => cx - 160 + ((p - 80) / 40) * 320
      const sy = (v: number) => cy - v * 7
      if (kind === 'V' || kind === 'valley' || kind === 'short') {
        const legs =
          kind === 'V' ? straddle(100, 4, 3, 'long')
          : kind === 'valley' ? strangle(95, 105, 1.25, 1.75, 'long')
          : straddle(100, 4, 3, 'short')
        g.lineStyle(1.5, C.blue, 0.5)
        g.lineBetween(sx(80), sy(0), sx(120), sy(0))
        g.lineStyle(3, kind === 'short' ? C.red : C.green, 1)
        g.beginPath()
        let first = true
        for (let p = 80; p <= 120; p += 0.5) {
          const v = Math.max(-12, Math.min(12, combinedPnL(legs, p)))
          if (first) { g.moveTo(sx(p), sy(v)); first = false } else g.lineTo(sx(p), sy(v))
        }
        g.strokePath()
      } else {
        // IV balloon
        g.fillStyle(C.blueSoft, 0.7)
        g.fillCircle(cx, cy - 10, 70)
        g.lineStyle(2, C.blue, 1)
        g.strokeCircle(cx, cy - 10, 70)
      }
    }

    const steps: Array<[() => void, number]> = [
      [() => drawShape('V', 'Straddle = a V · breakevens K ± premium'), 0],
      [() => drawShape('valley', 'Strangle = a flat-bottomed valley · cheaper, needs a bigger move'), 1100],
      [() => drawShape('balloon', 'IV crush: clear the breakeven, not just move'), 2200],
      [() => drawShape('short', 'Short = the mirror · collect premium, large risk'), 3300],
    ]
    for (const [fn, delay] of steps) this.time.delayedCall(delay, fn)
    this.time.delayedCall(4500, () => this.startBuild())
  }

  // --- build phase ----------------------------------------------------------
  private startBuild(): void {
    this.phase = 'build'
    this.reelG.clear()
    this.reelLabel.setText('')
    this.payoffG = this.add.graphics()

    this.panel(this.vx - 12, this.vy - 30, this.vw + 24, this.vh + 56, { fill: C.white, stroke: C.hairline, radius: 12 })
    this.label(this.vx + this.vw / 2, this.vy - 18, 'your payoff (rich pre-event IV)', { size: 11, col: C.muted, align: 'center' })

    // controls (right column)
    const px = 400
    this.label(px, 70, 'Structure', { size: 11, col: C.muted })
    this.structBtns = [
      this.button(px + 60, 90, 'Straddle', () => this.setStruct('straddle'), { w: 100, h: 26 }),
      this.button(px + 170, 90, 'Strangle', () => this.setStruct('strangle'), { w: 100, h: 26, fill: C.gray200, textCol: C.ink }),
    ]
    this.label(px, 122, 'Side', { size: 11, col: C.muted })
    this.sideBtns = [
      this.button(px + 60, 142, 'Long', () => this.setSide('long'), { w: 100, h: 26 }),
      this.button(px + 170, 142, 'Short', () => this.setSide('short'), { w: 100, h: 26, fill: C.gray200, textCol: C.ink }),
    ]
    this.label(px, 174, 'Your expectation', { size: 11, col: C.muted })
    this.expectBtns = [
      this.button(px + 70, 194, 'Big move', () => this.setExpect(true), { w: 110, h: 26 }),
      this.button(px + 190, 194, 'Quiet pin', () => this.setExpect(false), { w: 110, h: 26, fill: C.gray200, textCol: C.ink }),
    ]

    const moveLabel = this.label(px, 232, '', { size: 11, col: C.ink, bold: true })
    moveLabel.setText(`Realized move: S = ${fmt(this.realizedS)}`)
    this.slider(px, 250, 280, 80, 120, this.realizedS, (v) => {
      this.realizedS = v
      moveLabel.setText(`Realized move: S = ${fmt(this.realizedS)} (set, or accept default)`)
    }, { step: 0.5 })

    this.button(px + 90, 300, 'Run earnings ▶', () => this.runEarnings(), { w: 200, h: 34, fill: C.green })

    this.drawPayoff()
    this.time.delayedCall(300, () => this.emitReady())
  }

  private legs(): Leg[] {
    return this.structure === 'straddle' ? straddle(100, 4, 3, this.side) : strangle(95, 105, 1.25, 1.75, this.side)
  }

  private vxFor(p: number): number {
    return this.vx + ((p - 80) / 40) * this.vw
  }
  private vyFor(v: number): number {
    const span = 12
    return this.vy + this.vh - ((v + span) / (2 * span)) * this.vh
  }

  private drawPayoff(): void {
    if (!this.payoffG) return
    const g = this.payoffG
    g.clear()
    const legs = this.legs()
    const be = breakevens(legs)
    const y0 = this.vyFor(0)
    g.lineStyle(1.5, C.blue, 0.6)
    g.lineBetween(this.vx, y0, this.vx + this.vw, y0)
    for (const px of [...new Set(legs.map((l) => l.K)), be.lower, be.upper]) {
      const x = this.vxFor(px)
      g.lineStyle(1.2, C.blue, 0.7)
      for (let yy = this.vy; yy < this.vy + this.vh; yy += 9) g.lineBetween(x, yy, x, Math.min(yy + 5, this.vy + this.vh))
    }
    g.lineStyle(3, isShort(legs) ? C.red : C.green, 1)
    g.beginPath()
    let first = true
    for (let p = 80; p <= 120; p += 0.5) {
      const v = Math.max(-12, Math.min(12, combinedPnL(legs, p)))
      if (first) { g.moveTo(this.vxFor(p), this.vyFor(v)); first = false } else g.lineTo(this.vxFor(p), this.vyFor(v))
    }
    g.strokePath()
  }

  private setStruct(s: 'straddle' | 'strangle'): void { this.structure = s; this.highlight(this.structBtns, s === 'straddle' ? 0 : 1); this.drawPayoff() }
  private setSide(s: Side): void { this.side = s; this.highlight(this.sideBtns, s === 'long' ? 0 : 1); this.drawPayoff() }
  private setExpect(big: boolean): void { this.expectBig = big; this.highlight(this.expectBtns, big ? 0 : 1) }

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

  // --- run + scorecard ------------------------------------------------------
  private runEarnings(): void {
    if (this.scoreContainer) this.scoreContainer.destroy()
    const legs = this.legs()
    const be = breakevens(legs)
    const total = totalPremium(legs)
    const S = this.realizedS
    const pnl = combinedPnL(legs, S)
    const short = isShort(legs)
    const win = pnl > 0
    const insideBand = S >= be.lower && S <= be.upper

    // walk a dot to the landing spot
    const dot = this.add.circle(this.vxFor(100), this.vyFor(short ? total : -total), 8, C.blue).setStrokeStyle(3, C.white)
    const landY = this.vyFor(Math.max(-12, Math.min(12, pnl)))
    this.tweens.add({ targets: dot, x: this.vxFor(Phaser.Math.Clamp(S, 80, 120)), y: landY, duration: 700, ease: 'Cubic.out' })
    dot.setFillStyle(win ? C.green : C.red)

    // scorecard (bottom-left, under the payoff panel)
    const cw = 700
    const cx = 28
    const cyTop = 344
    const panel = this.panel(cx, cyTop, cw, 106, { fill: win ? C.greenSoft : C.redSoft, stroke: win ? C.green : C.red, radius: 12 })
    const verdict = this.label(cx + 16, cyTop + 18, win ? 'WIN' : 'LOSS', { size: 18, bold: true, col: win ? C.green : C.red })
    const ivNote = short
      ? (insideBand ? 'Quiet pin — you kept the premium and IV crush helped you.' : 'Big move broke out — short risk bit (large loss).')
      : (win ? 'You cleared a breakeven — the move was big enough.' : 'Moved but lost — the move stayed inside the breakevens. Clear the breakeven, not just move.')
    // embedded check: was the expectation matched to the structure?
    const wellMatched = (this.expectBig && this.side === 'long') || (!this.expectBig && this.side === 'short')
    const lines = [
      `${this.structure} · ${this.side} · breakevens ${fmt(be.lower)} / ${fmt(be.upper)} · realized S = ${fmt(S)} (${insideBand ? 'inside' : 'outside'} the band)`,
      `P&L = ${fmtSigned(pnl)} per share (${fmtDollars(pnl)}).  ${ivNote}`,
      wellMatched ? '✓ your structure matched your stated expectation' : '✗ your structure did not match your stated expectation',
    ]
    const texts = lines.map((ln, i) => {
      const t = this.label(cx + 90, cyTop + 16 + i * 26, ln, { size: 12, col: i === 2 ? (wellMatched ? C.green : C.muted) : C.ink })
      t.setWordWrapWidth(cw - 110)
      return t
    })
    this.scoreContainer = this.add.container(0, 0, [panel, verdict, ...texts])
    this.scoreContainer.alpha = 0
    this.tweens.add({ targets: this.scoreContainer, alpha: 1, duration: 400, delay: 400 })
  }

  // React may emit 'reveal' for the embedded check; just run the event if not yet run.
  protected onReveal(): void {
    if (this.phase === 'build' && !this.scoreContainer) this.runEarnings()
  }
}
