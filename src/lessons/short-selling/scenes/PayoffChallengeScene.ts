import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, color } from '../../../engine/palette'

interface PayoffChallengeParams {
  /** Entry price for both positions. Default 30. */
  entry?: number
  /** X-axis max future price. Default 150. */
  priceMax?: number
  /** Shares for the $-readout. Default 100. */
  shares?: number
  /** Initial future price. Default = entry. */
  startPrice?: number
}

/**
 * M6 CHALLENGE — "Long vs Short: which risk is worse?".
 * One stock, two mirror positions opened at the same entry. The learner DRAGS a future-
 * price slider; the SHORT loss line dives without bound while the LONG loss is floored at
 * −100% (the most a long can lose is the stake). The task: push price high enough that the
 * short's loss EXCEEDS the long's maximum possible loss — proving the short's downside is
 * unbounded. Submit grades whether they pushed past that crossover and explains the
 * asymmetry.
 *
 * Math exact:
 *   shortPnl = (entry − price) · shares     (loss grows forever as price rises)
 *   longPnl  = (price − entry) · shares     (loss can never exceed entry · shares)
 *   long max loss = entry · shares  (at price = 0)
 */
export default class PayoffChallengeScene extends ModuleScene {
  private entry = 30
  private priceMax = 150
  private shares = 100
  private price = 30

  private plot = { l: 70, r: 540, t: 70, b: 320 }
  private locked = false
  private reachedCrossover = false

  private cursor!: Phaser.GameObjects.Container
  private priceReadout!: Phaser.GameObjects.Text
  private shortReadout!: Phaser.GameObjects.Text
  private longReadout!: Phaser.GameObjects.Text
  private flag!: Phaser.GameObjects.Text

  /** Price at which the short's loss equals the long's max loss (= 2·entry). */
  private get crossoverPrice(): number {
    return 2 * this.entry
  }

  protected build(): void {
    const p = this.params as PayoffChallengeParams
    this.entry = p.entry ?? 30
    this.priceMax = p.priceMax ?? 150
    this.shares = p.shares ?? 100
    this.price = p.startPrice ?? this.entry

    this.label(this.W / 2, 22, 'Drag the future price up', {
      size: 16,
      bold: true,
      col: C.ink,
      align: 'center',
    })
    this.label(this.W / 2, 42, 'illustrative simulation · payoff math exact', {
      size: 11,
      col: C.muted,
      align: 'center',
    })

    this.drawAxes()
    this.drawLines()
    this.drawReadouts()
    this.enableSlider()

    // Start disabled — the learner must push price high enough to "see" the unbounded
    // short loss before Submit unlocks. (They CAN still submit after exploring.)
    this.setCanSubmit(true)
    this.refresh()
    this.emitReady()
  }

  // --- coordinate maps ---
  private xForPrice(price: number): number {
    const t = Math.max(0, Math.min(1, price / this.priceMax))
    return this.plot.l + t * (this.plot.r - this.plot.l)
  }
  /** P&L in $ → y. Visible band +$3000 .. −$12000 so the unbounded short tail shows. */
  private yForPnl(pnl: number): number {
    const top = 3000
    const bottom = -12000
    const t = (pnl - bottom) / (top - bottom)
    return this.plot.b - t * (this.plot.b - this.plot.t)
  }

  private shortPnl(price: number): number {
    return (this.entry - price) * this.shares
  }
  private longPnl(price: number): number {
    return (price - this.entry) * this.shares
  }
  private longMaxLoss(): number {
    return this.entry * this.shares // long loses everything at price 0
  }

