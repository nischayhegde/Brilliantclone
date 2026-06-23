import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtMoney, fmtPrice, fmtShares, walkBuy, type Level } from './book'

interface AvgFillQuizParams {
  asks?: Level[]
  /** Starting market-buy size on the slider. */
  startSize?: number
  /** Max selectable size (defaults to total depth). */
  maxSize?: number
}

const DEFAULT_ASKS: Level[] = [
  { price: 100.0, size: 400 },
  { price: 100.05, size: 600 },
]

/**
 * MODULE 10 — CHALLENGE "Fill the Order". A two-level ask ladder drawn as a depth
 * chart. The learner drags a SIZE slider to size a market buy; a live blue bar shows
 * how far into the book that size reaches. On Submit the order SWEEPS the book level
 * by level (per-level red fill chips), a weighted-average line slides to the exact
 * avgFill (from walkBuy), the slippage band shades in, and report() explains why the
 * realized price sits above the touch.
 *
 * "Correct" = the learner felt the cost of size: any order that walks past the touch
 * pays more than the best price (avgFill > touch). An order that fits entirely in the
 * touch fills at the touch — also a valid, instructive outcome (marked correct, no slip).
 */
export default class AvgFillQuizScene extends ModuleScene {
  private asks: Level[] = []
  private orderSize = 700
  private maxSize = 1000
  private locked = false

  private readonly plotL = 90
  private readonly plotR = 470
  private readonly plotT = 80
  private readonly plotB = 300
  private pMin = 0
  private pMax = 1
  private totalDepth = 0

  private sizeBar!: Phaser.GameObjects.Graphics
  private sizeLabel!: Phaser.GameObjects.Text
  private chipText!: Phaser.GameObjects.Text

  protected build(): void {
    const p = this.params as AvgFillQuizParams
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => a.price - b.price)
    this.totalDepth = this.asks.reduce((s, l) => s + l.size, 0)
    this.maxSize = p.maxSize ?? this.totalDepth
    this.orderSize = Math.min(p.startSize ?? 700, this.maxSize)

    const lo = this.asks[0].price
    const hi = this.asks[this.asks.length - 1].price
    this.pMin = lo - (hi - lo) * 0.6
    this.pMax = hi + (hi - lo) * 0.6

