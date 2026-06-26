import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, color } from '../../../engine/palette'

interface IntroFlipParams {
  /** Reference sell/entry price. Default $50. */
  entry?: number
  /** Slider range for the future price. Default 0..100. */
  min?: number
  max?: number
}

/**
 * M1 INTRO/INTERACTIVE — "Betting Against a Stock".
 * A "Buy low, sell high" arrow flips to "Sell high, buy low", then the learner drags
 * a future-price slider: drag DOWN → green profit needle rises; drag UP → red loss
 * needle with no floor. A toggle mirrors a LONG position so the two move in opposition.
 * Illustrative simulation; math (P&L/sh = entry − price) is exact.
 */
export default class IntroFlipScene extends ModuleScene {
  private entry = 50
  private min = 0
  private max = 100
  private future = 50
  private showLong = false

  // Meter geometry
  private meterX = 600
  private meterY = 150
  private meterW = 70
  private meterH = 230

  private fill!: Phaser.GameObjects.Graphics
  private readoutText!: Phaser.GameObjects.Text
  private pnlText!: Phaser.GameObjects.Text
  private capLabel!: Phaser.GameObjects.Text
  private capChip!: Phaser.GameObjects.Graphics

  protected build(): void {
    const p = this.params as IntroFlipParams
    this.entry = p.entry ?? 50
    this.min = p.min ?? 0
    this.max = p.max ?? 100
    this.future = this.entry

    // --- Flipping maxim arrow (top band) ---
    const arrow = this.add.graphics()
    arrow.fillStyle(C.green, 1)
    // a right-pointing arrow shape centred at origin
    arrow.fillRect(-70, -5, 110, 10)
    arrow.fillTriangle(40, -16, 40, 16, 66, 0)
    const arrowC = this.add.container(170, 56, [arrow])
    arrowC.setScale(0)
    this.tweens.add({ targets: arrowC, scale: 1, duration: 480, ease: 'Cubic.out' })

    const maxim = this.label(170, 90, 'Buy low, sell high', {
      size: 17,
      bold: true,
      col: C.green,
      align: 'center',
    })
    this.fadeIn(maxim, 300)

    // Flip the arrow 180° and rewrite the maxim.
    this.time.delayedCall(1100, () => {
      this.tweens.add({
        targets: arrowC,
        angle: 180,
        duration: 620,
        ease: 'Cubic.inOut',
      })
      this.tweens.add({
        targets: maxim,
        alpha: 0,
        duration: 240,
        onComplete: () => {
          maxim.setText('Sell high, buy low')
          maxim.setColor(hex(C.red))
          this.tweens.add({ targets: maxim, alpha: 1, duration: 300 })
        },
      })
    })

    // --- Profit meter on the right ---
    this.label(this.meterX + this.meterW / 2, this.meterY - 18, 'Profit', {
      size: 13,
      bold: true,
      col: C.muted,
      align: 'center',
    })
    const frame = this.add.graphics()
    frame.lineStyle(1.5, C.hairline)
    frame.strokeRoundedRect(this.meterX, this.meterY, this.meterW, this.meterH, 8)
    // zero line in the middle
    const midY = this.meterY + this.meterH / 2
    this.dashedLine(this.meterX - 6, midY, this.meterX + this.meterW + 6, C.muted, 5, 4, 1)
    this.label(this.meterX + this.meterW + 10, midY, '$0', { size: 12, col: C.muted })
    this.fill = this.add.graphics()

    // --- Price line (stylised, falling) drawn under the maxim ---
    this.drawPriceLine()

    // --- Caption strip ---
    const cap = this.label(this.W / 2, 416, 'A short seller wins when the price goes DOWN.', {
      size: 13,
      bold: true,
      col: C.blue,
      align: 'center',
    })
    this.fadeIn(cap, 1600)

    // --- Readouts (sit above the control, clearly spaced) ---
    this.readoutText = this.label(60, 240, '', { size: 13, col: C.ink })
    this.pnlText = this.label(60, 264, '', { size: 16, bold: true, col: C.green })

    // --- Slider: future price ---
    this.label(60, 304, 'Future price', { size: 13, col: C.ink, bold: true })
    this.slider(60, 326, 300, this.min, this.max, this.future, (v) => {
      this.future = v
      this.refresh()
    }, { step: 1, col: C.blue })

    // --- Toggle: show a LONG instead ---
    this.button(
      150,
      370,
      'Show a LONG instead',
      () => {
        this.showLong = !this.showLong
        this.refresh()
      },
      { w: 200, h: 32, fill: C.blueSoft, textCol: C.blue },
    )

    // Ceiling label sits at the top of the meter (chip keeps it readable over the fill).
    this.capLabel = this.label(this.meterX + this.meterW / 2, this.meterY + 16, '', {
      size: 12,
      bold: true,
      col: C.green,
      align: 'center',
    })
    this.capLabel.setAlpha(0)
    this.capChip = this.add.graphics()
    this.capChip.setAlpha(0)
    this.children.moveBelow(this.capChip, this.capLabel)

    this.refresh()
    this.time.delayedCall(1800, () => this.emitReady())
  }

