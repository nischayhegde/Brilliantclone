import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtMoney, fmtPrice, fmtShares, walkBuy, type Level } from './book'

interface AvgFillQuizParams {
  asks?: Level[]
  orderSize?: number
}

const DEFAULT_ASKS: Level[] = [
  { price: 100.0, size: 400 },
  { price: 100.05, size: 600 },
]

/**
 * MODULE 10 — QUIZ "What's the Average Fill?". A two-level ladder + a MARKET BUY whose
 * average fill is masked with a blue "?" chip. On reveal the order walks both levels
 * with per-level fill chips, then a weighted-average bar slides to the exact value
 * (100.03) and the "?" unmasks, boxed against the touch with slippage shaded. Grading
 * is in the QuizSpec (answer B = 100.03).
 */
export default class AvgFillQuizScene extends ModuleScene {
  private asks: Level[] = []
  private orderSize = 1000
  private revealed = false

  private readonly plotL = 90
  private readonly plotR = 470
  private readonly plotT = 90
  private readonly plotB = 320
  private pMin = 0
  private pMax = 1
  private totalDepth = 0

  private maskChip!: Phaser.GameObjects.Container

  protected build(): void {
    const p = this.params as AvgFillQuizParams
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => a.price - b.price)
    this.orderSize = p.orderSize ?? 1000
    this.totalDepth = this.asks.reduce((s, l) => s + l.size, 0)

    const lo = this.asks[0].price
    const hi = this.asks[this.asks.length - 1].price
    this.pMin = lo - (hi - lo) * 0.6
    this.pMax = hi + (hi - lo) * 0.6

    this.label(this.W / 2, 34, `MARKET BUY ${fmtShares(this.orderSize)} hits ${fmtPrice(this.asks[0].price)} × ${fmtShares(this.asks[0].size)}, then ${fmtPrice(this.asks[1].price)} × ${fmtShares(this.asks[1].size)}`, {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated depth — math exact', { size: 11, col: C.blue }).setAlpha(0.8)

    this.drawStatic()
    this.drawMaskChip()

    this.time.delayedCall(500, () => this.emitReady())
  }

  private xFor(cum: number): number {
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
    for (const lvl of this.asks) {
      const y = this.yFor(lvl.price)
      g.lineStyle(1, C.gray100, 1)
      g.lineBetween(this.plotL, y, this.plotR, y)
      this.label(this.plotL - 8, y, fmtPrice(lvl.price), { size: 12, col: C.muted, align: 'right' })
    }
    // touch line
    this.dashedLine(this.plotL, this.yFor(this.asks[0].price), this.plotR, C.muted, 6, 5, 1.5)
    this.label(this.plotR + 4, this.yFor(this.asks[0].price), 'touch', { size: 11, col: C.muted })

    // available depth blocks (outlined, not filled yet)
    let cum = 0
    for (const lvl of this.asks) {
      const x1 = this.xFor(cum)
      const x2 = this.xFor(cum + lvl.size)
      const y = this.yFor(lvl.price)
      const blk = this.add.graphics()
      blk.lineStyle(1.5, C.red, 0.4)
      blk.strokeRect(x1, y, x2 - x1, this.plotB - y)
      this.label((x1 + x2) / 2, y - 12, `${fmtShares(lvl.size)} @ ${fmtPrice(lvl.price)}`, { size: 11, col: C.red, align: 'center' })
      cum += lvl.size
    }
    this.label((this.plotL + this.plotR) / 2, this.plotB + 18, 'cumulative shares →', { size: 11, col: C.muted, align: 'center' })
  }

  private drawMaskChip(): void {
    const x = 600
    const y = 200
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 1)
    g.fillRoundedRect(-70, -40, 140, 80, 12)
    g.lineStyle(2, C.blue, 1)
    g.strokeRoundedRect(-70, -40, 140, 80, 12)
    const lbl = this.add.text(0, -18, 'Average fill', { fontFamily: '"Segoe UI", sans-serif', fontSize: '12px', color: hex(C.blue) }).setOrigin(0.5)
    const q = this.add.text(0, 10, '?', { fontFamily: '"Segoe UI", sans-serif', fontSize: '34px', color: hex(C.blue), fontStyle: 'bold' }).setOrigin(0.5)
    q.setName('q')
    this.maskChip = this.add.container(x, y, [g, lbl, q])
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true
    const r = walkBuy(this.asks, this.orderSize)

    // walk both levels with per-level fill chips
    let cum = 0
    r.fills.forEach((f, i) => {
      this.time.delayedCall(i * 500, () => {
        const x1 = this.xFor(cum)
        const x2 = this.xFor(cum + f.shares)
        const y = this.yFor(f.price)
        const fill = this.add.graphics()
        fill.fillStyle(C.red, 0)
        fill.fillRect(x1, y, x2 - x1, this.plotB - y)
        this.tweens.addCounter({ from: 0, to: 0.3, duration: 400, onUpdate: (tw) => {
          fill.clear()
          fill.fillStyle(C.red, tw.getValue() ?? 0)
          fill.fillRect(x1, y, x2 - x1, this.plotB - y)
        } })
        const chip = this.label((x1 + x2) / 2, this.plotB - 16, `fill ${fmtShares(f.shares)} @ ${fmtPrice(f.price)}`, { size: 11, col: C.white, align: 'center', bold: true })
        const cbg = this.add.graphics()
        cbg.fillStyle(C.red, 0.85)
        cbg.fillRoundedRect(chip.x - chip.width / 2 - 6, chip.y - 9, chip.width + 12, 18, 5)
        chip.setDepth(5)
        cbg.setDepth(4)
        cum += f.shares
      })
    })

    // weighted-average bar slides in + unmask
    this.time.delayedCall(r.fills.length * 500 + 200, () => {
      const yAvg = this.yFor(r.avgFill)
      const line = this.add.graphics()
      line.lineStyle(3, C.blue, 1)
      line.lineBetween(this.plotL, this.yFor(this.asks[0].price), this.xFor(r.filled), this.yFor(this.asks[0].price))
      this.tweens.addCounter({ from: this.yFor(this.asks[0].price), to: yAvg, duration: 600, ease: 'Cubic.inOut', onUpdate: (tw) => {
        line.clear()
        line.lineStyle(3, C.blue, 1)
        const yv = tw.getValue() ?? 0
        line.lineBetween(this.plotL, yv, this.xFor(r.filled), yv)
      } })
      this.label(this.plotL + 4, yAvg - 12, `avg fill = ${fmtPrice(r.avgFill)}`, { size: 12, col: C.blue, bold: true })

      // slippage shading
      this.time.delayedCall(600, () => {
        const yTouch = this.yFor(r.touch)
        const slip = this.add.graphics()
        slip.fillStyle(C.red, 0.12)
        slip.fillRect(this.plotL, yAvg, this.xFor(r.filled) - this.plotL, yTouch - yAvg)
      })

      // unmask the chip
      const q = this.maskChip.getByName('q') as Phaser.GameObjects.Text
      q.setText(fmtPrice(r.avgFill))
      q.setFontSize(24)
      this.tweens.add({ targets: this.maskChip, scale: 1.12, duration: 200, yoyo: true })
      this.label(this.maskChip.x, this.maskChip.y + 56, `slippage ${fmtPrice(r.slippagePerShare)} /sh = ${fmtMoney(r.slippageTotal)}`, {
        size: 11,
        col: C.red,
        align: 'center',
        bold: true,
      })
    })
  }
}
