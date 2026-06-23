import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtPrice } from './book'

interface RestingOrder {
  id: string
  price: number
  arrival: string
}
interface WhoFillsParams {
  resting?: RestingOrder[]
}

const DEFAULT_RESTING: RestingOrder[] = [
  { id: 'X', price: 20.0, arrival: '9:30:01' },
  { id: 'Y', price: 20.0, arrival: '9:30:05' },
  { id: 'Z', price: 20.01, arrival: '9:30:02' },
]

/**
 * MODULE 8 — CHALLENGE "Who Gets Filled?". A small resting book (X/Y at 20.00, Z at
 * 20.01). A MARKET BUY 100 arrives. The learner CLICKS the order they think fills
 * first; the tile highlights as selected. On Submit the engine resolves price-time
 * priority — best (lowest) ask first, then earliest arrival — annihilates the true
 * winner with a PRINT, dims the rest, and grades the pick via report().
 *
 * The winner is COMPUTED here (single source of truth), not passed in: lowest price,
 * then lexicographically-earliest arrival.
 */
export default class WhoFillsScene extends ModuleScene {
  private resting: RestingOrder[] = []
  private winnerId = 'X'
  private selectedId: string | null = null
  private locked = false
  private tiles = new Map<string, Phaser.GameObjects.Container>()

  private readonly rungX = 80
  private readonly rung20Y = 160
  private readonly rung2001Y = 280

  protected build(): void {
    this.resting = (this.params as WhoFillsParams).resting ?? DEFAULT_RESTING
    this.winnerId = this.computeWinner()

    this.label(this.W / 2, 30, 'A MARKET BUY for 100 shares arrives — click the order that fills FIRST', {
      size: 14,
      col: C.muted,
      align: 'center',
    })

    // rung labels + lines
    this.label(this.rungX - 50, this.rung20Y, 'ASK\n20.00', { size: 13, col: C.red, bold: true })
    this.label(this.rungX - 50, this.rung2001Y, 'ASK\n20.01', { size: 13, col: C.red, bold: true })
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline, 1)
    g.lineBetween(this.rungX, this.rung20Y, 600, this.rung20Y)
    g.lineBetween(this.rungX, this.rung2001Y, 600, this.rung2001Y)
    this.label(this.rungX + 8, this.rung20Y - 26, '◀ earlier arrival ........ later ▶', { size: 10, col: C.muted })

    const at20 = this.resting.filter((o) => o.price === 20.0).sort((a, b) => a.arrival.localeCompare(b.arrival))
    const at2001 = this.resting
      .filter((o) => o.price === 20.01)
      .sort((a, b) => a.arrival.localeCompare(b.arrival))
    at20.forEach((o, i) => this.makeTile(o, this.rungX + 40 + i * 140, this.rung20Y))
    at2001.forEach((o, i) => this.makeTile(o, this.rungX + 40 + i * 140, this.rung2001Y))

    this.label(this.W / 2, 360, 'MARKET BUY 100  →  first fill: tap an order above', {
      size: 14,
      col: C.blue,
      align: 'center',
      bold: true,
    }).setName('verdict')

    this.setCanSubmit(true) // a default pick is set below so submit is always valid

    // sensible default: pre-select the first 20.00 tile so submit is never blocked
    if (at20[0]) this.select(at20[0].id)

