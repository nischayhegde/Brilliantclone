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
 * MODULE 9 — TEACH "Walking the Book & Slippage". A size slider drives a market buy
 * that climbs the ask side rung by rung. Filled portions of each rung shade red; a blue
 * running-average line drifts up away from the grey touch line; the gap is shaded and
 * labelled "slippage". Live readouts: shares per level, weighted avg, slippage / share,
 * slippage total ($). Re-walks live as the slider moves.
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

    this.label(this.W / 2, 32, 'Drag the size slider — a bigger order walks up the asks into slippage', {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated depth — math exact', { size: 11, col: C.blue }).setAlpha(0.8)

    this.drawStatic()
    this.dynG = this.add.graphics()
    this.buildPanel()
    this.buildSlider()

    this.recompute()
    this.time.delayedCall(600, () => this.emitReady())
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
      this.label(this.plotL - 8, y, fmtPrice(lvl.price), { size: 11, col: C.muted, align: 'right' })
    }
    this.label((this.plotL + this.plotR) / 2, this.plotB + 18, 'cumulative shares →', { size: 11, col: C.muted, align: 'center' })

    // grey touch line
    const touchY = this.yFor(this.asks[0].price)
    this.dashedLine(this.plotL, touchY, this.plotR, C.muted, 6, 5, 1.5)
    this.label(this.plotR + 4, touchY, 'touch', { size: 10, col: C.muted })

    // outline of each ask level as a staircase (full available depth)
    const stair = this.add.graphics()
    stair.lineStyle(1.5, C.red, 0.35)
    let cum = 0
    for (const lvl of this.asks) {
      const x1 = this.xFor(cum)
      const x2 = this.xFor(cum + lvl.size)
      const y = this.yFor(lvl.price)
      stair.lineBetween(x1, y, x2, y)
      stair.lineBetween(x2, y, x2, this.plotB)
      cum += lvl.size
    }
  }

  private recompute(): void {
    const r = walkBuy(this.asks, this.size)
    this.dynG.clear()

    // shade filled portion of each consumed level red. Levels fill in order and
    // (except possibly the last) fully, so cumulative-share x stays aligned with
    // the staircase: advance cum by the shares actually filled at each level.
    let cum = 0
    for (const f of r.fills) {
      const x1 = this.xFor(cum)
      const x2 = this.xFor(cum + f.shares)
      const y = this.yFor(f.price)
      this.dynG.fillStyle(C.red, 0.28)
      this.dynG.fillRect(x1, y, x2 - x1, this.plotB - y)
      this.dynG.lineStyle(2, C.red, 1)
      this.dynG.lineBetween(x1, y, x2, y)
      cum += f.shares
    }

    // blue running-average line
    if (isFinite(r.avgFill)) {
      const yAvg = this.yFor(r.avgFill)
      this.dynG.lineStyle(2.5, C.blue, 1)
      this.dynG.lineBetween(this.plotL, yAvg, this.xFor(r.filled), yAvg)
      // slippage shading between touch and avg
      const yTouch = this.yFor(r.touch)
      this.dynG.fillStyle(C.red, 0.12)
      this.dynG.fillRect(this.plotL, yAvg, this.xFor(r.filled) - this.plotL, yTouch - yAvg)
    }

    this.updateReadouts(r)
  }

  private buildPanel(): void {
    const px = 470
    const py = 60
    this.panel(px, py, 275, 250, { fill: C.blueSoft, stroke: C.blue, radius: 10 })
    this.label(px + 16, py + 22, 'Live fill', { size: 14, col: C.blue, bold: true })
    const mk = (key: string, y: number, lbl: string) => {
      this.label(px + 16, py + y, lbl, { size: 12, col: C.muted })
      this.readouts[key] = this.label(px + 259, py + y, '—', { size: 13, col: C.ink, bold: true, align: 'right' })
    }
    mk('order', 54, 'Order size')
    mk('avg', 84, 'Avg fill')
    mk('touch', 114, 'Touch')
    mk('slipps', 144, 'Slippage / share')
    mk('sliptot', 174, 'Slippage total')
    // per-level breakdown area
    this.label(px + 16, py + 206, 'Per level:', { size: 12, col: C.muted })
    for (let i = 0; i < 3; i++) {
      this.levelLabels[i] = this.label(px + 16, py + 224 + i * 16, '', { size: 11, col: C.ink })
    }
  }

  private buildSlider(): void {
    this.label(this.W / 2, 362, 'Order size', { size: 12, col: C.muted, align: 'center' })
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

    this.levelLabels.forEach((t) => t.setText(''))
    r.fills.forEach((f, i) => {
      if (this.levelLabels[i]) this.levelLabels[i].setText(`${fmtShares(f.shares)} @ ${fmtPrice(f.price)}`)
    })
    if (r.unfilled > 0 && this.levelLabels[2]) {
      this.levelLabels[2].setText(`${fmtShares(r.unfilled)} unfilled — exceeds depth`)
      this.levelLabels[2].setColor(hex(C.red))
    }
  }
}