  private drawAxes(): void {
    const g = this.add.graphics()
    // zero P&L line
    const yZero = this.yForPnl(0)
    g.lineStyle(1.5, C.muted, 0.6)
    g.lineBetween(this.plot.l, yZero, this.plot.r, yZero)
    this.label(this.plot.r + 4, yZero, '$0', { size: 11, col: C.muted })

    // breakeven vertical at entry
    const xE = this.xForPrice(this.entry)
    const gv = this.add.graphics()
    gv.lineStyle(1.5, C.blue, 0.5)
    gv.lineBetween(xE, this.plot.t, xE, this.plot.b)
    this.label(xE, this.plot.b + 14, `entry $${this.entry}`, { size: 11, col: C.blue, align: 'center' })

    // LONG floor: −(entry·shares). The most a long can EVER lose.
    const yFloor = this.yForPnl(-this.longMaxLoss())
    this.dashedLine(this.plot.l, yFloor, this.plot.r, C.green, 6, 5, 1.4)
    this.label(this.plot.l + 4, yFloor - 10, `Long's MAX loss −$${this.longMaxLoss().toFixed(0)} (floored)`, {
      size: 11,
      bold: true,
      col: C.green,
    })

    // x labels
    for (let pr = 0; pr <= this.priceMax; pr += this.priceMax / 5) {
      this.label(this.xForPrice(pr), this.plot.b + 2, `$${pr.toFixed(0)}`, {
        size: 10,
        col: C.muted,
        align: 'center',
      })
    }
  }

  private drawLines(): void {
    // SHORT (red): dives without bound as price rises.
    const s = this.add.graphics()
    s.lineStyle(2.5, C.red, 1)
    s.beginPath()
    let first = true
    for (let pr = 0; pr <= this.priceMax; pr += this.priceMax / 120) {
      const x = this.xForPrice(pr)
      const y = this.yForPnl(this.shortPnl(pr))
      if (first) {
        s.moveTo(x, y)
        first = false
      } else s.lineTo(x, y)
    }
    s.strokePath()
    this.label(this.plot.r - 70, this.yForPnl(this.shortPnl(this.priceMax)) + 12, 'SHORT ↓ no floor', {
      size: 11,
      bold: true,
      col: C.red,
    })

    // LONG (green): rises with price, but loss floored at −entry·shares.
    const l = this.add.graphics()
    l.lineStyle(2.5, C.green, 1)
    l.beginPath()
    first = true
    for (let pr = 0; pr <= this.priceMax; pr += this.priceMax / 120) {
      const x = this.xForPrice(pr)
      const y = this.yForPnl(this.longPnl(pr))
      if (first) {
        l.moveTo(x, y)
        first = false
      } else l.lineTo(x, y)
    }
    l.strokePath()
    // Long line exits the top of the band well before priceMax; pin its label at the top.
    this.label(this.plot.r - 70, this.plot.t + 8, 'LONG ↑ no ceiling', {
      size: 11,
      bold: true,
      col: C.green,
    })
  }

  private drawReadouts(): void {
    this.label(574, 70, 'Future price', { size: 12, bold: true, col: C.ink })
    this.priceReadout = this.label(574, 92, '', { size: 16, bold: true, col: C.blue })
    this.label(574, 128, 'SHORT P&L', { size: 11, bold: true, col: C.muted })
    this.shortReadout = this.label(574, 146, '', { size: 14, bold: true, col: C.red })
    this.label(574, 178, 'LONG P&L', { size: 11, bold: true, col: C.muted })
    this.longReadout = this.label(574, 196, '', { size: 14, bold: true, col: C.green })
    this.flag = this.label(574, 238, '', { size: 12, bold: true, col: C.red })
    this.flag.setWordWrapWidth(170)
  }

