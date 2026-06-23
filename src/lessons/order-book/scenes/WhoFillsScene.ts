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
  /** id of the order that fills first (ground truth, for the reveal animation). */
  winnerId?: string
}

const DEFAULT_RESTING: RestingOrder[] = [
  { id: 'X', price: 20.0, arrival: '9:30:01' },
  { id: 'Y', price: 20.0, arrival: '9:30:05' },
  { id: 'Z', price: 20.01, arrival: '9:30:02' },
]

/**
 * MODULE 8 — QUIZ "Who Gets Filled?". A small book (X/Y at 20.00, Z at 20.01) with
 * the fill hidden. A MARKET BUY 100 arrives. On reveal, the engine highlights the best
 * ask queue (20.00), lights the FRONT (earliest = X), annihilates it with a PRINT, and
 * dims the mis-picks with a grey "still resting" tag. Grading lives in the QuizSpec.
 */
export default class WhoFillsScene extends ModuleScene {
  private resting: RestingOrder[] = []
  private winnerId = 'X'
  private revealed = false
  private tiles = new Map<string, Phaser.GameObjects.Container>()

  private readonly rungX = 80
  private readonly rung20Y = 170
  private readonly rung2001Y = 280

  protected build(): void {
    this.resting = (this.params as WhoFillsParams).resting ?? DEFAULT_RESTING
    this.winnerId = (this.params as WhoFillsParams).winnerId ?? 'X'

    this.label(this.W / 2, 34, 'A MARKET BUY for 100 shares arrives — which resting order fills first?', {
      size: 14,
      col: C.muted,
      align: 'center',
    })

    // rung labels
    this.label(this.rungX - 50, this.rung20Y, 'ASK\n20.00', { size: 13, col: C.red, bold: true })
    this.label(this.rungX - 50, this.rung2001Y, 'ASK\n20.01', { size: 13, col: C.red, bold: true })
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline, 1)
    g.lineBetween(this.rungX, this.rung20Y, 600, this.rung20Y)
    g.lineBetween(this.rungX, this.rung2001Y, 600, this.rung2001Y)
    this.label(this.rungX + 8, this.rung20Y - 24, '◀ earlier arrival ........ later ▶', { size: 10, col: C.muted })

    const at20 = this.resting.filter((o) => o.price === 20.0).sort((a, b) => a.arrival.localeCompare(b.arrival))
    const at2001 = this.resting.filter((o) => o.price === 20.01)
    at20.forEach((o, i) => this.makeTile(o, this.rungX + 30 + i * 130, this.rung20Y))
    at2001.forEach((o, i) => this.makeTile(o, this.rungX + 30 + i * 130, this.rung2001Y))

    // masked "?" incoming
    this.label(this.W / 2, 360, 'MARKET BUY 100  →  first fill: ?', { size: 16, col: C.blue, align: 'center', bold: true })

    this.time.delayedCall(500, () => this.emitReady())
  }

  private makeTile(o: RestingOrder, x: number, y: number): void {
    const w = 116
    const h = 56
    const g = this.add.graphics()
    g.fillStyle(C.greenSoft, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8)
    g.lineStyle(2, C.green, 1)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8)
    g.setName('bg')
    const idT = this.add.text(0, -12, o.id, { fontFamily: '"Segoe UI", sans-serif', fontSize: '17px', color: hex(C.green), fontStyle: 'bold' }).setOrigin(0.5)
    const tT = this.add.text(0, 12, o.arrival, { fontFamily: '"Segoe UI", sans-serif', fontSize: '11px', color: hex(C.blue) }).setOrigin(0.5)
    const c = this.add.container(x, y, [g, idT, tT]).setSize(w, h)
    this.tiles.set(o.id, c)
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true

    // 1. highlight best ask queue (20.00 row)
    const lane = this.add.graphics()
    lane.fillStyle(C.blueSoft, 0.6)
    lane.fillRoundedRect(this.rungX, this.rung20Y - 36, 540, 72, 10)
    lane.setDepth(-1).setAlpha(0)
    this.tweens.add({ targets: lane, alpha: 1, duration: 300 })
    const note = this.label(this.rungX + 540, this.rung20Y - 30, 'best price first → 20.00', { size: 11, col: C.blue, bold: true, align: 'right' }).setAlpha(0)
    this.tweens.add({ targets: note, alpha: 1, duration: 300 })

    // 2. light the winner (front of 20.00 queue), then annihilate
    this.time.delayedCall(500, () => {
      const winner = this.tiles.get(this.winnerId)
      if (winner) {
        this.tweens.add({ targets: winner, scale: 1.1, duration: 200, yoyo: true })
        const flash = this.add.circle(winner.x, winner.y, 44, C.greenLight, 0.6).setScale(0.4)
        this.tweens.add({ targets: flash, scale: 1.5, alpha: 0, duration: 500, onComplete: () => flash.destroy() })
        this.time.delayedCall(300, () => {
          this.tweens.add({ targets: winner, alpha: 0.15, duration: 300 })
          this.label(winner.x, winner.y + 46, 'FILLED', { size: 12, col: C.green, align: 'center', bold: true })
        })
      }
      // 3. PRINT chip
      this.label(this.W / 2, 360, `PRINT 100 @ ${fmtPrice(20.0)}  →  ${this.winnerId} fills first`, {
        size: 16,
        col: C.green,
        align: 'center',
        bold: true,
      })
      // dim the others
      this.tiles.forEach((c, id) => {
        if (id === this.winnerId) return
        this.tweens.add({ targets: c, alpha: 0.55, duration: 300 })
        this.label(c.x, c.y + 40, 'still resting', { size: 10, col: C.muted, align: 'center' })
      })
    })
  }
}
