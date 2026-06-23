import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtPrice, fmtShares, walkBuy, type Level } from './book'

interface OrderTypeQuizParams {
  asks?: Level[]
  orderSize?: number
  /** Hard ceiling the learner must not exceed. */
  limitPrice?: number
  /** Bounds for the draggable limit-price line. */
  limitMin?: number
  limitMax?: number
}

const DEFAULT_ASKS: Level[] = [
  { price: 5.0, size: 100 },
  { price: 5.4, size: 100 },
]

/**
 * MODULE 14 — CHALLENGE "Limit or Market? Place the Order". A thin book (100 @ 5.00,
 * 100 @ 5.40), a 200-share need, a hard ceiling (5.05), and patience. The learner
 * TOGGLES order type (MARKET vs LIMIT); choosing LIMIT reveals a draggable blue limit
 * line they place on the ladder. On Submit the scene simulates the chosen order and
 * grades it against the goal — buy 200 without paying above the ceiling — via report().
 *
 * Grading (exact, via walkBuy):
 *  - MARKET walks the book to a blended avg (5.20) that breaks the ceiling → wrong.
 *  - LIMIT at price ≥ best ask but ≤ ceiling rests and (patience) fills at-or-below the
 *    ceiling → correct.
 *  - LIMIT below the best ask never fills (too low); LIMIT above the ceiling overpays.
 */
export default class OrderTypeQuizScene extends ModuleScene {
  private asks: Level[] = []
  private orderSize = 200
  private ceiling = 5.05
  private limitPrice = 5.05
  private limitMin = 4.95
  private limitMax = 5.45
  private readonly tick = 0.01

  private choice: 'market' | 'limit' = 'limit'
  private locked = false

  private readonly cx = 200
  private readonly rowH = 38
  private readonly askTop = 120
  private readonly maxBarW = 180
  private maxBookSize = 1

  private toggleBtns: Array<{ key: 'market' | 'limit'; bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text; w: number; x: number; y: number }> = []
  private limitGroup!: Phaser.GameObjects.Container
  private limitLineG!: Phaser.GameObjects.Graphics
  private limitLabel!: Phaser.GameObjects.Text
  private limitKnob!: Phaser.GameObjects.Arc

  protected build(): void {
    const p = this.params as OrderTypeQuizParams
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => a.price - b.price)
    this.orderSize = p.orderSize ?? 200
    this.ceiling = p.limitPrice ?? 5.05
    this.limitPrice = this.ceiling
    this.limitMin = p.limitMin ?? this.asks[0].price - 0.05
    this.limitMax = p.limitMax ?? this.asks[this.asks.length - 1].price + 0.05
    this.maxBookSize = Math.max(...this.asks.map((l) => l.size))

