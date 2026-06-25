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
  badge: Phaser.GameObjects.Text
  filled: boolean
}

/**
 * MODULE 7 — INTERACTIVE "Matching Engine: Price-Time Priority". Metaphor: a deli counter
 * with take-a-number tickets. Each resting sell order (an ASK, drawn red) is a customer
 * holding a ticket (its arrival time). The counter serves the best price first; ties go to
 * the earliest ticket — that's FIFO. A live "served #N" badge on each tile previews the
 * serving order and re-sorts the instant you swap two same-price tickets, so the rule is
 * visible before you even fire. Firing the MARKET BUY serves them in that order: each prints
 * a green BUY flash and drops onto the tape. Same price→time fill logic; only the picture
 * changed.
 */
export default class MatchingEngineScene extends ModuleScene {
  private resting: RestingOrder[] = []
  private incoming = 300
  private tiles: Tile[] = []
  private firing = false
  private logY = 70
  private logX = 470
  private logCount = 0
  private servingText!: Phaser.GameObjects.Text

  private readonly rungX = 60
  private readonly rung20Y = 165
  private readonly rung2001Y = 265

  protected build(): void {
    const p = this.params as MatchingParams
    this.resting = (p.resting ?? DEFAULT_RESTING).map((o) => ({ ...o }))
    this.incoming = p.incoming ?? 300

    this.label(this.W / 2, 28, 'Deli rule: best price served first; ties go to the earliest ticket (arrival)', {
      size: this.fs(13),
      col: C.muted,
      align: 'center',
    })

    this.drawCounter()
    this.drawRungLabels()
    this.layoutTiles(true)
    this.drawLog()
    this.buildControls()

    this.time.delayedCall(this.dur(700), () => this.emitReady())
  }

  private drawCounter(): void {
    // "Now serving" ticket display above the queue.
    this.label(this.rungX, 96, 'NOW SERVING', { size: this.fs(11, 11, 13), col: C.amberInk, bold: true })
    this.servingText = this.label(this.rungX + 112, 96, '— take a number —', {
      size: this.fs(13),
      col: C.amberInk,
      bold: true,
      bg: true,
      bgCol: C.amberSoft,
    })
  }

