import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtPrice } from './book'

interface QuoteCard {
  id: string
  bid: number
  ask: number
}
interface QuoteCardsParams {
  cards?: QuoteCard[]
}

const DEFAULT_CARDS: QuoteCard[] = [
  { id: 'A', bid: 50.1, ask: 50.14 },
  { id: 'B', bid: 50.2, ask: 50.18 },
  { id: 'C', bid: 50.0, ask: 50.3 },
]

/**
 * MODULE 3 — QUIZ "Spot the Spread". Three neutral quote cards show bid/ask but hide
 * the spread/mid/validity. On reveal (React emits it after Check) every card flips:
 * valid cards draw a blue spread caliper + MID marker; the crossed card (B) collapses
 * with a red "CROSSED — impossible" stamp. Grading lives in the QuizSpec (answer A).
 */
export default class QuoteCardsScene extends ModuleScene {
  private cards: QuoteCard[] = []
  private revealed = false
  private cardObjs: Array<{ card: QuoteCard; container: Phaser.GameObjects.Container; cx: number; cy: number }> = []

  protected build(): void {
    this.cards = (this.params as QuoteCardsParams).cards ?? DEFAULT_CARDS

    this.label(this.W / 2, 32, 'Each card shows a quote (bid / ask). Which is 4-cent AND valid?', {
      size: 14,
      col: C.muted,
      align: 'center',
    })

    const cw = 200
    const gapX = 30
    const totalW = this.cards.length * cw + (this.cards.length - 1) * gapX
    const startX = (this.W - totalW) / 2 + cw / 2
    const cy = 230

    this.cards.forEach((card, i) => {
      const cx = startX + i * (cw + gapX)
      const container = this.makeCard(card, cx, cy, cw)
      this.cardObjs.push({ card, container, cx, cy })
      this.fadeIn(container, 120 + i * 120)
    })

    this.label(this.W / 2, 420, 'Two checks: bid < ask? (valid) · ask − bid = ? (the spread)', {
      size: 12,
      col: C.muted,
      align: 'center',
    })

    this.time.delayedCall(600, () => this.emitReady())
  }

  private makeCard(card: QuoteCard, cx: number, cy: number, cw: number): Phaser.GameObjects.Container {
    const ch = 200
    const g = this.add.graphics()
    g.fillStyle(C.white, 1)
    g.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 12)
    g.lineStyle(2, C.hairline, 1)
    g.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 12)

    const id = this.add
      .text(0, -ch / 2 + 22, `Quote ${card.id}`, { fontFamily: '"Segoe UI", sans-serif', fontSize: '16px', color: hex(C.ink), fontStyle: 'bold' })
      .setOrigin(0.5)

    const askRow = this.add
      .text(0, -28, `ASK  ${fmtPrice(card.ask)}`, { fontFamily: '"Segoe UI", sans-serif', fontSize: '15px', color: hex(C.red), fontStyle: 'bold' })
      .setOrigin(0.5)
    const bidRow = this.add
      .text(0, 6, `BID  ${fmtPrice(card.bid)}`, { fontFamily: '"Segoe UI", sans-serif', fontSize: '15px', color: hex(C.green), fontStyle: 'bold' })
      .setOrigin(0.5)
    const reveal = this.add
      .text(0, 52, 'spread = ?   mid = ?', { fontFamily: '"Segoe UI", sans-serif', fontSize: '13px', color: hex(C.muted) })
      .setOrigin(0.5)
    reveal.setName('reveal')

    return this.add.container(cx, cy, [g, id, askRow, bidRow, reveal]).setSize(cw, ch)
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true
    this.cardObjs.forEach((o, i) => {
      this.time.delayedCall(i * 220, () => this.resolveCard(o))
    })
  }

  private resolveCard(o: { card: QuoteCard; container: Phaser.GameObjects.Container; cx: number; cy: number }): void {
    const { card, container } = o
    const valid = card.bid < card.ask
    const spread = card.ask - card.bid
    const mid = (card.ask + card.bid) / 2
    const reveal = container.getByName('reveal') as Phaser.GameObjects.Text

    // small flip
    this.tweens.add({ targets: container, scaleX: 0, duration: 140, yoyo: true, ease: 'Quad.in' })

    this.time.delayedCall(150, () => {
      if (!valid) {
        reveal.setText('CROSSED — impossible')
        reveal.setColor(hex(C.red))
        reveal.setFontStyle('bold')
        // collapse animation: shake + dim
        this.tweens.add({ targets: container, angle: -2, duration: 80, yoyo: true, repeat: 3 })
        this.tweens.add({ targets: container, alpha: 0.55, duration: 300 })
        const stamp = this.add
          .text(o.cx, o.cy, 'CROSSED', { fontFamily: '"Segoe UI", sans-serif', fontSize: '20px', color: hex(C.red), fontStyle: 'bold' })
          .setOrigin(0.5)
          .setAngle(-12)
          .setAlpha(0)
        this.tweens.add({ targets: stamp, alpha: 0.9, scale: { from: 1.6, to: 1 }, duration: 260 })
      } else {
        reveal.setText(`spread = ${fmtPrice(spread)}   mid = ${fmtPrice(mid)}`)
        reveal.setColor(hex(C.blue))
        reveal.setFontStyle('bold')
        // blue caliper down the side of the card
        const calX = o.cx + 84
        const g = this.add.graphics()
        g.lineStyle(2, C.blue, 1)
        g.lineBetween(calX, o.cy - 28, calX, o.cy + 6)
        g.lineBetween(calX - 6, o.cy - 28, calX + 6, o.cy - 28)
        g.lineBetween(calX - 6, o.cy + 6, calX + 6, o.cy + 6)
        g.setAlpha(0)
        this.tweens.add({ targets: g, alpha: 1, duration: 260 })
        const dot = this.add.circle(o.cx + 64, o.cy - 11, 5, C.blue).setStrokeStyle(2, C.white).setScale(0)
        this.tweens.add({ targets: dot, scale: 1, duration: 240, ease: 'Back.out' })
      }
    })
  }
}
