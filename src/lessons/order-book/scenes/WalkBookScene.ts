import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtMoney, fmtPrice, fmtShares, walkBuy, type Level } from './book'

interface WalkBookParams {
  asks?: Level[]
  startSize?: number
  maxSize?: number
}

const DEFAULT_ASKS: Level[] = [
  { price: 100.02, size: 500 },
  { price: 100.05, size: 800 },
  { price: 100.1, size: 1500 },
]

/**
 * MODULE 9 — TEACH "Walking the Book & Slippage". Metaphor: buying every seat to a
 * show. Each ask level is a ROW of seats at its own price; the cheapest row sells out
 * first, so a bigger order climbs to pricier rows and its AVERAGE seat drifts above the
 * cheapest one (the touch). A size slider re-walks the book live; an entrance sweep
 * animates the order climbing row by row so the cause→effect is unmissable. Sold seats
 * shade red, a blue "your average" line rises off the grey touch line, and a red caliper
 * + label call out the gap = slippage. Math is exact (walkBuy); only the picture changed.
 */
export default class WalkBookScene extends ModuleScene {
  private asks: Level[] = []
  private size = 1000
  private maxOrder = 2500

  private readonly plotL = 60
  private readonly plotR = 430
  private readonly plotT = 70
  private readonly plotB = 320
  private pMin = 0
  private pMax = 1
  private totalDepth = 0

  private dynG!: Phaser.GameObjects.Graphics
  private readouts: Record<string, Phaser.GameObjects.Text> = {}
  private levelLabels: Phaser.GameObjects.Text[] = []
  private avgTag!: Phaser.GameObjects.Text
  private slipTag!: Phaser.GameObjects.Text

  protected build(): void {
    const p = this.params as WalkBookParams
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => a.price - b.price)
    this.size = p.startSize ?? 1000
    this.totalDepth = this.asks.reduce((s, l) => s + l.size, 0)
    this.maxOrder = p.maxSize ?? Math.ceil((this.totalDepth * 1.05) / 100) * 100

    const lo = this.asks[0].price
    const hi = this.asks[this.asks.length - 1].price
    this.pMin = lo - (hi - lo) * 0.25 - 0.01
    this.pMax = hi + (hi - lo) * 0.25 + 0.01

