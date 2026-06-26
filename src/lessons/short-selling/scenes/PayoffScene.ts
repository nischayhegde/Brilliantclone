import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, color } from '../../../engine/palette'

interface PayoffParams {
  /** Entry/breakeven price. Default $30. */
  entry?: number
  /** X-axis max future price. Default $120. */
  priceMax?: number
  /** Shares for $-readout. Default 100. */
  shares?: number
  /**
   * 'teach' (M5): both lines draw in sequenced, draggable future price.
   * 'quiz'  (M6): only an interactive scrub; lines/tails hidden until onReveal.
   */
  mode?: 'teach' | 'quiz'
  /** Quiz reveal future price (where the stock ended). Default = priceMax. */
  revealPrice?: number
}

/**
 * M5 TEACH / M6 QUIZ-reveal — "The Asymmetry" payoff diagram.
 * Short payoff (red): flattens to a +100% ceiling as price → 0, dives without bound as
 * price rises. Long payoff (green): mirrored, floored at −100%, rising without limit.
 * Math exact: shortPct = (entry − price)/entry ; longPct = (price − entry)/entry.
 */
export default class PayoffScene extends ModuleScene {
  private entry = 30
  private priceMax = 120
  private shares = 100
  private mode: 'teach' | 'quiz' = 'teach'
  private revealPrice = 120

  // Plot box
  private plot = { l: 70, r: 560, t: 60, b: 320 }
  private showLong = true

  private cursorX = 0
  private cursor!: Phaser.GameObjects.Container
  private readoutShort!: Phaser.GameObjects.Text
  private readoutLong!: Phaser.GameObjects.Text
  private priceReadout!: Phaser.GameObjects.Text

  // "Bet against a balloon" metaphor (right column). Drag price DOWN and it deflates
  // to empty — your gain caps at +100%. Drag price UP and it inflates without limit —
  // your loss inflates right along with it. Same asymmetry as the payoff lines, felt.
  private balloon!: Phaser.GameObjects.Container
  private balloonBody!: Phaser.GameObjects.Graphics
  private balloonCY = 178

  protected build(): void {
    const p = this.params as PayoffParams
    this.entry = p.entry ?? 30
    this.priceMax = p.priceMax ?? 120
    this.shares = p.shares ?? 100
    this.mode = p.mode ?? 'teach'
    this.revealPrice = p.revealPrice ?? this.priceMax
    this.cursorX = this.entry

    // Integrity tag in the top-left corner, clear of the diagonal payoff lines that
    // exit the top of the plot near centre/right.
    this.label(12, 14, 'Illustrative simulation · payoff math exact', {
      size: 12,
      col: C.muted,
      align: 'left',
    })

    this.drawAxes()

    // Right-side legend / readouts
    this.label(584, 58, 'Future price', { size: 12, bold: true, col: C.ink })
    this.priceReadout = this.label(584, 80, '', { size: 18, bold: true, col: C.blue })

    // The balloon you're betting against sits between two fixed truths: it can inflate
    // forever (loss has no cap) but only deflate to empty (gain caps at +100%).
    this.buildBalloon()

    // Below the balloon so the readouts never collide with it or the right-edge "0%".
    this.readoutShort = this.label(584, 286, '', { size: 13, bold: true, col: C.red })
    this.readoutLong = this.label(584, 310, '', { size: 13, bold: true, col: C.green })

    if (this.mode === 'teach') {
      // Sequenced draw-in of both lines + callouts, then interactive cursor.
      this.time.delayedCall(200, () => this.drawShortLine())
      this.time.delayedCall(900, () => this.drawLongLine())
      this.time.delayedCall(1500, () => {
        this.drawCeilingArrows()
        this.enableInteractive()
        this.emitReady()
      })
    } else {
      // Quiz: only the cursor + masked panel until reveal.
      this.enableInteractive()
      this.emitReady()
    }

    // Toggle long overlay (teach only shows it by default; toggle hides for focus)
    this.button(150, 408, 'Show / hide LONG', () => {
      this.showLong = !this.showLong
      this.longLine?.setVisible(this.showLong)
      this.refreshReadout()
    }, { w: 200, h: 30, fill: C.blueSoft, textCol: C.blue })
  }

  // --- coordinate maps ---
  private xForPrice(price: number): number {
    const t = Math.max(0, Math.min(1, price / this.priceMax))
    return this.plot.l + t * (this.plot.r - this.plot.l)
  }
  /** P&L percent → y. Visible band is +120%..−320% so the unbounded tail shows. */
  private yForPct(pct: number): number {
    const top = 1.2 // +120%
    const bottom = -3.2 // −320%
    const t = (pct - bottom) / (top - bottom)
    return this.plot.b - t * (this.plot.b - this.plot.t)
  }

  private shortPct(price: number): number {
    return (this.entry - price) / this.entry
  }
  private longPct(price: number): number {
    return (price - this.entry) / this.entry
  }

