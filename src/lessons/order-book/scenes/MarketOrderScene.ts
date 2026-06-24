import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, FONT, hex } from '../../../engine/palette'
import { fmtPrice, fmtShares, type Level } from './book'

interface MarketOrderParams {
  asks?: Level[]
  bids?: Level[]
  orderSize?: number
}

const DEFAULT_ASKS: Level[] = [
  { price: 100.04, size: 700 },
  { price: 100.03, size: 500 },
  { price: 100.02, size: 400 },
]
const DEFAULT_BIDS: Level[] = [
  { price: 100.01, size: 600 },
  { price: 100.0, size: 900 },
]

/**
 * MODULE 6 — TEACH "Market Orders Cross the Spread". A toggle fires the SAME order as
 * LIMIT vs MARKET. LIMIT docks and waits (PENDING). MARKET shoots up, consumes the
 * best ask (bar flashes white then collapses), drops a green PRINT chip on a tape, and
 * the new best ask is exposed. A side panel contrasts: LIMIT = control PRICE (maybe no
 * fill) vs MARKET = control FILL (price is whatever's there).
 */
export default class MarketOrderScene extends ModuleScene {
  private asks: Level[] = []
  private bids: Level[] = []
  private orderSize = 400

  private readonly cx = 230
  private readonly rowH = 34
  private readonly gap = 30
  private readonly askTop = 80
  private readonly maxBarW = 210
  private maxSize = 1
  private midY = 0

  private mode: 'market' | 'limit' = 'market'
  private fired = false
  private limitFired = false
  private askBars: Array<{ lvl: Level; bar: Phaser.GameObjects.Graphics; y: number; consumed: boolean }> = []
  private tapeY = 70
  private tapeX = 470
  private prints = 0
  private modeBtns: { market: Phaser.GameObjects.Container; limit: Phaser.GameObjects.Container } | null = null

  protected build(): void {
    const p = this.params as MarketOrderParams
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => b.price - a.price)
    this.bids = (p.bids ?? DEFAULT_BIDS).slice().sort((a, b) => b.price - a.price)
    this.orderSize = p.orderSize ?? 400
    this.maxSize = Math.max(...this.asks.map((l) => l.size), ...this.bids.map((l) => l.size))

    this.simLabel()
    this.drawLadder()
    this.drawTape()
    this.buildControls()
    this.buildContrastPanel()