    this.label(this.W / 2, 32, 'A bigger order eats the cheap shares first, then climbs to pricier ones', {
      size: this.fs(13),
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated depth — math exact', { size: this.fs(11, 11, 13), col: C.blue }).setAlpha(0.8)

    this.drawStatic()
    this.dynG = this.add.graphics()
    // Plot callouts that ride the moving lines (kept above dynG so they stay readable).
    this.avgTag = this.label(this.plotL + 6, this.yFor(this.asks[0].price), 'your average', {
      size: this.fs(12),
      col: C.blue,
      bold: true,
      bg: true,
      bgCol: C.blueSoft,
    }).setVisible(false)
    this.slipTag = this.label(0, 0, '', { size: this.fs(12), col: C.red, bold: true, bg: true }).setVisible(false)
    this.buildPanel()
    this.buildSlider()

    this.playEntrance()
  }

  private xFor(cum: number): number {
    // cumulative shares -> x across the plot (depth axis)
    return this.plotL + (Math.min(cum, this.totalDepth) / this.totalDepth) * (this.plotR - this.plotL)
  }
  private yFor(price: number): number {
    const t = (price - this.pMin) / (this.pMax - this.pMin)
    return this.plotB - t * (this.plotB - this.plotT)
  }

  private drawStatic(): void {
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline, 1)
    g.lineBetween(this.plotL, this.plotB, this.plotR, this.plotB)
    g.lineBetween(this.plotL, this.plotT, this.plotL, this.plotB)
    // price gridlines + labels at each ask price
    for (const lvl of this.asks) {
      const y = this.yFor(lvl.price)
      g.lineStyle(1, C.gray100, 1)
      g.lineBetween(this.plotL, y, this.plotR, y)
      this.label(this.plotL - 8, y, fmtPrice(lvl.price), { size: this.fs(12), col: C.muted, align: 'right' })
    }
    this.label((this.plotL + this.plotR) / 2, this.plotB + 18, 'shares bought →', {
      size: this.fs(12),
      col: C.muted,
      align: 'center',
    })

    // Each ask level is a ROW of seats: a faint block of "available seats" the width of
    // its size, sitting at its price. Sold seats (the red fill in recompute) overlay the
    // left of each block, so you literally watch cheap rows empty as the order climbs.
    let cum = 0
    this.asks.forEach((lvl, i) => {
      const x1 = this.xFor(cum)
      const x2 = this.xFor(cum + lvl.size)
      const y = this.yFor(lvl.price)
      g.fillStyle(C.gray100, 1)
      g.fillRect(x1, y, x2 - x1, this.plotB - y)
      g.lineStyle(1.5, C.red, 0.35)
      g.lineBetween(x1, y, x2, y)
      g.lineBetween(x2, y, x2, this.plotB)
      this.label((x1 + x2) / 2, y - 9, `${fmtShares(lvl.size)} shares`, {
        size: this.fs(11, 11, 13),
        col: C.muted,
        align: 'center',
      })
      const rowTag = i === 0 ? 'cheapest row' : i === this.asks.length - 1 ? 'priciest row' : 'next row up'
      this.label((x1 + x2) / 2, this.plotB - 10, rowTag, { size: this.fs(11, 11, 13), col: C.muted, align: 'center' })
      cum += lvl.size
    })

    // grey "touch" line = the cheapest seat in the house.
    const touchY = this.yFor(this.asks[0].price)
    this.dashedLine(this.plotL, touchY, this.plotR, C.muted, 6, 5, 1.5)
    this.label(this.plotR + 4, touchY, 'best price', { size: this.fs(12), col: C.muted, bg: true })
  }

  private recompute(): void {
    const r = walkBuy(this.asks, this.size)
    this.dynG.clear()

    // shade SOLD seats in each consumed row red. Levels fill in order and (except possibly
    // the last) fully, so cumulative-share x stays aligned with the row blocks.
    let cum = 0
    for (const f of r.fills) {
      const x1 = this.xFor(cum)
      const x2 = this.xFor(cum + f.shares)
      const y = this.yFor(f.price)
      this.dynG.fillStyle(C.red, 0.32)
      this.dynG.fillRect(x1, y, x2 - x1, this.plotB - y)
      this.dynG.lineStyle(2, C.red, 1)
      this.dynG.lineBetween(x1, y, x2, y)
      cum += f.shares
    }

    // blue "your average seat" line + the slippage gap above the touch.
    if (isFinite(r.avgFill)) {
      const xEnd = this.xFor(r.filled)
      const yAvg = this.yFor(r.avgFill)
      const yTouch = this.yFor(r.touch)
      // shade the gap between the cheapest seat and your average
      this.dynG.fillStyle(C.red, 0.12)
      this.dynG.fillRect(this.plotL, yAvg, xEnd - this.plotL, yTouch - yAvg)
      this.dynG.lineStyle(2.5, C.blue, 1)
      this.dynG.lineBetween(this.plotL, yAvg, xEnd, yAvg)

      // "your avg seat" tag rides the blue line.
      this.avgTag.setVisible(true).setPosition(this.plotL + 6, yAvg - 10)

      // red caliper + label marks the climb (= slippage). Only meaningful once you've
      // climbed past the cheapest row; hidden when the whole order fills at the touch.
      if (r.slippagePerShare > 1e-9) {
        this.dynG.lineStyle(2, C.red, 1)
        this.dynG.lineBetween(xEnd, yAvg, xEnd, yTouch)
        this.dynG.lineBetween(xEnd - 5, yAvg, xEnd + 5, yAvg)
        this.dynG.lineBetween(xEnd - 5, yTouch, xEnd + 5, yTouch)
        const midY = (yAvg + yTouch) / 2
        const nearRight = xEnd > this.plotR - 78
        this.slipTag
          .setVisible(true)
          .setText(`+${fmtPrice(r.slippagePerShare, 3)} slip`)
          .setOrigin(nearRight ? 1 : 0, 0.5)
          .setPosition(nearRight ? xEnd - 8 : xEnd + 8, midY)
      } else {
        this.slipTag.setVisible(false)
      }
    } else {
      this.avgTag.setVisible(false)
      this.slipTag.setVisible(false)
    }

    this.updateReadouts(r)
  }

