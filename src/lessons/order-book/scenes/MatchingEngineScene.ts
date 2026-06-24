import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, FONT, hex } from '../../../engine/palette'
import { fmtPrice, fmtShares } from './book'

interface RestingOrder {
  id: string
  price: number
  arrival: string
  size: number
}
interface MatchingParams {
  resting?: RestingOrder[]
  incoming?: number
}

const DEFAULT_RESTING: RestingOrder[] = [
  { id: 'A', price: 20.0, arrival: '9:30:01', size: 100 },
  { id: 'B', price: 20.0, arrival: '9:30:05', size: 100 },
  { id: 'C', price: 20.01, arrival: '9:30:02', size: 100 },
]

interface Tile {
  order: RestingOrder
  container: Phaser.GameObjects.Container
  filled: boolean
}

/**
 * MODULE 7 — INTERACTIVE "Matching Engine: Price-Time Priority". Resting limit tiles
 * queue at price rungs with arrival timestamps. The learner can SWAP the two same-price
 * orders' arrival order to discover earliest-wins, then fires a marketable MARKET BUY
 * that fills best price first, then FIFO. Each match flashes green and annihilates; a
 * PRINT drops on the tape and a fill log lists the sequence.
 */
export default class MatchingEngineScene extends ModuleScene {
  private resting: RestingOrder[] = []
  private incoming = 300
  private tiles: Tile[] = []
  private firing = false
  private logY = 70
  private logX = 470
  private logCount = 0

  private readonly rungX = 60
  private readonly rung20Y = 150
  private readonly rung2001Y = 250

  protected build(): void {
    const p = this.params as MatchingParams
    this.resting = (p.resting ?? DEFAULT_RESTING).map((o) => ({ ...o }))
    this.incoming = p.incoming ?? 300

    this.label(this.W / 2, 30, 'Price first, then time (FIFO). Swap A/B order, then fire the market buy.', {
      size: 13,
      col: C.muted,
      align: 'center',
    })

    this.drawRungLabels()
    this.layoutTiles()
    this.drawLog()
    this.buildControls()

    this.time.delayedCall(700, () => this.emitReady())
  }

