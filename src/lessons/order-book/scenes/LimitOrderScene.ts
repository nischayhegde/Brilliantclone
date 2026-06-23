import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtPrice, fmtShares, type Level } from './book'

interface LimitOrderParams {
  asks?: Level[]
  bids?: Level[]
  orderSize?: number
}

const DEFAULT_ASKS: Level[] = [
  { price: 100.03, size: 500 },
  { price: 100.02, size: 400 },
]
const DEFAULT_BIDS: Level[] = [
  { price: 100.01, size: 600 },
  { price: 100.0, size: 900 },
  { price: 99.99, size: 800 },
]

/**
 * MODULE 5 — TEACH "Limit Orders Rest in the Book". A blue LIMIT BUY tile that the
 * learner DRAGS onto any bid-side rung. It docks at the back of the FIFO queue for
 * that level; the readout shows price, shares ahead (the resting size at that level),
 * and a persistent PENDING status — a limit ADDS liquidity and controls price, not
 * fill. Dropping in the spread / at the ask explains it would cross like a market order.
 */
export default class LimitOrderScene extends ModuleScene {
  private asks: Level[] = []
  private bids: Level[] = []
  private orderSize = 200

  private readonly cx = 250
  private readonly rowH = 34
  private readonly gap = 30
  private readonly askTop = 70
  private readonly maxBarW = 220
  private maxSize = 1
  private midY = 0

  private tile!: Phaser.GameObjects.Container
  private tileHome = { x: 560, y: 230 }
  private statusText!: Phaser.GameObjects.Text
  private aheadText!: Phaser.GameObjects.Text
  private priceText!: Phaser.GameObjects.Text
  private bidYs: Array<{ price: number; size: number; y: number }> = []

  protected build(): void {
    const p = this.params as LimitOrderParams
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => b.price - a.price)
    this.bids = (p.bids ?? DEFAULT_BIDS).slice().sort((a, b) => b.price - a.price)
    this.orderSize = p.orderSize ?? 200
    this.maxSize = Math.max(...this.asks.map((l) => l.size), ...this.bids.map((l) => l.size))

    this.label(this.cx, 36, 'Drag the blue LIMIT BUY onto a bid rung — it rests and waits', {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.simLabel()
    this.drawLadder()
    this.buildPanel()
    this.buildTile()

    this.time.delayedCall(900, () => this.emitReady())
  }

  private simLabel(): void {
    this.label(12, this.H - 14, 'Simulated depth', { size: 11, col: C.blue }).setAlpha(0.8)
  }

  private barW(size: number): number {
    return 40 + (size / this.maxSize) * (this.maxBarW - 40)
  }

  private drawLadder(): void {
    this.midY = this.askTop + this.asks.length * this.rowH + this.gap / 2
    const left = this.cx - this.maxBarW / 2

    this.asks.forEach((lvl, i) => {
      const y = this.askTop + i * this.rowH + this.rowH / 2
      this.drawRung(lvl, 'ask', y)
    })
    // spread gap
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 1)
    g.fillRoundedRect(left - 4, this.midY - 12, this.maxBarW + 8, 24, 6)
    this.label(this.cx, this.midY, 'spread', { size: 11, col: C.blue, align: 'center', bold: true })

    this.bids.forEach((lvl, i) => {
      const y = this.midY + this.gap / 2 + i * this.rowH + this.rowH / 2
      this.drawRung(lvl, 'bid', y)
      this.bidYs.push({ price: lvl.price, size: lvl.size, y })
    })
  }

  private drawRung(lvl: Level, side: 'ask' | 'bid', y: number): void {
    const col = side === 'ask' ? C.red : C.green
    const soft = side === 'ask' ? C.redSoft : C.greenSoft
    const left = this.cx - this.maxBarW / 2
    const w = this.barW(lvl.size)
    const g = this.add.graphics()
    g.fillStyle(soft, 1)
    g.fillRoundedRect(left, y - this.rowH / 2 + 3, w, this.rowH - 6, 5)
    g.lineStyle(1.5, col, 1)
    g.strokeRoundedRect(left, y - this.rowH / 2 + 3, w, this.rowH - 6, 5)
    g.setName(`bar-${side}-${lvl.price}`)
    this.label(left + 8, y, fmtPrice(lvl.price), { size: 12, col, bold: true })
    this.label(left + this.maxBarW + 10, y, fmtShares(lvl.size), { size: 12, col: C.ink })
  }

