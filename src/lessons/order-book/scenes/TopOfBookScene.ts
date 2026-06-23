import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtPrice } from './book'

interface TopOfBookParams {
  bid?: number
  ask?: number
}

/**
 * MODULE 2 — TEACH. Best bid (green) and best ask (red) on a vertical price axis,
 * a blue caliper printing SPREAD = ask - bid, and a blue MID dot at (bid+ask)/2.
 * Two DRAGGABLE handles let the learner move bid/ask on a 1-cent snap; spread + mid
 * recompute live. Dragging bid >= ask shows the "crossed book — impossible" warning,
 * and release snaps bid back below ask.
 */
export default class TopOfBookScene extends ModuleScene {
  private bid = 100.0
  private ask = 100.02
  private readonly tick = 0.01

  private axisX = 250
  private axisTop = 70
  private axisBot = 380
  private pMin = 99.9
  private pMax = 100.12

  private bidHandle!: Phaser.GameObjects.Container
  private askHandle!: Phaser.GameObjects.Container
  private caliper!: Phaser.GameObjects.Graphics
  private spreadLabel!: Phaser.GameObjects.Text
  private midDot!: Phaser.GameObjects.Arc
  private midLabel!: Phaser.GameObjects.Text
  private warnPanel!: Phaser.GameObjects.Container
  private hatch!: Phaser.GameObjects.Graphics

  protected build(): void {
    const p = this.params as TopOfBookParams
    this.bid = p.bid ?? 100.0
    this.ask = p.ask ?? 100.02

    this.label(this.W / 2, 36, 'Drag the handles — but a buyer can never pay more than a seller asks', {
      size: 14,
      col: C.muted,
      align: 'center',
    })

    this.drawAxis()

    this.hatch = this.add.graphics()
    this.caliper = this.add.graphics()
    this.spreadLabel = this.label(this.axisX + 150, 0, '', { size: 15, col: C.blue, bold: true, align: 'center' })
    this.midDot = this.add.circle(this.axisX, 0, 7, C.blue).setStrokeStyle(2, C.white)
    this.midLabel = this.label(this.axisX - 120, 0, '', { size: 14, col: C.blue, bold: true })

    this.bidHandle = this.makeHandle('bid')
    this.askHandle = this.makeHandle('ask')

    this.warnPanel = this.makeWarnPanel()
    this.warnPanel.setVisible(false)

    // Rule banner.
    const banner = this.label(this.W / 2, 415, 'bid < ask, always', { size: 16, col: C.ink, align: 'center', bold: true })
    this.fadeIn(banner, 600)

    this.redraw()
    this.time.delayedCall(700, () => this.emitReady())
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
    for (let p = 99.9; p <= 100.12 + 1e-9; p += 0.02) {
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
      .text(10, 0, '', { fontFamily: '"Segoe UI", sans-serif', fontSize: '13px', color: hex(col), fontStyle: 'bold' })
      .setOrigin(0, 0.5)
    t.setName('lbl')
    const c = this.add.container(this.axisX + 4, 0, [g, t]).setSize(w, h)
    c.setInteractive(new Phaser.Geom.Rectangle(0, -h / 2, w, h), Phaser.Geom.Rectangle.Contains)
    this.input.setDraggable(c)
    c.input!.cursor = 'ns-resize'

    c.on('drag', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
      const raw = this.snap(this.priceFor(Phaser.Math.Clamp(dy, this.axisTop, this.axisBot)))
      if (side === 'bid') this.bid = Phaser.Math.Clamp(raw, this.pMin, this.pMax)
      else this.ask = Phaser.Math.Clamp(raw, this.pMin, this.pMax)
      this.redraw()
    })
    c.on('dragend', () => {
      // Snap bid back below ask on release if crossed.
      if (this.bid >= this.ask) {
        if (side === 'bid') this.bid = this.snap(this.ask - this.tick)
        else this.ask = this.snap(this.bid + this.tick)
        this.redraw()
      }
    })
    return c
  }

  private makeWarnPanel(): Phaser.GameObjects.Container {
    const w = 280
    const h = 70
    const g = this.add.graphics()
    g.fillStyle(C.redSoft, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10)
    g.lineStyle(2, C.red, 1)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10)
    const t1 = this.add
      .text(0, -16, 'Crossed book — impossible', { fontFamily: '"Segoe UI", sans-serif', fontSize: '14px', color: hex(C.red), fontStyle: 'bold' })
      .setOrigin(0.5)
    const t2 = this.add
      .text(0, 8, 'A buyer paying ≥ what a seller asks\nwould just trade. bid < ask, always.', {
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '11px',
        color: hex(C.red),
        align: 'center',
      })
      .setOrigin(0.5)
    return this.add.container(this.axisX + 170, 150, [g, t1, t2])
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
    const calX = this.axisX + 110
    this.caliper.lineStyle(2, crossed ? C.red : C.blue, 1)
    this.caliper.lineBetween(calX, yAsk, calX, yBid)
    this.caliper.lineBetween(calX - 8, yAsk, calX + 8, yAsk)
    this.caliper.lineBetween(calX - 8, yBid, calX + 8, yBid)
    this.spreadLabel.setPosition(calX + 16, (yAsk + yBid) / 2)
    this.spreadLabel.setOrigin(0, 0.5)
    this.spreadLabel.setColor(hex(crossed ? C.red : C.blue))
    this.spreadLabel.setText(crossed ? `SPREAD = ${fmtPrice(spread)} ✗` : `SPREAD = ask − bid = ${fmtPrice(spread)}`)

    // hatch fill when crossed
    this.hatch.clear()
    if (crossed) {
      this.hatch.lineStyle(1.5, C.red, 0.5)
      const top = Math.min(yAsk, yBid)
      const bot = Math.max(yAsk, yBid) + 24
      for (let x = this.axisX + 4; x < calX; x += 8) this.hatch.lineBetween(x, bot, x + 16, top)
    }

    // mid
    const yMid = this.yFor(mid)
    this.midDot.setPosition(this.axisX, yMid)
    this.midLabel.setPosition(this.axisX - 14, yMid)
    this.midLabel.setOrigin(1, 0.5)
    this.midDot.setVisible(!crossed)
    this.midLabel.setVisible(!crossed)
    this.midLabel.setText(`MID = (${fmtPrice(this.bid)}+${fmtPrice(this.ask)})/2 = ${this.fmtMid(mid)}`)

    this.warnPanel.setVisible(crossed)

    this.readout('spread', Number(spread.toFixed(2)))
    this.readout('mid', Number(mid.toFixed(3)))
  }

  private fmtMid(m: number): string {
    // Show 3 dp only when needed (half-cent), else 2 dp.
    return Math.abs(m * 100 - Math.round(m * 100)) > 1e-6 ? m.toFixed(3) : m.toFixed(2)
  }
}
