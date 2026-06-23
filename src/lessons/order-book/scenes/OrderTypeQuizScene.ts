import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C } from '../../../engine/palette'
import { fmtPrice, fmtShares, walkBuy, type Level } from './book'

interface OrderTypeQuizParams {
  asks?: Level[]
  orderSize?: number
  limitPrice?: number
  /** 'limit' | 'market' — which choice plays out as correct (drives the reveal). */
  correctChoice?: 'limit' | 'market'
}

const DEFAULT_ASKS: Level[] = [
  { price: 5.0, size: 100 },
  { price: 5.4, size: 100 },
]

/**
 * MODULE 14 — QUIZ "Limit or Market? Pick the Tool". A thin book (100 @ 5.00, 100 @
 * 5.40), a 200-share need, a hard 5.05 ceiling, and patience. On reveal BOTH outcomes
 * play: a MARKET order walks to a 5.20 blend (red, breaks the ceiling) while a LIMIT @
 * 5.05 rests PENDING (green, never overpays). Correct answer (B = limit) lives in the
 * QuizSpec; this scene just dramatizes the resolution.
 */
export default class OrderTypeQuizScene extends ModuleScene {
  private asks: Level[] = []
  private orderSize = 200
  private limitPrice = 5.05
  private revealed = false

  private readonly cx = 200
  private readonly rowH = 38
  private readonly askTop = 130
  private readonly maxBarW = 180
  private maxSize = 1

  protected build(): void {
    const p = this.params as OrderTypeQuizParams
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => a.price - b.price)
    this.orderSize = p.orderSize ?? 200
    this.limitPrice = p.limitPrice ?? 5.05
    this.maxSize = Math.max(...this.asks.map((l) => l.size))

    this.label(this.W / 2, 30, `Buy ${this.orderSize} of this thin small-cap. You refuse to pay above ${fmtPrice(this.limitPrice)}, and you can wait.`, {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated depth — math exact', { size: 11, col: C.blue }).setAlpha(0.8)

    this.drawLadder()

    // scenario card
    this.panel(440, 110, 290, 150, { fill: C.blueSoft, stroke: C.blue, radius: 10 })
    this.label(456, 132, 'Your constraint', { size: 13, col: C.blue, bold: true })
    this.label(456, 160, `• Need ${this.orderSize} shares`, { size: 12, col: C.ink })
    this.label(456, 184, `• Hard ceiling: ${fmtPrice(this.limitPrice)}`, { size: 12, col: C.ink })
    this.label(456, 208, '• You can wait (not urgent)', { size: 12, col: C.ink })
    this.label(456, 236, 'Outcome hidden until you choose', { size: 11, col: C.muted })

    this.time.delayedCall(500, () => this.emitReady())
  }

  private barW(size: number): number {
    return 36 + (size / this.maxSize) * (this.maxBarW - 36)
  }

  private drawLadder(): void {
    const left = this.cx - this.maxBarW / 2
    const ordered = this.asks.slice().sort((a, b) => b.price - a.price)
    ordered.forEach((lvl, i) => {
      const y = this.askTop + i * this.rowH + this.rowH / 2
      const w = this.barW(lvl.size)
      const g = this.add.graphics()
      g.fillStyle(C.redSoft, 1)
      g.fillRoundedRect(left, y - this.rowH / 2 + 4, w, this.rowH - 8, 5)
      g.lineStyle(1.5, C.red, 1)
      g.strokeRoundedRect(left, y - this.rowH / 2 + 4, w, this.rowH - 8, 5)
      g.setName(`ask-${lvl.price}`)
      this.label(left + 8, y, fmtPrice(lvl.price), { size: 13, col: C.red, bold: true })
      this.label(left + this.maxBarW + 10, y, `${fmtShares(lvl.size)} sh`, { size: 12, col: C.ink })
    })
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true
    const r = walkBuy(this.asks, this.orderSize)

    // MARKET outcome (left/top): walk the book to the blend
    const yA = this.askTop + (this.asks.length - 1) * this.rowH + this.rowH / 2 // best ask row (lowest price at bottom)
    // animate consumption of both rungs
    const ordered = this.asks.slice().sort((a, b) => a.price - b.price)
    ordered.forEach((lvl, i) => {
      this.time.delayedCall(i * 450, () => {
        const bar = this.children.getByName(`ask-${lvl.price}`) as Phaser.GameObjects.Graphics
        if (bar) this.tweens.add({ targets: bar, alpha: 0.25, duration: 300 })
      })
    })

    this.time.delayedCall(ordered.length * 450 + 100, () => {
      // MARKET verdict
      this.panel(120, 300, 250, 95, { fill: C.redSoft, stroke: C.red, radius: 10 })
      this.label(140, 320, 'MARKET (buy now)', { size: 13, col: C.red, bold: true })
      this.label(140, 344, `100 @ 5.00, then 100 @ 5.40`, { size: 12, col: C.ink })
      this.label(140, 368, `avg ${fmtPrice(r.avgFill)} — above your ${fmtPrice(this.limitPrice)} limit`, { size: 12, col: C.red, bold: true })

      // LIMIT verdict
      this.panel(400, 300, 280, 95, { fill: C.greenSoft, stroke: C.green, radius: 10 })
      this.label(420, 320, `LIMIT ${this.orderSize} @ ${fmtPrice(this.limitPrice)}`, { size: 13, col: C.green, bold: true })
      this.label(420, 344, 'Rests · status PENDING', { size: 12, col: C.ink })
      this.label(420, 368, 'You control your price — never overpay', { size: 12, col: C.green, bold: true })

      // a blue limit tile resting near the touch
      const left = this.cx - this.maxBarW / 2
      const tile = this.add.graphics()
      tile.fillStyle(C.blue, 0.85)
      tile.fillRoundedRect(left, yA - this.rowH / 2 + 4, 60, this.rowH - 8, 4)
      tile.setAlpha(0)
      this.tweens.add({ targets: tile, alpha: 1, duration: 300 })
    })
  }
}