  private playEntrance(): void {
    // Sweep the order up from zero so the learner watches it climb row by row and the
    // average drift above the touch. Collapses to the final frame under reduced motion.
    if (this.reduceMotion) {
      this.recompute()
      this.emitReady()
      return
    }
    const target = this.size
    const holder = { v: 0 }
    this.size = 0
    this.recompute()
    this.tweens.add({
      targets: holder,
      v: target,
      duration: this.dur(1100),
      ease: 'Cubic.out',
      onUpdate: () => {
        this.size = Math.round(holder.v / 100) * 100
        this.recompute()
      },
      onComplete: () => {
        this.size = target
        this.recompute()
        this.emitReady()
      },
    })
  }

  private buildPanel(): void {
    const px = 470
    const py = 56
    this.panel(px, py, 278, 286, { fill: C.blueSoft, stroke: C.blue, radius: 10 })
    this.label(px + 16, py + 22, 'Live fill', { size: this.fs(14), col: C.blue, bold: true })
    const mk = (key: string, y: number, lbl: string) => {
      this.label(px + 16, py + y, lbl, { size: this.fs(12), col: C.muted })
      this.readouts[key] = this.label(px + 262, py + y, '—', { size: this.fs(13), col: C.ink, bold: true, align: 'right' })
    }
    mk('order', 54, 'Order size')
    mk('avg', 84, 'Your average')
    mk('touch', 114, 'Best price')
    mk('slipps', 144, 'Slippage / share')
    mk('sliptot', 174, 'Slippage total')
    // per-level breakdown area
    this.label(px + 16, py + 204, 'Shares per row:', { size: this.fs(12), col: C.muted })
    for (let i = 0; i < 3; i++) {
      this.levelLabels[i] = this.label(px + 16, py + 222 + i * 17, '', { size: this.fs(12), col: C.ink })
    }
  }

  private buildSlider(): void {
    this.label(this.W / 2, 362, 'Order size', { size: this.fs(12), col: C.muted, align: 'center' })
    this.slider(this.W / 2 - 180, 388, 360, 100, this.maxOrder, this.size, (v) => {
      this.size = Math.round(v / 100) * 100
      this.recompute()
      this.emitReady()
    }, { step: 100, col: C.blue })
  }

  private updateReadouts(r: ReturnType<typeof walkBuy>): void {
    this.readouts.order.setText(fmtShares(this.size))
    this.readouts.avg.setText(isFinite(r.avgFill) ? fmtPrice(r.avgFill, 3) : '—')
    this.readouts.touch.setText(fmtPrice(r.touch))
    this.readouts.slipps.setText(r.slippagePerShare > 0 ? `+${fmtPrice(r.slippagePerShare, 3)}` : '0.000')
    this.readouts.slipps.setColor(hex(r.slippagePerShare > 0 ? C.red : C.green))
    this.readouts.sliptot.setText(r.slippageTotal > 0 ? fmtMoney(r.slippageTotal, 2) : '$0.00')
    this.readouts.sliptot.setColor(hex(r.slippageTotal > 0 ? C.red : C.green))

    this.levelLabels.forEach((t) => {
      t.setText('')
      t.setColor(hex(C.ink))
    })
    r.fills.forEach((f, i) => {
      if (this.levelLabels[i]) this.levelLabels[i].setText(`${fmtShares(f.shares)} @ ${fmtPrice(f.price)}`)
    })
    if (r.unfilled > 0 && this.levelLabels[2]) {
      this.levelLabels[2].setText(`${fmtShares(r.unfilled)} unfilled — exceeds depth`)
      this.levelLabels[2].setColor(hex(C.red))
    }
  }
}