  private drawAxes(): void {
    const g = this.add.graphics()
    // zero P&L line
    const yZero = this.yForPct(0)
    g.lineStyle(1.5, C.muted, 0.6)
    g.lineBetween(this.plot.l, yZero, this.plot.r, yZero)
    this.label(this.plot.r + 4, yZero, '0%', { size: 12, col: C.muted })
    // breakeven vertical at entry
    const xE = this.xForPrice(this.entry)
    const gv = this.add.graphics()
    gv.lineStyle(1.5, C.blue, 0.5)
    gv.lineBetween(xE, this.plot.t, xE, this.plot.b)
    this.label(xE, this.plot.b + 32, `entry $${this.entry}`, { size: 12, col: C.blue, align: 'center', bg: true })
    // ceiling +100% (green dashed) and floor −100% (red dashed)
    this.dashedLine(this.plot.l, this.yForPct(1), this.plot.r, C.green, 6, 5, 1.2)
    this.label(this.plot.l + 4, this.yForPct(1) - 11, '+100% ceiling', { size: 12, bold: true, col: C.green, bg: true })
    this.dashedLine(this.plot.l, this.yForPct(-1), this.plot.r, C.red, 6, 5, 1.2)
    this.label(this.plot.l + 4, this.yForPct(-1) + 13, '−100% floor (long)', { size: 12, bold: true, col: C.red, bg: true })

    // x labels
    for (let pr = 0; pr <= this.priceMax; pr += this.priceMax / 4) {
      this.label(this.xForPrice(pr), this.plot.b + 16, `$${pr.toFixed(0)}`, { size: 12, col: C.muted, align: 'center' })
    }
  }

  private shortLine?: Phaser.GameObjects.Graphics
  private longLine?: Phaser.GameObjects.Graphics

  private drawShortLine(): void {
    const g = this.add.graphics()
    g.lineStyle(2.5, C.red, 1)
    g.beginPath()
    let first = true
    for (let pr = 0.01; pr <= this.priceMax; pr += this.priceMax / 120) {
      const x = this.xForPrice(pr)
      const y = this.yForPct(this.shortPct(pr))
      if (first) {
        g.moveTo(x, y)
        first = false
      } else g.lineTo(x, y)
    }
    g.strokePath()
    g.alpha = 0
    this.tweens.add({ targets: g, alpha: 1, duration: 500 })
    this.shortLine = g
    this.fadeIn(this.label(this.plot.r - 90, this.yForPct(this.shortPct(this.priceMax)) + 10, 'SHORT', { size: 13, bold: true, col: C.red, bg: true }))
  }

  private drawLongLine(): void {
    const g = this.add.graphics()
    g.lineStyle(2.5, C.green, 1)
    g.beginPath()
    let first = true
    for (let pr = 0.01; pr <= this.priceMax; pr += this.priceMax / 120) {
      const x = this.xForPrice(pr)
      const y = this.yForPct(this.longPct(pr))
      if (first) {
        g.moveTo(x, y)
        first = false
      } else g.lineTo(x, y)
    }
    g.strokePath()
    g.alpha = 0
    this.tweens.add({ targets: g, alpha: 1, duration: 500 })
    this.longLine = g
    g.setVisible(this.showLong)
    this.fadeIn(this.label(this.plot.r - 86, this.yForPct(this.longPct(this.priceMax)) - 4, 'LONG', { size: 13, bold: true, col: C.green, bg: true }))
  }

  private drawCeilingArrows(): void {
    // "↓ no floor" on the short tail (mid-plot, left of the SHORT line label/tail)
    this.label(this.plot.l + 90, this.plot.b - 18, '↓ no floor', { size: 12, bold: true, col: C.red, bg: true })
    // "↑ no ceiling" on the long line near the top
    this.label(this.plot.r - 130, this.plot.t + 8, '↑ no ceiling', { size: 12, bold: true, col: C.green, bg: true })
  }