    this.time.delayedCall(700, () => this.emitReady())
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
      const w = this.barW(lvl.size)
      const bar = this.add.graphics()
      bar.fillStyle(C.redSoft, 1)
      bar.fillRoundedRect(left, y - this.rowH / 2 + 3, w, this.rowH - 6, 5)
      bar.lineStyle(1.5, C.red, 1)
      bar.strokeRoundedRect(left, y - this.rowH / 2 + 3, w, this.rowH - 6, 5)
      const pt = this.label(left + 8, y, fmtPrice(lvl.price), { size: 12, col: C.red, bold: true })
      const st = this.label(left + this.maxBarW + 10, y, fmtShares(lvl.size), { size: 12, col: C.ink })
      pt.setName(`pt-${i}`)
      st.setName(`st-${i}`)
      this.askBars.push({ lvl, bar, y, consumed: false })
    })

    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 1)
    g.fillRoundedRect(left - 4, this.midY - 12, this.maxBarW + 8, 24, 6)
    this.label(this.cx, this.midY, 'spread', { size: 12, col: C.blue, align: 'center', bold: true })

    this.bids.forEach((lvl, i) => {
      const y = this.midY + this.gap / 2 + i * this.rowH + this.rowH / 2
      const w = this.barW(lvl.size)
      const bar = this.add.graphics()
      bar.fillStyle(C.greenSoft, 1)
      bar.fillRoundedRect(left, y - this.rowH / 2 + 3, w, this.rowH - 6, 5)
      bar.lineStyle(1.5, C.green, 1)
      bar.strokeRoundedRect(left, y - this.rowH / 2 + 3, w, this.rowH - 6, 5)
      this.label(left + 8, y, fmtPrice(lvl.price), { size: 12, col: C.green, bold: true })
      this.label(left + this.maxBarW + 10, y, fmtShares(lvl.size), { size: 12, col: C.ink })
    })
  }

  private drawTape(): void {
    this.panel(this.tapeX, this.tapeY - 24, 270, 150, { fill: C.gray100, stroke: C.hairline, radius: 8 })
    this.label(this.tapeX + 12, this.tapeY - 4, 'Time & sales', { size: 12, col: C.muted, bold: true })
  }

  private buildControls(): void {
    const y = 340
    this.label(this.cx, y - 26, 'Fire the same order as:', { size: 12, col: C.muted, align: 'center' })
    const mk = (label: string, cb: () => void) => {
      const g = this.add.graphics()
      const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: hex(C.white) }).setOrigin(0.5)
      const c = this.add.container(0, 0, [g, t]).setSize(110, 32)
      c.setInteractive(new Phaser.Geom.Rectangle(-55, -16, 110, 32), Phaser.Geom.Rectangle.Contains)
      c.input!.cursor = 'pointer'
      c.on('pointerup', cb)
      return c
    }
    const market = mk('MARKET', () => { this.mode = 'market'; this.restyle(); })
    const limit = mk('LIMIT', () => { this.mode = 'limit'; this.restyle(); })
    market.setPosition(this.cx - 60, y)
    limit.setPosition(this.cx + 60, y)
    this.modeBtns = { market, limit }
    this.restyle()

    this.button(this.cx, y + 48, 'Fire order', () => this.fire(), { w: 160, fill: C.blue })
  }

  private restyle(): void {
    if (!this.modeBtns) return
    const set = (c: Phaser.GameObjects.Container, on: boolean, col: number) => {
      const g = c.getAt(0) as Phaser.GameObjects.Graphics
      g.clear()
      g.fillStyle(on ? col : C.gray200, 1)
      g.fillRoundedRect(-55, -16, 110, 32, 8)
      ;(c.getAt(1) as Phaser.GameObjects.Text).setColor(hex(on ? C.white : C.muted))
    }
    set(this.modeBtns.market, this.mode === 'market', C.red)
    set(this.modeBtns.limit, this.mode === 'limit', C.blue)
  }

  private buildContrastPanel(): void {
    const px = 470
    const py = 250
    this.panel(px, py, 270, 130, { fill: C.white, stroke: C.hairline, radius: 10 })
    this.label(px + 14, py + 22, 'LIMIT → control PRICE', { size: 13, col: C.blue, bold: true })
    this.label(px + 14, py + 46, '(rests; maybe no fill)', { size: 12, col: C.muted })
    this.label(px + 14, py + 78, 'MARKET → control FILL', { size: 13, col: C.red, bold: true })
    this.label(px + 14, py + 100, '(price is whatever is there)', { size: 12, col: C.muted })
  }

  private fire(): void {
    if (this.fired) return
    if (this.mode === 'limit') {
      this.fireLimit()
    } else {
      this.fireMarket()
    }
  }

  private fireLimit(): void {
    // dock onto a bid rung and wait. Guard so repeated clicks don't stack tags/prints.
    if (this.limitFired) return
    this.limitFired = true
    // single chip-backed tag, centered below the ladder (clear of the rung size labels
    // and the tape on the right). Guarded above so it is only ever created once.
    const bidsBottomY = this.midY + this.gap / 2 + this.bids.length * this.rowH + 14
    this.label(this.cx, bidsBottomY, 'LIMIT PENDING — provides liquidity', { size: 12, col: C.blue, bold: true, align: 'center', bg: true })
    this.addPrint(`LIMIT rests · ${this.orderSize} @ ${fmtPrice(this.bids[0].price)}`, C.blue)
  }

  private fireMarket(): void {
    this.fired = true
    const touch = this.askBars[this.askBars.length - 1] // lowest ask = best ask
    const arrow = this.add.triangle(this.cx, this.midY - 6, 0, 12, 12, 12, 6, 0, C.red).setOrigin(0.5)
    this.tweens.add({
      targets: arrow,
      y: touch.y,
      duration: 300,
      ease: 'Quad.in',
      onComplete: () => {
        arrow.destroy()
        this.consume(touch)
      },
    })
  }

  private consume(entry: { lvl: Level; bar: Phaser.GameObjects.Graphics; y: number; consumed: boolean }): void {
    const left = this.cx - this.maxBarW / 2
    const w = this.barW(entry.lvl.size)
    // flash white
    const flash = this.add.graphics()
    flash.fillStyle(C.white, 1)
    flash.fillRoundedRect(left, entry.y - this.rowH / 2 + 3, w, this.rowH - 6, 5)
    this.tweens.add({
      targets: [entry.bar, flash],
      alpha: 0,
      duration: 360,
      delay: 120,
      onComplete: () => {
        entry.bar.destroy()
        flash.destroy()
        const idx = this.askBars.indexOf(entry)
        ;(this.children.getByName(`st-${idx}`) as Phaser.GameObjects.Text)?.setText('consumed')
        ;(this.children.getByName(`pt-${idx}`) as Phaser.GameObjects.Text)?.setAlpha(0.4)
      },
    })
    entry.consumed = true

    this.addPrint(`PRINT ${fmtShares(this.orderSize)} @ ${fmtPrice(entry.lvl.price)}`, C.green)

    // TAKES LIQUIDITY tag on the consumed touch row (chip-backed so it reads over the
    // collapsing bar); new best ask note just above it. Single texts, created once.
    const nextAsk = this.askBars[this.askBars.length - 2]?.lvl.price
    this.label(this.cx, entry.y, 'TAKES LIQUIDITY', { size: 12, col: C.red, align: 'center', bold: true, bg: true })
    if (nextAsk !== undefined) {
      this.time.delayedCall(500, () =>
        this.label(this.cx, entry.y - this.rowH, `new best ask: ${fmtPrice(nextAsk)}`, { size: 12, col: C.muted, align: 'center', bg: true }),
      )
    }
  }

  private addPrint(text: string, col: number): void {
    const y = this.tapeY + 24 + this.prints * 24
    if (this.prints >= 4) return
    const chip = this.label(this.tapeX + 16, y, text, { size: 12, col, bold: true }).setAlpha(0)
    this.tweens.add({ targets: chip, alpha: 1, x: this.tapeX + 20, duration: 300 })
    this.prints++
  }
}
