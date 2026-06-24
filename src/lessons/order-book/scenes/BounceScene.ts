import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtPrice } from './book'

interface BounceParams {
  bid?: number
  ask?: number
}

/**
 * MODULE 13 — TEACH "Bid-Ask Bounce & the Moving Touch". Prints alternate green (buy
 * at the ask) and red (sell at the bid), drawing a 1-cent sawtooth while the blue MID
 * holds dead flat — the bounce is noise, not a price change. A toggle turns the order
 * churn on/off (off → flat tape). Live tally: prints at ask / at bid, current mid
 * (unchanged), and a faint NBBO badge. Tape color tracks the AGGRESSOR (see spec §6 M13).
 */
export default class BounceScene extends ModuleScene {
  private bid = 100.0
  private ask = 100.01
  private churn = true
  private prints: number[] = []
  private atAsk = 0
  private atBid = 0
  private nextIsAsk = true

  private readonly plotL = 70
  private readonly plotR = 560
  private readonly plotT = 110
  private readonly plotB = 280
  private readonly maxPrints = 16

  private tapeG!: Phaser.GameObjects.Graphics
  private lastPrintT!: Phaser.GameObjects.Text
  private tallyT!: Phaser.GameObjects.Text
  private toggleBtn!: Phaser.GameObjects.Container