    this.label(this.W / 2, 24, `Buy ${fmtShares(this.orderSize)} of this thin small-cap. Never pay above ${fmtPrice(this.ceiling)}. You can wait.`, {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated depth — math exact', { size: 11, col: C.blue }).setAlpha(0.8)

    this.drawLadder()

    // scenario card
    this.panel(440, 76, 290, 130, { fill: C.blueSoft, stroke: C.blue, radius: 10 })
    this.label(456, 96, 'Your constraint', { size: 13, col: C.blue, bold: true })
    this.label(456, 120, `• Need ${fmtShares(this.orderSize)} shares`, { size: 12, col: C.ink })
    this.label(456, 142, `• Hard ceiling: ${fmtPrice(this.ceiling)}`, { size: 12, col: C.ink })
    this.label(456, 164, '• You can wait (not urgent)', { size: 12, col: C.ink })
    this.label(456, 186, 'Goal: best price, never overpay', { size: 11, col: C.muted })

    // order-type toggle
    this.buildToggle()

    // draggable limit line (only shown for the LIMIT choice)
    this.buildLimitLine()

    this.refreshChoice()
    this.setCanSubmit(true) // a default choice is set so submit is always valid
    this.time.delayedCall(500, () => this.emitReady())
  }

  private barW(size: number): number {
    return 36 + (size / this.maxBookSize) * (this.maxBarW - 36)
  }
  private yForRow(i: number): number {
    return this.askTop + i * this.rowH + this.rowH / 2
  }
  /** Map a price to a y on the ladder (highest price = top row). */
  private yForPrice(price: number): number {
    const ordered = this.asks.slice().sort((a, b) => b.price - a.price)
    const hi = ordered[0].price
    const lo = ordered[ordered.length - 1].price
    const yTop = this.yForRow(0)
    const yBot = this.yForRow(ordered.length - 1)
    if (hi === lo) return yTop
    const t = (price - lo) / (hi - lo)
    return yBot - t * (yBot - yTop)
  }
  private priceForY(y: number): number {
    const ordered = this.asks.slice().sort((a, b) => b.price - a.price)
    const hi = ordered[0].price
    const lo = ordered[ordered.length - 1].price
    const yTop = this.yForRow(0)
    const yBot = this.yForRow(ordered.length - 1)
    const t = (yBot - y) / (yBot - yTop)
    return lo + t * (hi - lo)
  }
  private snap(p: number): number {
    return Math.round(p / this.tick) * this.tick
  }

  private drawLadder(): void {
    const left = this.cx - this.maxBarW / 2
    const ordered = this.asks.slice().sort((a, b) => b.price - a.price)
    ordered.forEach((lvl, i) => {
      const y = this.yForRow(i)
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
    // ceiling marker
    const yC = this.yForPrice(this.ceiling)
    this.dashedLine(left - 16, yC, left + this.maxBarW + 70, C.blue, 6, 5, 1.5)
    this.label(left + this.maxBarW + 74, yC, `ceiling ${fmtPrice(this.ceiling)}`, { size: 10, col: C.blue, bold: true })
  }

  private buildToggle(): void {
    const labels: Array<['market' | 'limit', string, number]> = [
      ['market', 'MARKET (buy now)', 150],
      ['limit', 'LIMIT (rest & wait)', 150],
    ]
    let x = this.cx - this.maxBarW / 2
    const y = 300
    for (const [key, label, w] of labels) {
      const bg = this.add.graphics()
      const txt = this.add.text(x + w / 2, y, label, { fontFamily: '"Segoe UI", sans-serif', fontSize: '12px', fontStyle: 'bold' }).setOrigin(0.5)
      const hit = this.add.rectangle(x + w / 2, y, w, 30, 0x000000, 0).setInteractive({ useHandCursor: true })
      hit.on('pointerup', () => {
        if (this.locked) return
        this.choice = key
        this.refreshChoice()
      })
      this.toggleBtns.push({ key, bg, txt, w, x, y })
      x += w + 10
    }
  }

  private refreshChoice(): void {
    for (const b of this.toggleBtns) {
      const selected = b.key === this.choice
      const col = b.key === 'market' ? C.red : C.green
      b.bg.clear()
      b.bg.fillStyle(selected ? col : C.white, 1)
      b.bg.fillRoundedRect(b.x, b.y - 15, b.w, 30, 8)
      b.bg.lineStyle(2, selected ? col : C.hairline, 1)
      b.bg.strokeRoundedRect(b.x, b.y - 15, b.w, 30, 8)
      b.txt.setColor(hex(selected ? C.white : C.muted))
    }
    this.limitGroup.setVisible(this.choice === 'limit')
  }

  private buildLimitLine(): void {
    const left = this.cx - this.maxBarW / 2
    this.limitLineG = this.add.graphics()
    this.limitKnob = this.add.circle(left + this.maxBarW + 50, 0, 7, C.blue).setStrokeStyle(2, C.white)
    this.limitLabel = this.add.text(left, 0, '', { fontFamily: '"Segoe UI", sans-serif', fontSize: '12px', color: hex(C.blue), fontStyle: 'bold' }).setOrigin(0, 1)
    const hit = this.add
      .rectangle(left + this.maxBarW / 2, 0, this.maxBarW + 120, 24, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    this.limitGroup = this.add.container(0, 0, [this.limitLineG, this.limitKnob, this.limitLabel, hit])

    const redraw = () => {
      const y = this.yForPrice(this.limitPrice)
      this.limitLineG.clear()
      this.limitLineG.lineStyle(2.2, C.blue, 1)
      for (let x = left - 8; x < left + this.maxBarW + 50; x += 10) this.limitLineG.lineBetween(x, y, Math.min(x + 6, left + this.maxBarW + 50), y)
      this.limitKnob.y = y
      this.limitLabel.setPosition(left, y - 6)
      this.limitLabel.setText(`LIMIT ${fmtShares(this.orderSize)} @ ${fmtPrice(this.limitPrice)}`)
      hit.y = y
    }
    redraw()

    let dragging = false
    hit.on('pointerdown', (pt: Phaser.Input.Pointer) => {
      if (this.locked) return
      dragging = true
      this.limitPrice = Phaser.Math.Clamp(this.snap(this.priceForY(pt.y)), this.limitMin, this.limitMax)
      redraw()
    })
    const onMove = (pt: Phaser.Input.Pointer) => {
      if (dragging && !this.locked) {
        this.limitPrice = Phaser.Math.Clamp(this.snap(this.priceForY(pt.y)), this.limitMin, this.limitMax)
        redraw()
      }
    }
    const onUp = () => {
      dragging = false
    }
    this.input.on('pointermove', onMove)
    this.input.on('pointerup', onUp)
    this.input.on('pointerupoutside', onUp)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', onMove)
      this.input.off('pointerup', onUp)
      this.input.off('pointerupoutside', onUp)
    })
  }

  protected onSubmit(): void {
    if (this.locked) return
    this.locked = true
    this.setCanSubmit(false)

    if (this.choice === 'market') this.simulateMarket()
    else this.simulateLimit()
  }

  private simulateMarket(): void {
    const r = walkBuy(this.asks, this.orderSize)
    const ordered = this.asks.slice().sort((a, b) => a.price - b.price)
    // consume rungs the market order touches
    r.fills.forEach((f, i) => {
      this.time.delayedCall(i * 400, () => {
        const bar = this.children.getByName(`ask-${f.price}`) as Phaser.GameObjects.Graphics
        if (bar) this.tweens.add({ targets: bar, alpha: 0.25, duration: 300 })
      })
    })
    this.time.delayedCall(r.fills.length * 400 + 150, () => {
      this.panel(120, 350, 520, 60, { fill: C.redSoft, stroke: C.red, radius: 10 })
      const breakdown = r.fills.map((f) => `${fmtShares(f.shares)} @ ${fmtPrice(f.price)}`).join(', then ')
      this.label(140, 368, `MARKET filled ${breakdown}`, { size: 12, col: C.ink })
      this.label(140, 392, `blended avg ${fmtPrice(r.avgFill)} — above your ${fmtPrice(this.ceiling)} ceiling`, { size: 12, col: C.red, bold: true })

      const title = `Market overpaid · avg ${fmtPrice(r.avgFill)}`
      const detail = `The touch holds only ${fmtShares(ordered[0].size)} of the ${fmtShares(this.orderSize)} you need, so a market order walks up to ${fmtPrice(ordered[1]?.price ?? r.avgFill)} — a ${fmtPrice(r.avgFill)} blend that blows past your ${fmtPrice(this.ceiling)} ceiling. Market buys take whatever is resting; on a thin book with no urgency, that is the wrong tool.`
      this.report(false, title, detail)
    })
  }

  private simulateLimit(): void {
    const left = this.cx - this.maxBarW / 2
    const bestAsk = this.asks[0].price
    const willFill = this.limitPrice >= bestAsk // marketable or matchable as the touch comes to it
    const overCeiling = this.limitPrice > this.ceiling + 1e-9

    // a blue limit tile resting on the ladder
    const yL = this.yForPrice(this.limitPrice)
    const tile = this.add.graphics()
    tile.fillStyle(C.blue, 0.85)
    tile.fillRoundedRect(left, yL - 11, 70, 22, 5)
    tile.setAlpha(0)
    this.tweens.add({ targets: tile, alpha: 1, duration: 300 })

    this.time.delayedCall(450, () => {
      let correct: boolean
      let title: string
      let detail: string
      const panelCol = !overCeiling && willFill ? C.green : C.red

      if (overCeiling) {
        correct = false
        title = `Limit ${fmtPrice(this.limitPrice)} overpays`
        detail = `Right tool, wrong price: a limit at ${fmtPrice(this.limitPrice)} is above your ${fmtPrice(this.ceiling)} ceiling, so it could fill at a price you swore not to pay. Set the limit at or below ${fmtPrice(this.ceiling)} to guarantee you never overpay.`
      } else if (!willFill) {
        correct = false
        title = `Limit ${fmtPrice(this.limitPrice)} won't fill`
        detail = `A limit at ${fmtPrice(this.limitPrice)} sits below the best ask (${fmtPrice(bestAsk)}), so no seller meets it — it just rests, unfilled. You protected your price but set it so low you'll never get your shares. Aim between the best ask and your ${fmtPrice(this.ceiling)} ceiling.`
      } else {
        correct = true
        title = `Limit ${fmtPrice(this.limitPrice)} — never overpay`
        detail = `Exactly right. A limit at ${fmtPrice(this.limitPrice)} (≤ your ${fmtPrice(this.ceiling)} ceiling) rests and fills only at ${fmtPrice(this.limitPrice)} or better — you control the price. The book is thin and you can wait, so trading immediacy for price is the correct call. Market controls fill; limit controls price.`
      }

      this.panel(120, 350, 520, 60, { fill: panelCol === C.green ? C.greenSoft : C.redSoft, stroke: panelCol, radius: 10 })
      this.label(140, 368, `LIMIT ${fmtShares(this.orderSize)} @ ${fmtPrice(this.limitPrice)} · ${willFill ? 'status PENDING → fills at-or-below limit' : 'status PENDING → never reached'}`, { size: 12, col: C.ink })
      this.label(140, 392, correct ? 'You control your price — never overpay' : 'Reconsider your limit price', { size: 12, col: panelCol, bold: true })

      this.report(correct, title, detail)
    })
  }
}