  private drawRungLabels(): void {
    this.label(this.rungX - 44, this.rung20Y, 'ASK\n20.00', { size: this.fs(12), col: C.red, bold: true })
    this.label(this.rungX - 44, this.rung2001Y, 'ASK\n20.01', { size: this.fs(12), col: C.red, bold: true })
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline, 1)
    g.lineBetween(this.rungX, this.rung20Y, 440, this.rung20Y)
    g.lineBetween(this.rungX, this.rung2001Y, 440, this.rung2001Y)
  }

  private layoutTiles(animate: boolean): void {
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
        this.tiles.push(tile)
        if (animate) this.fadeIn(tile.container, this.dur(80) * this.tiles.length, 10)
      })
    }
    place(byPrice(20.0), this.rung20Y)
    place(byPrice(20.01), this.rung2001Y)
    this.updateServingOrder()
  }

  private makeTile(o: RestingOrder, x: number, y: number): Tile {
    const w = 112
    const h = 62
    const g = this.add.graphics()
    // Resting ask = the red sell side; a market BUY will lift these.
    g.fillStyle(C.redSoft, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8)
    g.lineStyle(2, C.red, 1)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8)
    const idT = this.add
      .text(0, -15, o.id, { fontFamily: FONT, fontSize: '16px', color: hex(C.redText), fontStyle: 'bold' })
      .setOrigin(0.5)
    const szT = this.add
      .text(0, 5, `${fmtShares(o.size)} sh`, { fontFamily: FONT, fontSize: '12px', color: hex(C.ink) })
      .setOrigin(0.5)
    const tT = this.add
      .text(0, 21, `ticket ${o.arrival}`, { fontFamily: FONT, fontSize: '11px', color: hex(C.blue) })
      .setOrigin(0.5)
    // "served #N" badge (amber = the active path) at the top-left corner.
    const badgeBg = this.add.circle(-w / 2 + 13, -h / 2 + 13, 11, C.amber).setStrokeStyle(2, C.white)
    const badge = this.add
      .text(-w / 2 + 13, -h / 2 + 13, '', { fontFamily: FONT, fontSize: '12px', color: hex(C.white), fontStyle: 'bold' })
      .setOrigin(0.5)
    const container = this.add.container(x, y, [g, idT, szT, tT, badgeBg, badge]).setSize(w, h)
    return { order: o, container, badge, filled: false }
  }

  private updateServingOrder(): void {
    // The deli rule, made visible: number the still-waiting tickets in serve order
    // (best price first, then earliest arrival). Re-runs on every swap.
    const seq = this.tiles
      .filter((t) => !t.filled)
      .sort((a, b) => a.order.price - b.order.price || a.order.arrival.localeCompare(b.order.arrival))
    seq.forEach((t, idx) => t.badge.setText(String(idx + 1)))
  }

  private drawLog(): void {
    this.panel(this.logX, this.logY - 24, 270, 210, { fill: C.gray100, stroke: C.hairline, radius: 8 })
    this.label(this.logX + 12, this.logY - 4, 'Fill log (time & sales)', { size: this.fs(12), col: C.muted, bold: true })
  }

  private addLog(text: string): void {
    if (this.logCount >= 6) return
    const y = this.logY + 22 + this.logCount * 24
    const t = this.label(this.logX + 16, y, text, { size: this.fs(12), col: C.greenText, bold: true }).setAlpha(0)
    this.tweens.add({ targets: t, alpha: 1, x: this.logX + 20, duration: this.dur(280) })
    if (this.reduceMotion) {
      t.setAlpha(1)
      t.x = this.logX + 20
    }
    this.logCount++
  }

  private buildControls(): void {
    this.label(this.W / 2, 330, `Incoming: MARKET BUY ${this.incoming}`, {
      size: this.fs(14),
      col: C.red,
      align: 'center',
      bold: true,
    })
    this.button(this.W / 2 - 110, 380, 'Swap A ↔ B ticket', () => this.swapAB(), { w: 180, fill: C.muted })
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
      this.layoutTiles(false)
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
        this.servingText.setText('done — all printed')
        return
      }
      const o = steps[i]
      this.servingText.setText(`${o.id}: ${fmtShares(o.size)} @ ${fmtPrice(o.price)}`)
      this.annihilate(o, () => {
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
    const c = tile.container

    if (this.reduceMotion) {
      this.addLog(`PRINT ${fmtShares(o.size)} @ ${fmtPrice(o.price)} (${o.id})`)
      c.destroy()
      this.shuffleForward(o.price)
      done()
      return
    }

    // green BUY-print flash: a market buy lifting the red ask is buy pressure.
    this.tweens.add({ targets: c, scale: 1.12, duration: this.dur(140), yoyo: true, ease: 'Quad.out' })
    const flash = this.add.circle(c.x, c.y, 40, C.greenLight, 0.6).setScale(0.4)
    this.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: this.dur(420), ease: 'Quad.out', onComplete: () => flash.destroy() })
    this.tweens.add({
      targets: c,
      alpha: 0,
      delay: this.dur(200),
      duration: this.dur(260),
      ease: 'Quad.out',
      onComplete: () => {
        c.destroy()
        this.shuffleForward(o.price)
      },
    })
    this.addLog(`PRINT ${fmtShares(o.size)} @ ${fmtPrice(o.price)} (${o.id})`)
    this.time.delayedCall(this.dur(480), done)
  }

  private shuffleForward(price: number): void {
    // remaining tickets at this price slide left to close the gap, then renumber.
    const remaining = this.tiles.filter((t) => !t.filled && t.order.price === price)
    remaining.sort((a, b) => a.order.arrival.localeCompare(b.order.arrival))
    const baseX = this.rungX + 30
    remaining.forEach((t, idx) => {
      const x = baseX + idx * 120
      if (this.reduceMotion) t.container.x = x
      else this.tweens.add({ targets: t.container, x, duration: this.dur(260), ease: 'Cubic.out' })
    })
    this.updateServingOrder()
  }
}
