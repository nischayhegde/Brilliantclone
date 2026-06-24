import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, FONT, hex } from '../../../engine/palette'
import { fmtPrice, fmtShares, type Level } from './book'

interface IntroParams {
  asks?: Level[]
  bids?: Level[]
}

const DEFAULT_ASKS: Level[] = [
  { price: 100.04, size: 700 },
  { price: 100.03, size: 500 },
  { price: 100.02, size: 400 },
]
const DEFAULT_BIDS: Level[] = [
  { price: 100.01, size: 600 },
  { price: 100.0, size: 900 },
  { price: 99.99, size: 800 },
]

/**
 * MODULE 1 — INTERACTIVE cold-open. A big "Buy" button dissolves into a two-sided
 * ladder: red asks descend from the top, green bids rise from the bottom, leaving a
 * glowing blue spread gap. Tapping a rung flips its label to reveal "bid (buyer)" or
 * "ask (seller)". Continue enables once both sides are discovered (the scene drives
 * the gating purely visually — no pass/fail).
 */
export default class OrderBookIntroScene extends ModuleScene {
  private asks: Level[] = []
  private bids: Level[] = []
  private foundBid = false
  private foundAsk = false
  private counter?: Phaser.GameObjects.Text
  private hint?: Phaser.GameObjects.Text
  private maxSize = 1
  private readonly rowHalf = 14

  protected build(): void {
    const p = this.params as IntroParams
    // asks: worst (highest) first so the ladder reads top→bottom with the BEST (lowest)
    // ask hugging the spread gap; bids: best (highest) first, sitting just below the gap.
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => b.price - a.price)
    this.bids = (p.bids ?? DEFAULT_BIDS).slice().sort((a, b) => b.price - a.price)
    this.maxSize = Math.max(...this.asks.map((l) => l.size), ...this.bids.map((l) => l.size))