  private buildTile(): void {
    const w = 150
    const h = 30
    const g = this.add.graphics()
    g.fillStyle(C.blue, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 7)
    const t = this.add
      .text(0, 0, `LIMIT BUY ${this.orderSize}`, { fontFamily: '"Segoe UI", sans-serif', fontSize: '12px', color: hex(C.white), fontStyle: 'bold' })
      .setOrigin(0.5)
    this.tile = this.add.container(this.tileHome.x, this.tileHome.y, [g, t]).setSize(w, h)
    this.tile.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains)
    this.input.setDraggable(this.tile)
    this.tile.input!.cursor = 'grab'

    this.tile.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      this.tile.x = dx
      this.tile.y = dy
    })
    this.tile.on('dragend', () => this.dock())
  }

  private dock(): void {
    // Determine which bid rung the tile landed nearest by y.
    const target = this.bidYs.reduce((a, b) => (Math.abs(b.y - this.tile.y) < Math.abs(a.y - this.tile.y) ? b : a))

    if (this.tile.y < this.midY + 4) {
      // dropped in the spread or above the best bid
      this.status(
        C.red,
        'Above the best bid',
        'In the spread → this becomes the NEW best bid (still resting). At/above the ask it would CROSS like a market order — next module.',
      )
      this.snapToRung(target)
      return
    }
    this.snapToRung(target)
    const ahead = target.size
    this.status(
      C.blue,
      `LIMIT BUY ${this.orderSize} @ ${fmtPrice(target.price)}`,
      `Queued at the BACK of the line (FIFO). ${fmtShares(ahead)} shares ahead of you.`,
      ahead,
    )
  }

  private snapToRung(target: { price: number; size: number; y: number }): void {
    const left = this.cx - this.maxBarW / 2
    const baseW = this.barW(target.size)
    // extend the rung visually by the order (blue segment behind the docked tile)
    const extW = (this.orderSize / this.maxSize) * (this.maxBarW - 40)
    const seg = this.add.graphics()
    seg.fillStyle(C.blue, 0.85)
    seg.fillRoundedRect(left + baseW, target.y - this.rowH / 2 + 4, Math.max(8, extW), this.rowH - 8, 4)
    this.tweens.add({ targets: this.tile, x: left + baseW + Math.max(8, extW) / 2 + 30, y: target.y, duration: 260, ease: 'Back.out' })
    // PROVIDES LIQUIDITY tag pulse
    const tag = this.label(left + this.maxBarW + 70, target.y, 'PROVIDES LIQUIDITY', { size: 10, col: C.blue, bold: true }).setAlpha(0)
    this.tweens.add({ targets: tag, alpha: 1, duration: 200, yoyo: true, hold: 700, onComplete: () => tag.destroy() })
  }

  private buildPanel(): void {
    const px = 470
    const py = 290
    this.panel(px, py, 270, 130, { fill: C.blueSoft, stroke: C.blue, radius: 10 })
    this.label(px + 16, py + 22, 'Your limit order', { size: 13, col: C.blue, bold: true })
    this.priceText = this.label(px + 16, py + 50, 'Drag the tile onto a price', { size: 12, col: C.ink })
    this.aheadText = this.label(px + 16, py + 74, '', { size: 12, col: C.ink })
    this.statusText = this.label(px + 16, py + 102, 'Status: —', { size: 12, col: C.muted, bold: true })
    this.statusText.setWordWrapWidth(240)
  }

  private status(col: number, price: string, note: string, ahead?: number): void {
    this.priceText.setText(price)
    this.priceText.setColor(hex(col))
    this.aheadText.setText(ahead !== undefined ? `${fmtShares(ahead)} shares ahead of you` : '')
    this.statusText.setText(`Status: PENDING — ${note}`)
    this.statusText.setColor(hex(col))
    this.emitReady()
  }
}
