import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, FONT, hex } from '../../../engine/palette'
import { fmtPrice } from './book'

interface QuoteCardsParams {
  /** Starting bid / ask the learner drags from. */
  bid?: number
  ask?: number
  /** The spread the learner must hit (e.g. 0.04). */
  targetSpread?: number
  /** Price-axis bounds. */
  pMin?: number
  pMax?: number
}

/**
 * MODULE 3 — CHALLENGE "Set the Quote". The learner drags a green BID and a red ASK
 * handle on a vertical price axis to build a VALID book (bid < ask) whose spread equals
 * the target (e.g. 4¢). A live blue caliper prints the running spread; cross the book
 * and a red "crossed — impossible" warning appears. On Submit the scene grades
 * spread === target AND bid < ask, then explains via report().
 *
 * All math is exact: spread = ask − bid, mid = (bid+ask)/2, snapped to a 1-cent tick.
 */
export default class QuoteCardsScene extends ModuleScene {
  private bid = 50.1
  private ask = 50.16
  private target = 0.04
  private readonly tick = 0.01
  private locked = false

  private axisX = 250
  private axisTop = 80
  private axisBot = 380
  private pMin = 49.9
  private pMax = 50.3

  private bidHandle!: Phaser.GameObjects.Container
  private askHandle!: Phaser.GameObjects.Container
  private caliper!: Phaser.GameObjects.Graphics
  private spreadLabel!: Phaser.GameObjects.Text
  private spreadChip!: Phaser.GameObjects.Graphics
  private midDot!: Phaser.GameObjects.Arc
  private midLabel!: Phaser.GameObjects.Text
  private midChip!: Phaser.GameObjects.Graphics
  private statusLabel!: Phaser.GameObjects.Text
  private warnPanel!: Phaser.GameObjects.Container
  private hatch!: Phaser.GameObjects.Graphics

  protected build(): void {
    const p = this.params as QuoteCardsParams
    this.bid = p.bid ?? 50.1
    this.ask = p.ask ?? 50.16
    this.target = p.targetSpread ?? 0.04
    this.pMin = p.pMin ?? 49.9
    this.pMax = p.pMax ?? 50.3

    this.label(this.W / 2, 34, `Target spread: ${fmtPrice(this.target)}  ·  drag BID and ASK to match it`, {
      size: 14,
      col: C.muted,
      align: 'center',
    })

    this.drawAxis()

    this.hatch = this.add.graphics()
    this.caliper = this.add.graphics()
    // chips behind the live spread/mid readouts so they stay legible over the axis
    // ticks and the dragging handles (redrawn each update).
    this.spreadChip = this.add.graphics()
    this.spreadLabel = this.label(this.axisX + 130, 0, '', { size: 14, col: C.blue, bold: true })
    this.midDot = this.add.circle(this.axisX, 0, 7, C.blue).setStrokeStyle(2, C.white)
    this.midChip = this.add.graphics()
    this.midLabel = this.label(14, 0, '', { size: 13, col: C.blue, bold: true })

    this.bidHandle = this.makeHandle('bid')
    this.askHandle = this.makeHandle('ask')

    this.warnPanel = this.makeWarnPanel()
    this.warnPanel.setVisible(false)

    this.statusLabel = this.label(this.W / 2, 418, '', { size: 15, col: C.ink, align: 'center', bold: true })

    this.redraw()
    this.setCanSubmit(true) // sensible defaults → submit is always valid
    this.time.delayedCall(500, () => this.emitReady())
  }

  private yFor(price: number): number {
    const t = (price - this.pMin) / (this.pMax - this.pMin)
    return this.axisBot - t * (this.axisBot - this.axisTop)
  }
  private priceFor(y: number): number {
    const t = (this.axisBot - y) / (this.axisBot - this.axisTop)
    return this.pMin + t * (this.pMax - this.pMin)
  }
  private snap(p: number): number {
    return Math.round(p / this.tick) * this.tick
  }

  private drawAxis(): void {
    const g = this.add.graphics()
    g.lineStyle(2, C.hairline, 1)
    g.lineBetween(this.axisX, this.axisTop - 10, this.axisX, this.axisBot + 10)
    for (let p = this.pMin; p <= this.pMax + 1e-9; p += 0.04) {
      const y = this.yFor(p)
      g.lineStyle(1, C.gray100, 1)
      g.lineBetween(this.axisX - 6, y, this.axisX + 6, y)
      this.label(this.axisX - 14, y, fmtPrice(p), { size: 11, col: C.muted, align: 'right' })
    }
  }