    this.time.delayedCall(500, () => this.emitReady())
  }

  /** Engine rule, exact: best (lowest) price first, then earliest arrival. */
  private computeWinner(): string {
    const sorted = this.resting
      .slice()
      .sort((a, b) => a.price - b.price || a.arrival.localeCompare(b.arrival))
    return sorted[0]?.id ?? 'X'
  }

  private makeTile(o: RestingOrder, x: number, y: number): void {
    const w = 116
    const h = 56
    const g = this.add.graphics()
    g.setName('bg')
    const idT = this.add.text(0, -12, o.id, { fontFamily: '"Segoe UI", sans-serif', fontSize: '17px', color: hex(C.green), fontStyle: 'bold' }).setOrigin(0.5)
    const tT = this.add.text(0, 12, o.arrival, { fontFamily: '"Segoe UI", sans-serif', fontSize: '11px', color: hex(C.blue) }).setOrigin(0.5)
    const c = this.add.container(x, y, [g, idT, tT]).setSize(w, h)
    c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains)
    c.input!.cursor = 'pointer'
    c.on('pointerup', () => {
      if (this.locked) return
      this.select(o.id)
    })
    c.on('pointerover', () => {
      if (!this.locked && this.selectedId !== o.id) this.paintTile(o.id, false, true)
    })
    c.on('pointerout', () => {
      if (!this.locked && this.selectedId !== o.id) this.paintTile(o.id, false, false)
    })
    this.tiles.set(o.id, c)
    this.paintTile(o.id, false, false)
  }

  private paintTile(id: string, selected: boolean, hover: boolean): void {
    const c = this.tiles.get(id)
    if (!c) return
    const w = 116
    const h = 56
    const g = c.getByName('bg') as Phaser.GameObjects.Graphics
    g.clear()
    const fill = selected ? C.blueSoft : C.greenSoft
    g.fillStyle(fill, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8)
    g.lineStyle(selected ? 3 : hover ? 2.5 : 2, selected ? C.blue : C.green, 1)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8)
    const idT = c.list[1] as Phaser.GameObjects.Text
    idT.setColor(hex(selected ? C.blue : C.green))
  }

  private select(id: string): void {
    if (this.selectedId === id) return
    if (this.selectedId) this.paintTile(this.selectedId, false, false)
    this.selectedId = id
    this.paintTile(id, true, false)
    const verdict = this.children.getByName('verdict') as Phaser.GameObjects.Text
    verdict.setText(`MARKET BUY 100  →  you picked ${id}.  Press Run the match.`)
  }

  protected onSubmit(): void {
    if (this.locked || !this.selectedId) return
    this.locked = true
    this.setCanSubmit(false)
    const picked = this.selectedId
    const correct = picked === this.winnerId

    // 1. highlight best-ask queue (20.00 row)
    const lane = this.add.graphics()
    lane.fillStyle(C.blueSoft, 0.6)
    lane.fillRoundedRect(this.rungX, this.rung20Y - 36, 540, 72, 10)
    lane.setDepth(-1).setAlpha(0)
    this.tweens.add({ targets: lane, alpha: 1, duration: 300 })
    const note = this.label(this.rungX + 540, this.rung20Y - 30, 'best price first → 20.00', { size: 11, col: C.blue, bold: true, align: 'right' }).setAlpha(0)
    this.tweens.add({ targets: note, alpha: 1, duration: 300 })

    // 2. light the true winner, then annihilate
    this.time.delayedCall(450, () => {
      const winner = this.tiles.get(this.winnerId)
      if (winner) {
        this.tweens.add({ targets: winner, scale: 1.1, duration: 200, yoyo: true })
        const flash = this.add.circle(winner.x, winner.y, 44, C.greenLight, 0.6).setScale(0.4)
        this.tweens.add({ targets: flash, scale: 1.5, alpha: 0, duration: 500, onComplete: () => flash.destroy() })
        this.time.delayedCall(300, () => {
          this.tweens.add({ targets: winner, alpha: 0.2, duration: 300 })
          this.label(winner.x, winner.y + 46, 'FILLED', { size: 12, col: C.green, align: 'center', bold: true })
        })
      }
      // 3. dim the others + tag them
      this.tiles.forEach((c, id) => {
        if (id === this.winnerId) return
        this.tweens.add({ targets: c, alpha: 0.5, duration: 300 })
        this.label(c.x, c.y + 40, 'still resting', { size: 10, col: C.muted, align: 'center' })
      })
      // 4. mark the learner's pick if wrong
      if (!correct) {
        const pickTile = this.tiles.get(picked)
        if (pickTile) this.label(pickTile.x, pickTile.y - 42, 'your pick', { size: 11, col: C.red, align: 'center', bold: true })
      }
      const verdict = this.children.getByName('verdict') as Phaser.GameObjects.Text
      verdict.setText(`PRINT 100 @ ${fmtPrice(20.0)}  →  ${this.winnerId} fills first`)
      verdict.setColor(hex(C.green))

      this.reportResult(picked, correct)
    })
  }

  private reportResult(picked: string, correct: boolean): void {
    const winner = this.resting.find((o) => o.id === this.winnerId)!
    let title: string
    let detail: string
    if (correct) {
      title = `Correct — ${this.winnerId} fills first`
      detail = `The engine takes the best (lowest) ask first → ${fmtPrice(winner.price)}, and among the orders there it fills the earliest arrival (${winner.arrival}) → ${this.winnerId}. Price first, then time.`
    } else {
      const pick = this.resting.find((o) => o.id === picked)!
      const reason =
        pick.price > winner.price
          ? `${picked} rests at ${fmtPrice(pick.price)} — a worse price, and no share at ${fmtPrice(pick.price)} fills until every ${fmtPrice(winner.price)} share is gone.`
          : `${picked} is at the right price (${fmtPrice(pick.price)}) but arrived later (${pick.arrival}) than ${this.winnerId} (${winner.arrival}).`
      title = `Not quite — ${this.winnerId} fills first`
      detail = `${reason} The engine clears best price first, then earliest arrival.`
    }
    this.report(correct, title, detail)
  }
}
