import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'

interface NetPnLParams {
  shares?: number // 100
  sell?: number // 50
  cover?: number // 44
  borrowPerShare?: number // 0.50
  divPerShare?: number // 0.20
}

/**
 * M4 QUIZ — "Did the Short Make Money?".
 * Masked NET figure; on reveal the gross bar draws to $600, a red borrow chip and a red
 * dividend chip subtract, and the bar lands on the true net ($530). Math is exact:
 * net = (sell − cover)·shares − borrow·shares − div·shares.
 */
export default class NetPnLQuizScene extends ModuleScene {
  private shares = 100
  private sell = 50
  private cover = 44
  private borrowPerShare = 0.5
  private divPerShare = 0.2

  private barX = 90
  private barTop = 110
  private barBottom = 320
  private barW = 64

  private bar!: Phaser.GameObjects.Graphics
  private barCap!: Phaser.GameObjects.Text
  private mask!: Phaser.GameObjects.Container
  private gross = 600
  private maxScale = 700

  protected build(): void {
    const p = this.params as NetPnLParams
    this.shares = p.shares ?? 100
    this.sell = p.sell ?? 50
    this.cover = p.cover ?? 44
    this.borrowPerShare = p.borrowPerShare ?? 0.5
    this.divPerShare = p.divPerShare ?? 0.2
    this.gross = (this.sell - this.cover) * this.shares

    this.label(this.W / 2, 26, 'What was your NET profit?', {
      size: 17,
      bold: true,
      col: C.ink,
      align: 'center',
    })
    this.label(this.W / 2, 48, 'illustrative simulation · math exact', {
      size: 11,
      col: C.muted,
      align: 'center',
    })

    // Setup facts panel
    this.panel(420, 80, 300, 250, { fill: C.gray100, stroke: C.hairline, radius: 10 })
    const facts = [
      `Short ${this.shares} shares @ $${this.sell.toFixed(0)}`,
      `Cover @ $${this.cover.toFixed(0)}`,
      `Gross = (${this.sell} − ${this.cover}) × ${this.shares} = $${this.gross}`,
      `Borrow cost = $${this.borrowPerShare.toFixed(2)}/sh × ${this.shares} = $${(this.borrowPerShare * this.shares).toFixed(0)}`,
      `Dividend owed = $${this.divPerShare.toFixed(2)}/sh × ${this.shares} = $${(this.divPerShare * this.shares).toFixed(0)}`,
    ]
    facts.forEach((f, i) => this.label(436, 104 + i * 30, f, { size: 13, col: C.ink }))
    this.label(436, 104 + facts.length * 30 + 4, 'NET = gross − borrow − dividend = ?', {
      size: 13,
      bold: true,
      col: C.blue,
    })

    // Axis baseline for the bar
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline)
    g.lineBetween(this.barX - 20, this.barBottom, this.barX + 220, this.barBottom)
    this.label(this.barX - 24, this.barBottom + 4, '$0', { size: 11, col: C.muted })

    this.bar = this.add.graphics()
    this.barCap = this.label(this.barX + this.barW / 2, this.barBottom - 8, '', {
      size: 14,
      bold: true,
      col: C.green,
      align: 'center',
    })

    // Mask hides the net figure until reveal.
    this.drawMask()
    this.emitReady()
  }

  private yForValue(v: number): number {
    const t = Math.max(0, Math.min(1, v / this.maxScale))
    return this.barBottom - t * (this.barBottom - this.barTop)
  }

  private drawBar(value: number, colHex: number): void {
    const yTop = this.yForValue(value)
    this.bar.clear()
    this.bar.fillStyle(colHex, 0.85)
    this.bar.fillRoundedRect(this.barX, yTop, this.barW, this.barBottom - yTop, 4)
    this.barCap.setY(yTop - 12)
    this.barCap.setText(`$${value.toFixed(0)}`)
    this.barCap.setColor(hex(colHex))
  }

  private drawMask(): void {
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 0.95)
    g.fillRoundedRect(this.barX - 10, this.barTop - 20, this.barW + 24, this.barBottom - this.barTop + 24, 8)
    g.lineStyle(2, C.blue, 0.6)
    g.strokeRoundedRect(this.barX - 10, this.barTop - 20, this.barW + 24, this.barBottom - this.barTop + 24, 8)
    const q = this.label(this.barX + this.barW / 2, (this.barTop + this.barBottom) / 2, '?', {
      size: 48,
      bold: true,
      col: C.blue,
      align: 'center',
    })
    q.setAlpha(0.5)
    this.mask = this.add.container(0, 0, [g, q])
  }

  protected onReveal(): void {
    // Tween mask away
    this.tweens.add({
      targets: this.mask,
      alpha: 0,
      y: -30,
      duration: 360,
      ease: 'Cubic.inOut',
      onComplete: () => this.mask.destroy(),
    })

    const borrow = this.borrowPerShare * this.shares
    const dividend = this.divPerShare * this.shares
    const net = this.gross - borrow - dividend

    // 1) draw to gross
    this.time.delayedCall(280, () => {
      this.tweenBar(this.gross, C.green, () => {
        // 2) borrow chip
        this.chip(`Borrow −$${borrow.toFixed(0)}`, 380)
        this.time.delayedCall(520, () => {
          this.tweenBar(this.gross - borrow, C.green, () => {
            // 3) dividend chip
            this.chip(`Dividend −$${dividend.toFixed(0)}`, 410)
            this.time.delayedCall(520, () => {
              this.tweenBar(net, C.green)
            })
          })
        })
      })
    })
  }

  private tweenBar(target: number, colHex: number, done?: () => void): void {
    const start = Number(this.barCap.text.replace(/[^0-9.-]/g, '')) || 0
    const obj = { v: start }
    this.tweens.add({
      targets: obj,
      v: target,
      duration: 480,
      ease: 'Cubic.out',
      onUpdate: () => this.drawBar(obj.v, colHex),
      onComplete: () => done?.(),
    })
  }

  private chip(text: string, y: number): void {
    const w = 150
    const x = this.barX + this.barW + 30
    const panel = this.panel(x, y - 14, w, 28, { fill: C.redSoft, stroke: C.red, radius: 8 })
    const t = this.label(x + w / 2, y, text, { size: 13, bold: true, col: C.red, align: 'center' })
    panel.x = -40
    t.x -= 40
    panel.alpha = 0
    t.alpha = 0
    this.tweens.add({ targets: [panel, t], alpha: 1, x: `+=40`, duration: 360, ease: 'Cubic.out' })
  }
}