  private drawRungLabels(): void {
    this.label(this.rungX - 44, this.rung20Y, 'ASK\n20.00', { size: 12, col: C.red, bold: true })
    this.label(this.rungX - 44, this.rung2001Y, 'ASK\n20.01', { size: 12, col: C.red, bold: true })
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline, 1)
    g.lineBetween(this.rungX, this.rung20Y, 440, this.rung20Y)
    g.lineBetween(this.rungX, this.rung2001Y, 440, this.rung2001Y)
  }

  private layoutTiles(): void {
    // destroy old
    this.tiles.forEach((t) => t.container.destroy())
    this.tiles = []
    // group by price, FIFO order within price (sort by arrival).
    const byPrice = (price: number) =>
      this.resting.filter((o) => o.price === price).sort((a, b) => a.arrival.localeCompare(b.arrival))

    const place = (orders: RestingOrder[], y: number) => {
      orders.forEach((o, i) => {
        const x = this.rungX + 30 + i * 120
        const tile = this.makeTile(o, x, y)
        this.tiles.push({ order: o, container: tile, filled: false })
      })
    }
    place(byPrice(20.0), this.rung20Y)
    place(byPrice(20.01), this.rung2001Y)
  }

  private makeTile(o: RestingOrder, x: number, y: number): Phaser.GameObjects.Container {
    const w = 112
    const h = 60
    const g = this.add.graphics()
    g.fillStyle(C.greenSoft, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8)
    g.lineStyle(2, C.green, 1)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8)
    const idT = this.add.text(0, -16, o.id, { fontFamily: FONT, fontSize: '16px', color: hex(C.green), fontStyle: 'bold' }).setOrigin(0.5)
    const szT = this.add.text(0, 4, `${fmtShares(o.size)} sh`, { fontFamily: FONT, fontSize: '12px', color: hex(C.ink) }).setOrigin(0.5)
    const tT = this.add.text(0, 20, o.arrival, { fontFamily: FONT, fontSize: '12px', color: hex(C.blue) }).setOrigin(0.5)
    return this.add.container(x, y, [g, idT, szT, tT]).setSize(w, h)
  }

  private drawLog(): void {
    this.panel(this.logX, this.logY - 24, 270, 200, { fill: C.gray100, stroke: C.hairline, radius: 8 })
    this.label(this.logX + 12, this.logY - 4, 'Fill log (time & sales)', { size: 12, col: C.muted, bold: true })
  }

  private addLog(text: string): void {
    if (this.logCount >= 6) return
    const y = this.logY + 22 + this.logCount * 24
    const t = this.label(this.logX + 16, y, text, { size: 12, col: C.green, bold: true }).setAlpha(0)
    this.tweens.add({ targets: t, alpha: 1, x: this.logX + 20, duration: 280 })
    this.logCount++
  }

  private buildControls(): void {
    this.label(this.W / 2, 330, `Incoming: MARKET BUY ${this.incoming}`, { size: 14, col: C.red, align: 'center', bold: true })
    this.button(this.W / 2 - 110, 380, 'Swap A ↔ B time', () => this.swapAB(), { w: 170, fill: C.muted })
    this.button(this.W / 2 + 110, 380, 'Fire market buy', () => this.fire(), { w: 170, fill: C.red })
  }

  private swapAB(): void {
    if (this.firing) return
    const a = this.resting.find((o) => o.id === 'A')
    const b = this.resting.find((o) => o.id === 'B')
    if (a && b) {
      const tmp = a.arrival
      a.arrival = b.arrival
      b.arrival = tmp
      this.layoutTiles()
      this.emitReady()
    }
  }

  private fire(): void {
    if (this.firing) return
    this.firing = true
    // build fill sequence: price priority (asc), then arrival (asc)
    const seq = this.resting
      .slice()
      .sort((x, y) => (x.price - y.price) || x.arrival.localeCompare(y.arrival))
    let remaining = this.incoming
    const steps: RestingOrder[] = []
    for (const o of seq) {
      if (remaining <= 0) break
      steps.push(o)
      remaining -= o.size
    }
    let i = 0
    const playNext = () => {
      if (i >= steps.length) {
        this.firing = false
        return
      }
      this.annihilate(steps[i], () => {
        i++
        playNext()
      })
    }
    playNext()
  }

  private annihilate(o: RestingOrder, done: () => void): void {
    const tile = this.tiles.find((t) => t.order.id === o.id && !t.filled)
    if (!tile) {
      done()
      return
    }
    tile.filled = true
    // green flash
    const c = tile.container
    this.tweens.add({ targets: c, scale: 1.12, duration: 140, yoyo: true, ease: 'Quad.out' })
    const flash = this.add.circle(c.x, c.y, 40, C.greenLight, 0.6).setScale(0.4)
    this.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: 420, onComplete: () => flash.destroy() })
    this.tweens.add({
      targets: c,
      alpha: 0,
      delay: 200,
      duration: 260,
      onComplete: () => {
        c.destroy()
        this.shuffleForward(o.price)
      },
    })
    this.addLog(`PRINT ${fmtShares(o.size)} @ ${fmtPrice(o.price)} (${o.id})`)
    this.time.delayedCall(480, done)
  }

  private shuffleForward(price: number): void {
    // remaining tiles at this price slide left to fill the gap.
    const remaining = this.tiles.filter((t) => !t.filled && t.order.price === price)
    remaining.sort((a, b) => a.order.arrival.localeCompare(b.order.arrival))
    const baseX = this.rungX + 30
    remaining.forEach((t, idx) => {
      this.tweens.add({ targets: t.container, x: baseX + idx * 120, duration: 260, ease: 'Cubic.out' })
    })
  }
}