    this.label(this.W / 2, 30, 'Size up a MARKET BUY, then sweep the book and read your average vs the touch', {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated depth — math exact', { size: 11, col: C.blue }).setAlpha(0.8)

    this.drawStatic()

    // live "order size" chip (top-right)
    this.panel(560, 80, 150, 70, { fill: C.blueSoft, stroke: C.blue, radius: 10 })
    this.add.text(635, 100, 'Order size', { fontFamily: '"Segoe UI", sans-serif', fontSize: '12px', color: hex(C.blue) }).setOrigin(0.5)
    this.chipText = this.add
      .text(635, 126, '', { fontFamily: '"Segoe UI", sans-serif', fontSize: '22px', color: hex(C.blue), fontStyle: 'bold' })
      .setOrigin(0.5)

    // slider to size the order
    this.label(this.plotL, 360, 'Market buy size', { size: 12, col: C.ink, bold: true })
    this.slider(this.plotL, 388, 380, 100, this.maxSize, this.orderSize, (v) => this.onSize(v), { step: 50 })

    // live preview bar (how far the current size walks the book)
    this.sizeBar = this.add.graphics()
    this.sizeLabel = this.label(this.plotL, this.plotB + 40, '', { size: 12, col: C.blue, bold: true })

    this.onSize(this.orderSize) // draw the initial preview
    this.setCanSubmit(true) // sensible default → always submittable
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

  /** Live preview as the slider moves: a translucent blue bar over the reached depth. */
  private onSize(v: number): void {
    if (this.locked) return
    this.orderSize = Math.round(v)
    const r = walkBuy(this.asks, this.orderSize)
    this.chipText.setText(fmtShares(this.orderSize))

    this.sizeBar.clear()
    this.sizeBar.fillStyle(C.blue, 0.1)
    this.sizeBar.fillRect(this.plotL, this.plotT, this.xFor(r.filled) - this.plotL, this.plotB - this.plotT)
    this.sizeBar.lineStyle(2, C.blue, 0.6)
    this.sizeBar.lineBetween(this.xFor(r.filled), this.plotT, this.xFor(r.filled), this.plotB)

    const levels = r.fills.length
    this.sizeLabel.setText(
      levels <= 1
        ? `${fmtShares(this.orderSize)} fits in the touch (1 level)`
        : `${fmtShares(this.orderSize)} reaches into ${levels} levels — you will pay above the touch`,
    )
  }

  protected onSubmit(): void {
    if (this.locked) return
    this.locked = true
    this.setCanSubmit(false)
    const r = walkBuy(this.asks, this.orderSize)

    // sweep each level with a per-level fill chip
    let cum = 0
    r.fills.forEach((f, i) => {
      this.time.delayedCall(i * 500, () => {
        const x1 = this.xFor(cum)
        const x2 = this.xFor(cum + f.shares)
        const y = this.yFor(f.price)
        const fill = this.add.graphics()
        this.tweens.addCounter({
          from: 0,
          to: 0.3,
          duration: 400,
          onUpdate: (tw) => {
            fill.clear()
            fill.fillStyle(C.red, tw.getValue() ?? 0)
            fill.fillRect(x1, y, x2 - x1, this.plotB - y)
          },
        })
        const chip = this.label((x1 + x2) / 2, this.plotB - 16, `fill ${fmtShares(f.shares)} @ ${fmtPrice(f.price)}`, { size: 11, col: C.white, align: 'center', bold: true })
        const cbg = this.add.graphics()
        cbg.fillStyle(C.red, 0.85)
        cbg.fillRoundedRect(chip.x - chip.width / 2 - 6, chip.y - 9, chip.width + 12, 18, 5)
        chip.setDepth(5)
        cbg.setDepth(4)
        cum += f.shares
      })
    })

    // weighted-average line slides in, then slippage shading
    this.time.delayedCall(r.fills.length * 500 + 200, () => {
      const yAvg = this.yFor(r.avgFill)
      const yTouch = this.yFor(r.touch)
      const line = this.add.graphics()
      this.tweens.addCounter({
        from: yTouch,
        to: yAvg,
        duration: 600,
        ease: 'Cubic.inOut',
        onUpdate: (tw) => {
          line.clear()
          line.lineStyle(3, C.blue, 1)
          const yv = tw.getValue() ?? 0
          line.lineBetween(this.plotL, yv, this.xFor(r.filled), yv)
        },
      })
      this.label(this.plotL + 4, yAvg - 12, `avg fill = ${fmtPrice(r.avgFill, 3)}`, { size: 12, col: C.blue, bold: true })

      this.time.delayedCall(600, () => {
        if (yTouch !== yAvg) {
          const slip = this.add.graphics()
          slip.fillStyle(C.red, 0.12)
          slip.fillRect(this.plotL, yAvg, this.xFor(r.filled) - this.plotL, yTouch - yAvg)
        }
        this.reportResult(r)
      })
    })
  }

  private reportResult(r: ReturnType<typeof walkBuy>): void {
    const levels = r.fills.length
    const breakdown = r.fills.map((f) => `${fmtShares(f.shares)}×${fmtPrice(f.price)}`).join(' + ')

    let title: string
    let detail: string
    if (levels <= 1) {
      // fit entirely in the touch — no slippage
      title = `Filled at the touch · ${fmtPrice(r.avgFill)}`
      detail = `Your ${fmtShares(r.filled)} shares fit inside the ${fmtPrice(r.touch)} touch, so every share filled at the best price — zero slippage. Push the size past ${fmtShares(this.asks[0].size)} and you would start walking up the book.`
    } else {
      title = `Avg ${fmtPrice(r.avgFill, 3)} · +${fmtPrice(r.slippagePerShare, 3)}/sh slippage`
      detail = `Only ${fmtShares(this.asks[0].size)} sit at the ${fmtPrice(r.touch)} touch, so the rest walked up the book: avg = (${breakdown}) / ${fmtShares(r.filled)} = ${fmtPrice(r.avgFill, 3)}. That is ${fmtPrice(r.slippagePerShare, 3)} above the touch — ${fmtMoney(r.slippageTotal)} of slippage on ${fmtShares(r.filled)} shares. A market order pays the weighted average, never just the touch.`
    }
    // "correct" = the learner understands they pay >= the touch (always true here, but
    // we celebrate genuinely sizing past the touch as the key lesson).
    this.report(true, title, detail)
  }
}
