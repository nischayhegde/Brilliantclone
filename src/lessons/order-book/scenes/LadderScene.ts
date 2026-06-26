import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, FONT, hex } from '../../../engine/palette'
import { fmtMoney, fmtPrice, fmtShares, type Level } from './book'

interface LadderParams {
  asks?: Level[]
  bids?: Level[]
}

const DEFAULT_ASKS: Level[] = [
  { price: 100.1, size: 1500 },
  { price: 100.05, size: 800 },
  { price: 100.03, size: 500 },
  { price: 100.02, size: 400 },
]
const DEFAULT_BIDS: Level[] = [
  { price: 100.01, size: 600 },
  { price: 100.0, size: 900 },
  { price: 99.99, size: 800 },
  { price: 99.95, size: 1200 },
]

/**
 * MODULE 4 — TEACH "The Ladder & the Top of Book". A tall two-sided ladder: red asks
 * above, green bids below, a blue spread gap, a blue TOP OF BOOK bracket around the
 * touch. A toggle switches between per-level SIZE and running CUMULATIVE depth (from
 * the touch outward). Hovering a rung shows price × size = notional resting.
 */
export default class LadderScene extends ModuleScene {
  private asks: Level[] = []
  private bids: Level[] = []
  private maxSize = 1
  private cumulative = false
  private rows: Array<{ lvl: Level; cum: number; sizeText: Phaser.GameObjects.Text }> = []

  private readonly cx = 300
  private readonly rowH = 32
  private readonly gap = 30
  private readonly askTop = 64
  private readonly maxBarW = 300
  private tooltip!: Phaser.GameObjects.Container

  protected build(): void {
    const p = this.params as LadderParams
    // best ask first in data; draw worst ask at top.
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => b.price - a.price)
    this.bids = (p.bids ?? DEFAULT_BIDS).slice().sort((a, b) => b.price - a.price)
    this.maxSize = Math.max(...this.asks.map((l) => l.size), ...this.bids.map((l) => l.size))

    this.simLabel()
    this.label(this.cx, 32, 'Every rung = a price with a size. The two hugging the gap are the top of book.', {
      size: 13,
      col: C.muted,
      align: 'center',
    })

    const midY = this.drawLadder()
    this.drawSpreadGap(midY)
    this.drawTopOfBookBracket(midY)
    this.buildToggle()

    this.tooltip = this.makeTooltip()
    this.tooltip.setVisible(false)