  private enableInteractive(): void {
    // Scrub-able cursor (vertical line) along the x-axis. The knob is visual only;
    // a transparent grab strip along the bottom axis drives it via scene-level
    // pointer tracking — moving the *container* from a child's drag event causes
    // coordinate-frame feedback (jitter), so we track the pointer in game space.
    const line = this.add.graphics()
    line.lineStyle(1.5, C.ink, 0.5)
    line.lineBetween(0, this.plot.t, 0, this.plot.b)
    const knob = this.add.circle(0, this.plot.b, 9, C.blue).setStrokeStyle(3, C.white)
    this.cursor = this.add.container(this.xForPrice(this.cursorX), 0, [line, knob])

    const moveTo = (pointerX: number) => {
      const localX = Math.max(this.plot.l, Math.min(this.plot.r, pointerX))
      this.cursor.x = localX
      const t = (localX - this.plot.l) / (this.plot.r - this.plot.l)
      this.cursorX = t * this.priceMax
      this.refreshReadout()
    }

    const strip = this.add
      .rectangle((this.plot.l + this.plot.r) / 2, this.plot.b, this.plot.r - this.plot.l, 40, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    let dragging = false
    strip.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true
      moveTo(p.worldX)
    })
    const onMove = (p: Phaser.Input.Pointer) => {
      if (dragging) moveTo(p.worldX)
    }
    const onUp = () => {
      dragging = false
    }
    this.input.on('pointermove', onMove)
    this.input.on('pointerup', onUp)
    this.input.on('pointerupoutside', onUp)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', onMove)
      this.input.off('pointerup', onUp)
      this.input.off('pointerupoutside', onUp)
    })

    this.refreshReadout()
  }

  // --- Balloon metaphor ------------------------------------------------------
  private buildBalloon(): void {
    const cx = 672
    this.balloon = this.add.container(cx, this.balloonCY)
    this.balloonBody = this.add.graphics()
    this.balloon.add(this.balloonBody)

    // The two fixed truths that frame the balloon: up = unbounded loss, down = capped.
    this.fadeIn(
      this.label(cx, 118, '↑ inflates: loss has no cap', { size: 11, bold: true, col: C.red, align: 'center', bg: true }),
      200,
    )
    this.fadeIn(
      this.label(cx, 242, '↓ empty = +100% (capped)', { size: 11, bold: true, col: C.green, align: 'center', bg: true }),
      300,
    )

    this.drawBalloon(this.cursorX)
    this.fadeIn(this.balloon, 150)
    // Gentle ambient "breathing" so the balloon feels alive (no-op under reduced motion).
    this.loop({ targets: this.balloon, scaleX: 1.04, scaleY: 1.04, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  /** Size + tint the balloon for the current future price (drives the metaphor). */
  private drawBalloon(price: number): void {
    if (!this.balloonBody) return
    const t = Math.max(0, Math.min(1, price / this.priceMax))
    const r = 5 + t * 32 // deflated (~5px) at $0 → swollen (~37px) at priceMax
    const losing = price > this.entry
    const col = losing ? C.red : C.green
    const g = this.balloonBody
    g.clear()
    // Balloon body (a touch taller than wide).
    g.fillStyle(col, 0.85)
    g.fillEllipse(0, 0, r * 1.7, r * 2)
    // Soft highlight for a little dimensional life.
    g.fillStyle(C.white, 0.28)
    g.fillEllipse(-r * 0.32, -r * 0.42, r * 0.55, r * 0.8)
    // Knot at the bottom.
    g.fillStyle(col, 0.85)
    g.fillTriangle(-3.5, r, 3.5, r, 0, r + 6)
  }

  private refreshReadout(): void {
    const price = this.cursorX
    const sPct = this.shortPct(price)
    const lPct = this.longPct(price)
    const sDollar = (this.entry - price) * this.shares
    const lDollar = (price - this.entry) * this.shares
    this.drawBalloon(price)
    this.priceReadout.setText(`$${price.toFixed(0)}`)
    this.readoutShort.setText(`Short: ${(sPct * 100).toFixed(0)}%  (${sDollar >= 0 ? '+' : '−'}$${Math.abs(sDollar).toFixed(0)})`)
    this.readoutShort.setColor(hex(color(sPct >= 0 ? C.green : C.red)))
    if (this.showLong) {
      this.readoutLong.setText(`Long: ${(lPct * 100).toFixed(0)}%  (${lDollar >= 0 ? '+' : '−'}$${Math.abs(lDollar).toFixed(0)})`)
      this.readoutLong.setColor(hex(color(lPct >= 0 ? C.green : C.red)))
    } else {
      this.readoutLong.setText('')
    }
  }

  // M6 quiz reveal: draw both lines + drop a marker at the resolved price.
  protected onReveal(): void {
    if (this.shortLine) return // already drawn (teach mode)
    this.drawShortLine()
    this.time.delayedCall(500, () => {
      this.drawLongLine()
      this.drawCeilingArrows()
      // mark the resolved price
      const x = this.xForPrice(this.revealPrice)
      const ySh = this.yForPct(this.shortPct(this.revealPrice))
      const yLo = this.yForPct(this.longPct(this.revealPrice))
      this.add.circle(x, ySh, 6, C.red).setStrokeStyle(2, C.white)
      this.add.circle(x, yLo, 6, C.green).setStrokeStyle(2, C.white)
      const sD = (this.entry - this.revealPrice) * this.shares
      const lD = (this.revealPrice - this.entry) * this.shares
      // labels right-aligned to the LEFT of the marker so they stay inside the plot,
      // with chips so they read over the payoff lines.
      this.fadeIn(this.label(x - 8, ySh, `Short ${sD >= 0 ? '+' : '−'}$${Math.abs(sD).toFixed(0)} ↓ no floor`, { size: 12, bold: true, col: C.red, align: 'right', bg: true }))
      this.fadeIn(this.label(x - 8, yLo, `Long ${lD >= 0 ? '+' : '−'}$${Math.abs(lD).toFixed(0)}`, { size: 12, bold: true, col: C.green, align: 'right', bg: true }))
      this.cursorX = this.revealPrice
      this.cursor.x = x
      this.refreshReadout()
    })
  }
}
