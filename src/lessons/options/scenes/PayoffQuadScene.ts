import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C } from '../../../engine/palette'
import { pnlPerShare, maxLoss, type OptType, type Side } from './optionMath'

interface QuadParams {
  K?: number
  premium?: number
  sMin?: number
  sMax?: number
}

interface Cell {
  type: OptType
  side: Side
  title: string
  x: number
  y: number
  w: number
  h: number
  fog: Phaser.GameObjects.Graphics
}

/**
 * PayoffQuadScene (module 11 quiz) — four mini payoff thumbnails (long/short ×
 * call/put) with their LOSS tails fogged. On reveal the fog lifts: the short call's
 * tail runs off-screen ("loss → ∞"), the others show bounded floors.
 */
export default class PayoffQuadScene extends ModuleScene {
  private p!: Required<QuadParams>
  private cells: Cell[] = []
  private revealed = false

  protected build(): void {
    const raw = this.params as QuadParams
    this.p = {
      K: raw.K ?? 100,
      premium: raw.premium ?? 5,
      sMin: raw.sMin ?? 60,
      sMax: raw.sMax ?? 140,
    }
    this.label(40, 22, 'Which single-leg position has UNLIMITED loss?', { size: 16, col: C.ink, bold: true })
    this.label(40, 44, 'loss tails are fogged — submit to reveal', { size: 13, col: C.muted })

    const defs: Array<{ type: OptType; side: Side; title: string }> = [
      { type: 'call', side: 'long', title: 'Long call' },
      { type: 'put', side: 'long', title: 'Long put' },
      { type: 'call', side: 'short', title: 'Short call' },
      { type: 'put', side: 'short', title: 'Short put' },
    ]
    const w = 300
    const h = 150
    const gx = 40
    const gy = 70
    const padX = 40
    const padY = 30
    defs.forEach((d, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = gx + col * (w + padX)
      const y = gy + row * (h + padY)
      this.drawCell(d.type, d.side, d.title, x, y, w, h)
    })
    this.emitReady()
  }

  private valToY(v: number, y: number, h: number, span: number): number {
    const mid = y + h / 2
    return mid - (v / span) * (h / 2 - 12)
  }

  private drawCell(type: OptType, side: Side, title: string, x: number, y: number, w: number, h: number): void {
    const pos = { type, side, K: this.p.K, premium: this.p.premium }
    this.panel(x, y, w, h, { fill: C.white, stroke: C.hairline, radius: 10 })
    this.label(x + 10, y + 14, title, { size: 14, col: C.ink, bold: true })

    const plotL = x + 12
    const plotR = x + w - 12
    const span = 14 // value units mapped to half-height
    const y0 = y + h / 2
    const g0 = this.add.graphics()
    g0.lineStyle(1, C.gray200)
    g0.lineBetween(plotL, y0, plotR, y0)
    // strike marker
    const xk = plotL + ((this.p.K - this.p.sMin) / (this.p.sMax - this.p.sMin)) * (plotR - plotL)
    g0.lineStyle(1, C.blue, 0.5)
    g0.lineBetween(xk, y + 24, xk, y + h - 8)

    // payoff line (green above zero, red below)
    const g = this.add.graphics()
    let prevX = plotL
    let prevY = this.valToY(pnlPerShare(pos, this.p.sMin), y, h, span)
    for (let i = 1; i <= 40; i++) {
      const S = this.p.sMin + ((this.p.sMax - this.p.sMin) * i) / 40
      const v = pnlPerShare(pos, S)
      const px = plotL + ((S - this.p.sMin) / (this.p.sMax - this.p.sMin)) * (plotR - plotL)
      const py = this.valToY(v, y, h, span)
      g.lineStyle(2.5, v >= 0 ? C.green : C.red)
      g.lineBetween(prevX, prevY, px, py)
      prevX = px
      prevY = py
    }

    // fog over the loss region (bottom half)
    const fog = this.add.graphics()
    fog.fillStyle(C.blueSoft, 0.92)
    fog.fillRect(plotL, y0, plotR - plotL, h / 2 - 6)
    fog.lineStyle(1, C.blue, 0.4)
    fog.strokeRect(plotL, y0, plotR - plotL, h / 2 - 6)
    this.label(x + w / 2, y0 + h / 4 - 4, 'loss ?', {
      size: 14,
      col: C.blue,
      bold: true,
      align: 'center',
    }).setData('fogTxt', fog)

    this.cells.push({ type, side, title, x, y, w, h, fog })
  }

  protected onReveal(): void {
    if (this.revealed) return
    this.revealed = true
    // remove fog text + lift fog
    this.children.list.filter((o) => o.getData?.('fogTxt')).forEach((o) => o.destroy())
    this.cells.forEach((cell, i) => {
      this.time.delayedCall(120 * i, () => {
        this.tweens.add({ targets: cell.fog, alpha: 0, duration: 400, onComplete: () => cell.fog.destroy() })
        const pos = { type: cell.type, side: cell.side, K: this.p.K, premium: this.p.premium }
        const ml = maxLoss(pos)
        const unlimited = ml === Infinity
        const tag = unlimited ? '⚠ loss → ∞' : `max loss $${ml.toLocaleString()}`
        const t = this.label(cell.x + cell.w / 2, cell.y + cell.h - 14, tag, {
          size: 13,
          col: unlimited ? C.red : C.green,
          bold: true,
          align: 'center',
          bg: true,
        })
        t.setAlpha(0)
        this.tweens.add({ targets: t, alpha: 1, duration: 300, delay: 200 })
        if (unlimited) {
          // arrow running off the bottom edge
          const g = this.add.graphics()
          g.lineStyle(2.5, C.red)
          g.lineBetween(cell.x + cell.w - 30, cell.y + cell.h / 2, cell.x + cell.w - 6, cell.y + cell.h - 2)
        }
      })
    })
  }
}