    this.time.delayedCall(2200, () => this.emitReady())
  }

  private simLabel(): void {
    this.label(this.W - 12, this.H - 14, 'Simulated depth', { size: 11, col: C.blue, align: 'right' }).setAlpha(0.8)
  }

  private drawLadder(): number {
    // asks: cumulative accrues from the touch (best ask = last in this top-down array) outward (upward).
    const askCum: number[] = []
    let run = 0
    for (let i = this.asks.length - 1; i >= 0; i--) {
      run += this.asks[i].size
      askCum[i] = run
    }
    const midY = this.askTop + this.asks.length * this.rowH + this.gap / 2

    this.asks.forEach((lvl, i) => {
      const y = this.askTop + i * this.rowH + this.rowH / 2
      this.makeRung(lvl, 'ask', y, askCum[i], 220 + i * 90)
    })

    // bids: best bid first (top), cumulative accrues downward away from touch.
    let bRun = 0
    this.bids.forEach((lvl, i) => {
      bRun += lvl.size
      const y = midY + this.gap / 2 + i * this.rowH + this.rowH / 2
      this.makeRung(lvl, 'bid', y, bRun, 220 + (this.asks.length + i) * 90)
    })
    return midY
  }

  private makeRung(lvl: Level, side: 'ask' | 'bid', y: number, cum: number, delay: number): void {
    const col = side === 'ask' ? C.red : C.green
    const soft = side === 'ask' ? C.redSoft : C.greenSoft
    const targetW = 40 + (lvl.size / this.maxSize) * (this.maxBarW - 40)
    const left = this.cx - this.maxBarW / 2

    const bar = this.add.graphics()
    bar.x = left
    bar.y = y
    const drawBar = (w: number) => {
      bar.clear()
      bar.fillStyle(soft, 1)
      bar.fillRoundedRect(0, -this.rowH / 2 + 3, w, this.rowH - 6, 5)
      bar.lineStyle(1.5, col, 1)
      bar.strokeRoundedRect(0, -this.rowH / 2 + 3, w, this.rowH - 6, 5)
    }
    drawBar(0)
    this.tweens.addCounter({ from: 0, to: targetW, duration: 360, delay, ease: 'Cubic.out', onUpdate: (tw) => drawBar(tw.getValue() ?? 0) })

    const priceT = this.add
      .text(left + 8, y, fmtPrice(lvl.price), { fontFamily: FONT, fontSize: '13px', color: hex(col), fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setAlpha(0)
    const sizeT = this.add
      .text(left + this.maxBarW + 10, y, fmtShares(lvl.size), { fontFamily: FONT, fontSize: '13px', color: hex(C.ink) })
      .setOrigin(0, 0.5)
      .setAlpha(0)
    this.tweens.add({ targets: [priceT, sizeT], alpha: 1, duration: 260, delay: delay + 120 })

    this.rows.push({ lvl, cum, sizeText: sizeT })

    // hover hit-area across full bar width
    const hit = this.add
      .rectangle(this.cx, y, this.maxBarW, this.rowH - 6, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerover', () => this.showTooltip(lvl, y))
    hit.on('pointerout', () => this.tooltip.setVisible(false))
  }

  private drawSpreadGap(midY: number): void {
    const w = this.maxBarW + 16
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 1)
    g.fillRoundedRect(this.cx - w / 2, midY - 13, w, 26, 7)
    g.lineStyle(1.5, C.blue, 0.7)
    g.strokeRoundedRect(this.cx - w / 2, midY - 13, w, 26, 7)
    this.label(this.cx, midY, 'spread', { size: 12, col: C.blue, align: 'center', bold: true })
  }

  private drawTopOfBookBracket(midY: number): void {
    // best ask is the last ask row (lowest ask), best bid the first bid row.
    const bestAskY = this.askTop + (this.asks.length - 1) * this.rowH + this.rowH / 2
    const bestBidY = midY + this.gap / 2 + this.rowH / 2
    const w = this.maxBarW + 50
    const g = this.add.graphics()
    const drawRect = (a: number) => {
      g.clear()
      g.lineStyle(2.5, C.blue, a)
      g.strokeRoundedRect(this.cx - w / 2, bestAskY - this.rowH / 2 - 2, w, bestBidY - bestAskY + this.rowH + 4, 9)
    }
    drawRect(0)
    // label hugs the bracket's top-right but clears the rung size labels (~x=524)
    const lbl = this.label(this.cx + w / 2 + 6, bestAskY - this.rowH / 2 - 2, 'TOP OF BOOK', { size: 12, col: C.blue, bold: true, align: 'left' }).setAlpha(0)
    this.time.delayedCall(1400, () => {
      this.tweens.add({ targets: lbl, alpha: 1, duration: 300 })
      this.tweens.addCounter({ from: 0, to: 1, duration: 500, yoyo: true, repeat: 2, onUpdate: (tw) => drawRect(0.3 + (tw.getValue() ?? 0) * 0.7) })
    })
  }

  private buildToggle(): void {
    const x = 620
    const y = 372
    this.label(x, y - 28, 'Show:', { size: 13, col: C.muted, align: 'center' })
    let perLevel!: Phaser.GameObjects.Container
    let cumul!: Phaser.GameObjects.Container
    const restyle = () => {
      const tint = (c: Phaser.GameObjects.Container, on: boolean) => {
        const g = c.getAt(0) as Phaser.GameObjects.Graphics
        const t = c.getAt(1) as Phaser.GameObjects.Text
        g.clear()
        g.fillStyle(on ? C.blue : C.gray100, 1)
        g.fillRoundedRect(-66, -16, 132, 32, 8)
        t.setColor(hex(on ? C.white : C.muted))
      }
      tint(perLevel, !this.cumulative)
      tint(cumul, this.cumulative)
    }
    const mk = (label: string, cb: () => void) => {
      const g = this.add.graphics()
      const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: hex(C.muted) }).setOrigin(0.5)
      const c = this.add.container(0, 0, [g, t]).setSize(132, 32)
      c.setInteractive(new Phaser.Geom.Rectangle(-66, -16, 132, 32), Phaser.Geom.Rectangle.Contains)
      c.input!.cursor = 'pointer'
      c.on('pointerup', cb)
      return c
    }
    perLevel = mk('This level', () => { this.cumulative = false; this.applyMode(); restyle() })
    cumul = mk('Running total', () => { this.cumulative = true; this.applyMode(); restyle() })
    perLevel.setPosition(x, y)
    cumul.setPosition(x, y + 40)
    restyle()
  }

  private applyMode(): void {
    for (const r of this.rows) {
      if (this.cumulative) {
        r.sizeText.setText(`${fmtShares(r.cum)} total`)
        r.sizeText.setColor(hex(C.blue))
      } else {
        r.sizeText.setText(fmtShares(r.lvl.size))
        r.sizeText.setColor(hex(C.ink))
      }
    }
  }

  private makeTooltip(): Phaser.GameObjects.Container {
    const g = this.add.graphics()
    g.fillStyle(C.ink, 0.95)
    g.fillRoundedRect(0, -20, 200, 40, 8)
    const t = this.add.text(10, 0, '', { fontFamily: FONT, fontSize: '12px', color: hex(C.white) }).setOrigin(0, 0.5)
    t.setName('t')
    return this.add.container(0, 0, [g, t]).setDepth(50)
  }

  private showTooltip(lvl: Level, y: number): void {
    const notional = lvl.price * lvl.size
    ;(this.tooltip.getByName('t') as Phaser.GameObjects.Text).setText(
      `${fmtPrice(lvl.price)} × ${fmtShares(lvl.size)} = ${fmtMoney(notional)} resting`,
    )
    // box sits to the RIGHT of the size labels (which end near cx+maxBarW/2+90),
    // aligned to the hovered rung; clamped so it never clips the right edge.
    const x = Math.min(this.cx + this.maxBarW / 2 + 96, this.W - 208)
    this.tooltip.setPosition(x, Phaser.Math.Clamp(y, this.askTop, this.H - 24))
    this.tooltip.setVisible(true)
  }
}