  private drawPriceLine(): void {
    const g = this.add.graphics()
    g.lineStyle(2, C.red, 0.85)
    const x0 = 60
    const x1 = 360
    const y0 = 140
    const y1 = 210
    const n = 30
    let prevX = x0
    let prevY = y0
    for (let i = 1; i <= n; i++) {
      const t = i / n
      // downward trend with slight jitter (deterministic)
      const jitter = Math.sin(i * 1.7) * 6
      const x = x0 + t * (x1 - x0)
      const y = y0 + t * (y1 - y0) + jitter
      g.lineBetween(prevX, prevY, x, y)
      prevX = x
      prevY = y
    }
    g.alpha = 0
    this.tweens.add({ targets: g, alpha: 1, duration: 600, delay: 1200 })
  }

  /** Short P&L per share at the current future price. */
  private shortPnL(): number {
    return this.entry - this.future
  }

  private refresh(): void {
    const isLong = this.showLong
    // Long P&L = price − entry ; Short P&L = entry − price
    const pnl = isLong ? this.future - this.entry : this.shortPnL()
    const profit = pnl >= 0
    const colName = profit ? C.green : C.red

    // Meter fill: bottom-up for profit (above mid), top-down for loss (below mid).
    const midY = this.meterY + this.meterH / 2
    const half = this.meterH / 2
    // Scale: full half-height represents the +/-100% (= ±entry per share) bound.
    const frac = Math.max(-1.6, Math.min(1, pnl / this.entry))
    this.fill.clear()
    this.fill.fillStyle(colName, 0.85)
    if (frac >= 0) {
      const h = frac * half
      this.fill.fillRoundedRect(this.meterX + 4, midY - h, this.meterW - 8, h, 4)
    } else {
      // loss grows downward, can overflow past the frame bottom (no floor)
      const h = Math.abs(frac) * half
      this.fill.fillRoundedRect(this.meterX + 4, midY, this.meterW - 8, h, 4)
    }

    // Ceiling label only meaningful for the short at +100%.
    if (!isLong && this.future <= this.min) {
      this.capLabel.setText('+100%\n(can\'t go below $0)')
      this.capLabel.setAlpha(1)
      // chip behind the multi-line label so it stays readable over the meter fill
      const padX = 6
      const padY = 3
      this.capChip.clear()
      this.capChip.fillStyle(C.white, 0.9)
      this.capChip.fillRoundedRect(
        this.capLabel.x - this.capLabel.width / 2 - padX,
        this.capLabel.y - this.capLabel.height / 2 - padY,
        this.capLabel.width + padX * 2,
        this.capLabel.height + padY * 2,
        5,
      )
      this.capChip.setAlpha(1)
    } else {
      this.capLabel.setAlpha(0)
      this.capChip.setAlpha(0)
    }

    // Readouts
    const side = isLong ? 'Long' : 'Short'
    this.readoutText.setText(`Entry $${this.entry.toFixed(0)}  ·  Price now $${this.future.toFixed(0)}`)
    const sign = pnl >= 0 ? '+' : '−'
    // For a SHORT at a loss, foreshadow the unbounded downside (M5).
    const noCeil = !isLong && pnl < 0 ? '  ·  loss has no limit' : ''
    this.pnlText.setText(`${side} profit: ${sign}$${Math.abs(pnl).toFixed(2)}/sh${noCeil}`)
    this.pnlText.setColor(hex(color(colName)))
  }
}