  protected build(): void {
    const p = this.params as BounceParams
    this.bid = p.bid ?? 100.0
    this.ask = p.ask ?? 100.01

    this.label(this.W / 2, 30, 'Buys print at the ask, sells at the bid — a sawtooth while the mid never moves', {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated depth', { size: 11, col: C.blue }).setAlpha(0.8)

    this.drawAxis()
    this.tapeG = this.add.graphics()
    this.drawFrozenMid()

    this.buildPanel()
    this.buildToggle()
    this.buildNbbo()

    this.startChurn()
    this.time.delayedCall(700, () => this.emitReady())
  }

  private yFor(price: number): number {
    const pMin = this.bid - 0.01
    const pMax = this.ask + 0.01
    const t = (price - pMin) / (pMax - pMin)
    return this.plotB - t * (this.plotB - this.plotT)
  }

  private drawAxis(): void {
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline, 1)
    g.lineBetween(this.plotL, this.plotT - 10, this.plotL, this.plotB + 10)
    for (const pr of [this.bid, this.ask]) {
      const y = this.yFor(pr)
      g.lineStyle(1, C.gray100, 1)
      g.lineBetween(this.plotL, y, this.plotR, y)
      this.label(this.plotL - 8, y, fmtPrice(pr), { size: 12, col: pr === this.ask ? C.red : C.green, align: 'right', bold: true })
    }
    this.label(this.plotR, this.yFor(this.ask) - 14, 'best ask (buys print here)', { size: 12, col: C.red, align: 'right', bg: true })
    this.label(this.plotR, this.yFor(this.bid) + 14, 'best bid (sells print here)', { size: 12, col: C.green, align: 'right', bg: true })
  }

  private drawFrozenMid(): void {
    const mid = (this.bid + this.ask) / 2
    const y = this.yFor(mid)
    this.dashedLine(this.plotL, y, this.plotR, C.blue, 8, 6, 2)
    this.label(this.plotL + 6, y - 12, `MID (frozen) ${this.fmtMid(mid)}`, { size: 12, col: C.blue, bold: true, bg: true })
  }

  private fmtMid(m: number): string {
    return Math.abs(m * 100 - Math.round(m * 100)) > 1e-6 ? m.toFixed(3) : m.toFixed(2)
  }

  private startChurn(): void {
    this.time.addEvent({ delay: 650, loop: true, callback: () => this.tick() })
  }

  private tick(): void {
    if (!this.churn) {
      // no churn: repeat a single price (mid-ish) — flat tape
      this.prints.push((this.bid + this.ask) / 2)
    } else {
      const price = this.nextIsAsk ? this.ask : this.bid
      if (this.nextIsAsk) this.atAsk++
      else this.atBid++
      this.nextIsAsk = !this.nextIsAsk
      this.prints.push(price)
    }
    if (this.prints.length > this.maxPrints) this.prints.shift()
    this.redrawTape()
    this.updatePanel()
  }

  private redrawTape(): void {
    this.tapeG.clear()
    const n = this.maxPrints
    const dx = (this.plotR - this.plotL) / (n - 1)
    // line connecting prints
    this.tapeG.lineStyle(2, C.ink, 0.25)
    let prevX = 0
    let prevY = 0
    this.prints.forEach((pr, i) => {
      const x = this.plotL + i * dx
      const y = this.yFor(pr)
      if (i > 0) this.tapeG.lineBetween(prevX, prevY, x, y)
      prevX = x
      prevY = y
    })
    // chips
    this.prints.forEach((pr, i) => {
      const x = this.plotL + i * dx
      const y = this.yFor(pr)
      const isAsk = Math.abs(pr - this.ask) < 1e-9
      const isBid = Math.abs(pr - this.bid) < 1e-9
      const col = isAsk ? C.green : isBid ? C.red : C.muted
      this.tapeG.fillStyle(col, 1)
      this.tapeG.fillCircle(x, y, 5)
    })
  }

  private buildPanel(): void {
    const px = 590
    const py = 110
    this.panel(px, py, 158, 156, { fill: C.gray100, stroke: C.hairline, radius: 10 })
    this.label(px + 12, py + 18, 'Last print', { size: 12, col: C.muted })
    this.lastPrintT = this.label(px + 12, py + 42, '—', { size: 17, col: C.ink, bold: true })
    this.label(px + 12, py + 74, 'Current mid', { size: 12, col: C.muted })
    this.label(px + 12, py + 96, `${this.fmtMid((this.bid + this.ask) / 2)} (unchanged)`, { size: 12, col: C.blue, bold: true })
    this.tallyT = this.label(px + 12, py + 128, 'prints: 0 ask / 0 bid', { size: 12, col: C.ink })
  }

  private updatePanel(): void {
    const last = this.prints[this.prints.length - 1]
    const isAsk = Math.abs(last - this.ask) < 1e-9
    const isBid = Math.abs(last - this.bid) < 1e-9
    this.lastPrintT.setText(fmtPrice(last))
    this.lastPrintT.setColor(hex(isAsk ? C.green : isBid ? C.red : C.muted))
    this.tallyT.setText(`prints: ${this.atAsk} ask / ${this.atBid} bid`)
  }

  private buildToggle(): void {
    this.toggleBtn = this.button(this.W / 2, 330, 'Order churn: ON', () => this.toggle(), { w: 200, fill: C.green })
  }

  private toggle(): void {
    this.churn = !this.churn
    const g = this.toggleBtn.getAt(0) as Phaser.GameObjects.Graphics
    const t = this.toggleBtn.getAt(1) as Phaser.GameObjects.Text
    g.clear()
    g.fillStyle(this.churn ? C.green : C.muted, 1)
    g.fillRoundedRect(-100, -20, 200, 40, 10)
    t.setText(this.churn ? 'Order churn: ON' : 'Order churn: OFF')
    const note = this.children.getByName('churnNote') as Phaser.GameObjects.Text | null
    if (!this.churn) {
      if (!note) this.label(this.W / 2, 368, 'No churn → no bounce. The sawtooth was order flow, not value.', { size: 12, col: C.muted, align: 'center' }).setName('churnNote')
    } else {
      note?.destroy()
    }
  }

  private buildNbbo(): void {
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 1)
    g.fillRoundedRect(this.plotL, 54, 244, 28, 6)
    g.lineStyle(1, C.blue, 0.5)
    g.strokeRoundedRect(this.plotL, 54, 244, 28, 6)
    this.label(this.plotL + 10, 68, 'NBBO — best quote across all venues', { size: 12, col: C.blue }).setAlpha(0.9)
  }
}