  private enableSlider(): void {
    // Scrub cursor (vertical line + knob) along the x-axis, driven by a grab strip.
    const line = this.add.graphics()
    line.lineStyle(1.5, C.ink, 0.5)
    line.lineBetween(0, this.plot.t, 0, this.plot.b)
    const knob = this.add.circle(0, this.plot.b, 9, C.blue).setStrokeStyle(3, C.white)
    this.cursor = this.add.container(this.xForPrice(this.price), 0, [line, knob])

    const moveTo = (pointerX: number) => {
      if (this.locked) return
      const localX = Math.max(this.plot.l, Math.min(this.plot.r, pointerX))
      const t = (localX - this.plot.l) / (this.plot.r - this.plot.l)
      this.price = t * this.priceMax
      this.refresh()
    }

    const strip = this.add
      .rectangle((this.plot.l + this.plot.r) / 2, (this.plot.t + this.plot.b) / 2, this.plot.r - this.plot.l, this.plot.b - this.plot.t, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    let dragging = false
    strip.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true
      moveTo(p.x)
    })
    const onMove = (p: Phaser.Input.Pointer) => {
      if (dragging) moveTo(p.x)
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

  private refresh(): void {
    this.cursor.x = this.xForPrice(this.price)
    const sPnl = this.shortPnl(this.price)
    const lPnl = this.longPnl(this.price)

    this.priceReadout.setText(`$${this.price.toFixed(0)}`)
    this.shortReadout.setText(`${sPnl >= 0 ? '+' : '−'}$${Math.abs(sPnl).toFixed(0)}`)
    this.shortReadout.setColor(hex(color(sPnl >= 0 ? C.green : C.red)))
    this.longReadout.setText(`${lPnl >= 0 ? '+' : '−'}$${Math.abs(lPnl).toFixed(0)}`)
    this.longReadout.setColor(hex(color(lPnl >= 0 ? C.green : C.red)))

    // Has the short's loss exceeded the long's MAX possible loss?
    if (-sPnl > this.longMaxLoss()) {
      this.reachedCrossover = true
      this.flag.setColor(hex(C.red))
      this.flag.setText(`Short's loss now BEATS the long's worst case (−$${this.longMaxLoss().toFixed(0)}) — and it keeps growing!`)
    } else {
      this.flag.setColor(hex(C.muted))
      this.flag.setText(`Push price above $${this.crossoverPrice.toFixed(0)} to push the short's loss past the long's max loss.`)
    }
  }

  protected onSubmit(): void {
    if (this.locked) return
    this.locked = true
    this.setCanSubmit(false)

    const sPnl = this.shortPnl(this.price)
    const lossNow = -sPnl
    // "Correct" = the learner explored far enough to see the short blow past the long's
    // floored max loss (the whole point of the module).
    const correct = this.reachedCrossover || this.price >= this.crossoverPrice

    // Mark the current price on the short line.
    const x = this.xForPrice(this.price)
    const y = this.yForPnl(sPnl)
    const dot = this.add.circle(x, y, 6, C.red).setStrokeStyle(2, C.white)
    dot.setScale(0)
    this.tweens.add({ targets: dot, scale: 1, duration: 300, ease: 'Back.out' })

    let title: string
    let detail: string
    if (correct) {
      title = 'Right — the short has UNLIMITED downside'
      detail =
        `At $${this.price.toFixed(0)} the short is down $${lossNow.toFixed(0)} — already worse than the most a long can EVER lose ` +
        `($${this.longMaxLoss().toFixed(0)}, the whole stake, hit only if the stock goes to $0). The long's loss is FLOORED; the short's ` +
        `keeps growing as price rises — double, triple, 10×, no cap. Capped loss vs unbounded loss is why a short demands a stop.`
    } else {
      title = 'Look higher — the short keeps falling'
      detail =
        `At $${this.price.toFixed(0)} the short is only down $${lossNow.toFixed(0)}, still inside the long's max loss of $${this.longMaxLoss().toFixed(0)}. ` +
        `But keep dragging: past $${this.crossoverPrice.toFixed(0)} the short's loss BLOWS PAST the long's worst case and never stops — that's the ` +
        `unbounded downside. A long can only lose its stake; a short can lose without limit. The SHORT is the worse risk.`
    }
    this.report(correct, title, detail)
  }
}