    this.simLabel()
    this.showBuyButton()
  }

  private simLabel(): void {
    this.label(this.W - 12, this.H - 14, 'Simulated depth — illustrating the matching mechanic', {
      size: 11,
      col: C.blue,
      align: 'right',
    }).setAlpha(0.8)
  }

  private showBuyButton(): void {
    const cx = this.W / 2
    const cy = this.H / 2 - 10
    const g = this.add.graphics()
    g.fillStyle(C.green, 1)
    g.fillRoundedRect(-110, -34, 220, 68, 14)
    const t = this.add
      .text(0, 0, 'Buy', { fontFamily: FONT, fontSize: '28px', color: hex(C.white), fontStyle: 'bold' })
      .setOrigin(0.5)
    const btn = this.add.container(cx, cy, [g, t]).setSize(220, 68)
    btn.setInteractive({ useHandCursor: true })

    const sub = this.label(cx, cy + 60, 'Press Buy — where does your order go?', { size: 14, col: C.muted, align: 'center' })

    // Gentle amber pulse to invite the press (amber = the brand's "active path").
    const pulse = this.add.circle(cx, cy, 130, C.amberSoft).setScale(0.6)
    pulse.setDepth(-1)
    pulse.setAlpha(this.reduceMotion ? 0.5 : 0)
    this.loop({ targets: pulse, alpha: 0.6, scale: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    btn.once('pointerup', () => {
      pulse.destroy()
      sub.destroy()
      this.tweens.add({
        targets: btn,
        scale: 1.25,
        alpha: 0,
        duration: 400,
        ease: 'Cubic.out',
        onComplete: () => {
          btn.destroy()
          this.explodeIntoLadder()
        },
      })
      // burst particles
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2
        const dot = this.add.circle(cx, cy, 4, i % 2 ? C.green : C.red)
        this.tweens.add({
          targets: dot,
          x: cx + Math.cos(ang) * 120,
          y: cy + Math.sin(ang) * 80,
          alpha: 0,
          duration: 460,
          ease: 'Cubic.out',
          onComplete: () => dot.destroy(),
        })
      }
    })
  }

  private rungGeom() {
    const cx = this.W / 2
    const rowH = 30
    const gap = 34 // spread gap
    const askTop = 78
    const maxBarW = 240
    return { cx, rowH, gap, askTop, maxBarW }
  }

  private explodeIntoLadder(): void {
    const { cx, rowH, gap, askTop, maxBarW } = this.rungGeom()
    const midY = askTop + this.asks.length * rowH + gap / 2

    // asks sorted worst (highest) first → draw top→bottom; best (lowest) ask lands
    // on the row just above the spread gap, mirroring the bids below it.
    this.asks.forEach((lvl, i) => {
      const targetY = askTop + i * rowH + rowH / 2
      this.makeRung(lvl, 'ask', cx, targetY, maxBarW, -160, i * 80)
    })
    // bids: index 0 is best bid (closest to gap)
    this.bids.forEach((lvl, i) => {
      const targetY = midY + gap / 2 + i * rowH + rowH / 2
      this.makeRung(lvl, 'bid', cx, targetY, maxBarW, 200, i * 80)
    })

    // spread gap glow
    this.time.delayedCall(700, () => this.drawSpreadGap(cx, midY, maxBarW))

    // counter + hint
    this.counter = this.label(cx, 50, 'Sides discovered: bid ☐  ·  ask ☐', { size: 14, col: C.ink, align: 'center', bold: true })
    this.counter.setAlpha(0)
    this.hint = this.label(cx, this.H - 40, 'Tap any rung to reveal who is resting there', { size: 13, col: C.muted, align: 'center' })
    this.hint.setAlpha(0)
    this.time.delayedCall(900, () => {
      this.fadeIn(this.counter!)
      this.fadeIn(this.hint!)
    })
  }

  private makeRung(lvl: Level, side: 'ask' | 'bid', cx: number, targetY: number, maxBarW: number, fromDx: number, delay: number): void {
    const col = side === 'ask' ? C.red : C.green
    const soft = side === 'ask' ? C.redSoft : C.greenSoft
    const barW = 36 + (lvl.size / this.maxSize) * (maxBarW - 36)

    const bar = this.add.graphics()
    bar.fillStyle(soft, 1)
    bar.fillRoundedRect(-barW / 2, -this.rowHalf, barW, this.rowHalf * 2, 6)
    bar.lineStyle(2, col, 1)
    bar.strokeRoundedRect(-barW / 2, -this.rowHalf, barW, this.rowHalf * 2, 6)

    const priceT = this.add
      .text(-barW / 2 + 8, 0, fmtPrice(lvl.price), { fontFamily: FONT, fontSize: '13px', color: hex(col), fontStyle: 'bold' })
      .setOrigin(0, 0.5)
    const sizeT = this.add
      .text(barW / 2 - 8, 0, fmtShares(lvl.size), { fontFamily: FONT, fontSize: '12px', color: hex(C.muted) })
      .setOrigin(1, 0.5)

    const container = this.add.container(cx + fromDx, targetY, [bar, priceT, sizeT]).setSize(barW, this.rowHalf * 2)
    container.setAlpha(0)
    container.setInteractive(new Phaser.Geom.Rectangle(-barW / 2, -this.rowHalf, barW, this.rowHalf * 2), Phaser.Geom.Rectangle.Contains)
    container.input!.cursor = 'pointer'

    this.tweens.add({ targets: container, x: cx, alpha: 1, duration: 520, delay: 420 + delay, ease: 'Quint.out' })

    let revealed = false
    const shimmer = this.loop({ targets: bar, alpha: 0.6, duration: 1100, yoyo: true, repeat: -1, delay: 1200 + delay, ease: 'Sine.inOut' })

    container.on('pointerup', () => {
      if (revealed) return
      revealed = true
      shimmer?.stop()
      bar.alpha = 1
      sizeT.setText(side === 'ask' ? 'ask (seller)' : 'bid (buyer)')
      sizeT.setColor(hex(col))
      sizeT.setFontStyle('bold')
      this.tweens.add({ targets: container, scale: 1.06, duration: 160, yoyo: true, ease: 'Quad.out' })
      if (side === 'ask') this.foundAsk = true
      else this.foundBid = true
      this.updateCounter()
    })
  }

  private drawSpreadGap(cx: number, midY: number, maxBarW: number): void {
    const w = maxBarW + 20
    const h = 30
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 1)
    g.fillRoundedRect(cx - w / 2, midY - h / 2, w, h, 8)
    g.lineStyle(1.5, C.blue, 0.8)
    g.strokeRoundedRect(cx - w / 2, midY - h / 2, w, h, 8)
    const lbl = this.add
      .text(cx, midY, 'the spread', { fontFamily: FONT, fontSize: '13px', color: hex(C.blue), fontStyle: 'bold' })
      .setOrigin(0.5)
    g.setAlpha(0)
    lbl.setAlpha(0)
    this.tweens.add({ targets: [g, lbl], alpha: 1, duration: 400 })
    this.loop({ targets: g, alpha: 0.65, duration: 1200, yoyo: true, repeat: -1, delay: 600, ease: 'Sine.inOut' })

    // tappable gap
    const hit = this.add.rectangle(cx, midY, w, h, 0x000000, 0).setInteractive({ useHandCursor: true })
    let tapped = false
    hit.on('pointerup', () => {
      if (tapped) return
      tapped = true
      lbl.setText('the spread — nobody is here yet')
    })
  }

  private updateCounter(): void {
    if (!this.counter) return
    this.counter.setText(`Sides discovered: bid ${this.foundBid ? '✓' : '☐'}  ·  ask ${this.foundAsk ? '✓' : '☐'}`)
    if (this.foundBid && this.foundAsk) {
      this.counter.setColor(hex(C.green))
      if (this.hint) this.hint.setText('Both sides found — your Buy met a seller across the spread. Continue ▸')
      this.emitReady()
    }
  }
}