  private makeHandle(side: 'bid' | 'ask'): Phaser.GameObjects.Container {
    const col = side === 'bid' ? C.green : C.red
    const w = 150
    const h = 28
    const g = this.add.graphics()
    g.fillStyle(side === 'bid' ? C.greenSoft : C.redSoft, 1)
    g.fillRoundedRect(0, -h / 2, w, h, 7)
    g.lineStyle(2, col, 1)
    g.strokeRoundedRect(0, -h / 2, w, h, 7)
    g.fillStyle(col, 1)
    g.fillTriangle(-10, -7, -10, 7, 0, 0) // pointer toward axis
    const t = this.add
      .text(10, 0, '', { fontFamily: FONT, fontSize: '13px', color: hex(col), fontStyle: 'bold' })
      .setOrigin(0, 0.5)
    t.setName('lbl')
    const c = this.add.container(this.axisX + 4, 0, [g, t]).setSize(w, h)
    c.setInteractive(new Phaser.Geom.Rectangle(0, -h / 2, w, h), Phaser.Geom.Rectangle.Contains)
    this.input.setDraggable(c)
    c.input!.cursor = 'ns-resize'

    c.on('drag', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
      if (this.locked) return
      const raw = this.snap(this.priceFor(Phaser.Math.Clamp(dy, this.axisTop, this.axisBot)))
      if (side === 'bid') this.bid = Phaser.Math.Clamp(raw, this.pMin, this.pMax)
      else this.ask = Phaser.Math.Clamp(raw, this.pMin, this.pMax)
      this.redraw()
    })
    return c
  }

  private makeWarnPanel(): Phaser.GameObjects.Container {
    const w = 296
    const h = 62
    const g = this.add.graphics()
    g.fillStyle(C.redSoft, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10)
    g.lineStyle(2, C.red, 1)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10)
    const t1 = this.add
      .text(0, -14, 'Crossed book — impossible', { fontFamily: FONT, fontSize: '14px', color: hex(C.red), fontStyle: 'bold' })
      .setOrigin(0.5)
    const t2 = this.add
      .text(0, 11, "A buyer won't pay more than the ask.", {
        fontFamily: FONT,
        fontSize: '12px',
        color: hex(C.red),
        align: 'center',
      })
      .setOrigin(0.5)
    return this.add.container(this.axisX + 200, 150, [g, t1, t2])
  }

  /** Round to whole cents to avoid float dust when comparing the spread. */
  private cents(v: number): number {
    return Math.round(v * 100)
  }

  private redraw(): void {
    const crossed = this.bid >= this.ask
    const yBid = this.yFor(this.bid)
    const yAsk = this.yFor(this.ask)

    this.bidHandle.y = yBid
    this.askHandle.y = yAsk
    ;(this.bidHandle.getByName('lbl') as Phaser.GameObjects.Text).setText(`BID ${fmtPrice(this.bid)}`)
    ;(this.askHandle.getByName('lbl') as Phaser.GameObjects.Text).setText(`ASK ${fmtPrice(this.ask)}`)

    const spread = this.ask - this.bid
    const mid = (this.ask + this.bid) / 2

    // caliper
    this.caliper.clear()
    const calX = this.axisX + 100
    this.caliper.lineStyle(2, crossed ? C.red : C.blue, 1)
    this.caliper.lineBetween(calX, yAsk, calX, yBid)
    this.caliper.lineBetween(calX - 8, yAsk, calX + 8, yAsk)
    this.caliper.lineBetween(calX - 8, yBid, calX + 8, yBid)
    // spread readout to the RIGHT of the handle boxes (they extend to axisX+154)
    this.spreadLabel.setPosition(calX + 60, (yAsk + yBid) / 2)
    this.spreadLabel.setColor(hex(crossed ? C.red : C.blue))
    this.spreadLabel.setText(crossed ? `SPREAD = ${fmtPrice(spread)} ✗` : `SPREAD = ${fmtPrice(spread)}`)
    this.drawChip(this.spreadChip, this.spreadLabel)

    // hatch fill when crossed
    this.hatch.clear()
    if (crossed) {
      this.hatch.lineStyle(1.5, C.red, 0.5)
      const top = Math.min(yAsk, yBid)
      const bot = Math.max(yAsk, yBid) + 24
      for (let x = this.axisX + 4; x < calX; x += 8) this.hatch.lineBetween(x, bot, x + 16, top)
    }

    // mid value-only readout in the LEFT gutter, clear of the tick labels
    const yMid = this.yFor(mid)
    this.midDot.setPosition(this.axisX, yMid)
    this.midLabel.setPosition(14, yMid)
    this.midDot.setVisible(!crossed)
    this.midLabel.setVisible(!crossed)
    this.midLabel.setText(`MID ${this.fmtMid(mid)}`)
    this.midChip.setVisible(!crossed)
    this.drawChip(this.midChip, this.midLabel)

    this.warnPanel.setVisible(crossed)

    // live status toward the goal
    if (crossed) {
      this.statusLabel.setText('Crossed — bid must be below ask')
      this.statusLabel.setColor(hex(C.red))
    } else if (this.cents(spread) === this.cents(this.target)) {
      this.statusLabel.setText(`On target: ${fmtPrice(this.target)} spread ✓`)
      this.statusLabel.setColor(hex(C.green))
    } else {
      const diff = this.cents(spread) - this.cents(this.target)
      this.statusLabel.setText(`Spread ${fmtPrice(spread)} — ${diff > 0 ? 'too wide' : 'too tight'} (target ${fmtPrice(this.target)})`)
      this.statusLabel.setColor(hex(C.muted))
    }
  }

  private fmtMid(m: number): string {
    return Math.abs(m * 100 - Math.round(m * 100)) > 1e-6 ? m.toFixed(3) : m.toFixed(2)
  }

  /** Redraw a white chip sized to a (re-positioned/re-texted) label, kept below it. */
  private drawChip(g: Phaser.GameObjects.Graphics, t: Phaser.GameObjects.Text): void {
    const padX = 6
    const padY = 3
    const bx = t.x - t.originX * t.width - padX
    const by = t.y - t.originY * t.height - padY
    g.clear()
    g.fillStyle(C.white, 0.85)
    g.fillRoundedRect(bx, by, t.width + padX * 2, t.height + padY * 2, 5)
  }

  protected onSubmit(): void {
    if (this.locked) return
    this.locked = true
    this.setCanSubmit(false)

    const spread = this.ask - this.bid
    const mid = (this.ask + this.bid) / 2
    const valid = this.bid < this.ask
    const onTarget = this.cents(spread) === this.cents(this.target)
    const correct = valid && onTarget

    // freeze the picture; flash the result colour on the caliper
    const col = correct ? C.green : C.red
    this.caliper.clear()
    const calX = this.axisX + 100
    const yBid = this.yFor(this.bid)
    const yAsk = this.yFor(this.ask)
    this.caliper.lineStyle(3, col, 1)
    this.caliper.lineBetween(calX, yAsk, calX, yBid)
    this.caliper.lineBetween(calX - 8, yAsk, calX + 8, yAsk)
    this.caliper.lineBetween(calX - 8, yBid, calX + 8, yBid)
    this.spreadLabel.setColor(hex(col))

    let title: string
    let detail: string
    if (correct) {
      title = `Valid book · ${fmtPrice(this.target)} spread`
      detail = `Bid ${fmtPrice(this.bid)} is below ask ${fmtPrice(this.ask)}, and the gap is exactly ${fmtPrice(spread)}. The mid sits right in the middle at ${this.fmtMid(mid)}.`
    } else if (!valid) {
      title = 'Crossed book — impossible'
      detail = `You set bid ${fmtPrice(this.bid)} at or above ask ${fmtPrice(this.ask)}. That can't happen — a buyer willing to pay the ask would just trade. Keep bid below ask.`
    } else {
      const dir = this.cents(spread) > this.cents(this.target) ? 'wide' : 'tight'
      title = `Valid, but ${fmtPrice(spread)} — not the target`
      detail = `Bid ${fmtPrice(this.bid)} below ask ${fmtPrice(this.ask)} is a valid book, but the gap is ${fmtPrice(spread)} — too ${dir}. The target was ${fmtPrice(this.target)}.`
    }
    // Defer the verdict by a tick so it lands AFTER the renderer flips to its
    // "awaiting" phase: the footer emits `submit`, we'd otherwise report() back
    // synchronously inside that same emit and the phase would be overwritten,
    // stranding the learner on "Revealing…" until the safety-net timeout. The
    // short beat also lets the result-coloured caliper flash read first.
    this.time.delayedCall(this.dur(420), () => this.report(correct, title, detail))
  }
}
