import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, color } from '../../../engine/palette'

interface NetPnLParams {
  shares?: number // 100
  sell?: number // 50
  /** Initial cover price (the buy-to-cover). Default 44. */
  cover?: number // 44
  /** Borrow fee per share PER DAY. Default 0.02 (so 30d ≈ $0.50/sh). */
  borrowPerShareDay?: number
  /** Dividend owed per share over the hold. Default 0.20. */
  divPerShare?: number // 0.20
  /** Initial holding-days. Default 30. */
  days?: number
  /** Cover-price drag bounds. */
  coverMin?: number
  coverMax?: number
}

/**
 * M4 CHALLENGE — "Did the Short Make Money?".
 * The learner drags the BUY-TO-COVER price along a vertical price axis and a holding-days
 * slider that accrues a daily borrow fee. A live ledger shows gross / (−fee) / (−div) /
 * NET as a stacked bar. Submit grades whether they ended NET-profitable and explains how
 * fees + owed dividends erode the gross.
 *
 * Math is exact:
 *   gross = (sell − cover) · shares
 *   borrowFee = borrowPerShareDay · shares · days
 *   net = gross − borrowFee − dividends
 */
export default class NetPnLQuizScene extends ModuleScene {
  private shares = 100
  private sell = 50
  private cover = 44
  private borrowPerShareDay = 0.02
  private divPerShare = 0.2
  private days = 30
  private coverMin = 30
  private coverMax = 60

  // Vertical price axis for the cover-line drag.
  private axisX = 150
  private axisTop = 96
  private axisBottom = 340

  // Stacked ledger bar.
  private barX = 470
  private barW = 70
  private barTop = 96
  private barBottom = 340
  private barMax = 1000

  private coverLine!: Phaser.GameObjects.Graphics
  private coverKnob!: Phaser.GameObjects.Arc
  private coverLabel!: Phaser.GameObjects.Text
  private barG!: Phaser.GameObjects.Graphics
  private barCap!: Phaser.GameObjects.Text
  private ledger!: Phaser.GameObjects.Text
  private locked = false

  protected build(): void {
    const p = this.params as NetPnLParams
    this.shares = p.shares ?? 100
    this.sell = p.sell ?? 50
    this.cover = p.cover ?? 44
    this.borrowPerShareDay = p.borrowPerShareDay ?? 0.02
    this.divPerShare = p.divPerShare ?? 0.2
    this.days = p.days ?? 30
    this.coverMin = p.coverMin ?? Math.max(1, this.sell - 25)
    this.coverMax = p.coverMax ?? this.sell + 15

    this.label(this.W / 2, 22, 'Set your buy-to-cover and holding time', {
      size: 16,
      bold: true,
      col: C.ink,
      align: 'center',
    })
    this.label(this.W / 2, 42, 'illustrative simulation · P&L math exact', {
      size: 11,
      col: C.muted,
      align: 'center',
    })

    this.drawPriceAxis()
    this.drawCoverControl()
    this.drawLedger()

    // Holding-days slider (accrues borrow fee).
    this.label(60, 372, 'Holding period (days)', { size: 12, bold: true, col: C.ink })
    this.slider(
      60,
      396,
      300,
      1,
      120,
      this.days,
      (v) => {
        if (this.locked) return
        this.days = Math.round(v)
        this.refresh()
      },
      { step: 1, col: C.blue },
    )

    this.ledger = this.label(60, 426, '', { size: 12, col: C.ink })
    this.ledger.setWordWrapWidth(640)

    this.refresh()
    this.setCanSubmit(true)
    this.emitReady()
  }

  // --- price axis (vertical) ---
  private yForPrice(price: number): number {
    const t = (price - this.coverMin) / (this.coverMax - this.coverMin)
    return this.axisBottom - t * (this.axisBottom - this.axisTop)
  }
  private priceForY(y: number): number {
    const cy = Math.max(this.axisTop, Math.min(this.axisBottom, y))
    const t = (this.axisBottom - cy) / (this.axisBottom - this.axisTop)
    return this.coverMin + t * (this.coverMax - this.coverMin)
  }

  private drawPriceAxis(): void {
    const g = this.add.graphics()
    g.lineStyle(1.5, C.hairline)
    g.lineBetween(this.axisX, this.axisTop - 8, this.axisX, this.axisBottom + 8)
    // gridline labels
    for (let i = 0; i <= 3; i++) {
      const price = this.coverMin + ((this.coverMax - this.coverMin) * i) / 3
      const y = this.yForPrice(price)
      g.lineStyle(1, C.gray100)
      g.lineBetween(this.axisX - 6, y, this.axisX + 60, y)
      this.label(this.axisX - 12, y, `$${price.toFixed(0)}`, { size: 11, col: C.muted, align: 'right' })
    }
    // SELL line (fixed) — the price you shorted at.
    const ys = this.yForPrice(this.sell)
    const sellG = this.add.graphics()
    sellG.lineStyle(2, C.red, 0.9)
    sellG.lineBetween(this.axisX, ys, this.axisX + 150, ys)
    this.label(this.axisX + 6, ys - 12, `SELL $${this.sell.toFixed(0)} (entry)`, { size: 11, bold: true, col: C.red })
  }

  private drawCoverControl(): void {
    const y = this.yForPrice(this.cover)
    this.coverLine = this.add.graphics()
    this.coverKnob = this.add.circle(this.axisX + 150, y, 7, C.green).setStrokeStyle(2, C.white)
    this.coverLabel = this.label(this.axisX + 6, y + 12, '', { size: 12, bold: true, col: C.green })

    // Grab strip spanning the cover line for dragging.
    const strip = this.add
      .rectangle(this.axisX + 75, y, 170, 26, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
    let dragging = false
    const moveTo = (py: number) => {
      this.cover = this.priceForY(py)
      strip.y = this.yForPrice(this.cover)
      this.refresh()
    }
    strip.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.locked) return
      dragging = true
      moveTo(p.y)
    })
    const onMove = (p: Phaser.Input.Pointer) => {
      if (dragging && !this.locked) moveTo(p.y)
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
  }

  private drawCoverLine(): void {
    const y = this.yForPrice(this.cover)
    this.coverLine.clear()
    this.coverLine.lineStyle(2, C.green, 1)
    for (let x = this.axisX; x < this.axisX + 150; x += 10) {
      this.coverLine.lineBetween(x, y, Math.min(x + 6, this.axisX + 150), y)
    }
    this.coverKnob.y = y
    this.coverLabel.setPosition(this.axisX + 6, y + 12)
    this.coverLabel.setText(`COVER $${this.cover.toFixed(2)}`)
  }

  // --- stacked ledger bar ---
  private hForValue(v: number): number {
    const t = Math.max(0, Math.min(1, v / this.barMax))
    return t * (this.barBottom - this.barTop)
  }

  private drawLedger(): void {
    this.label(this.barX + this.barW / 2, this.barTop - 18, 'Your P&L', {
      size: 12,
      bold: true,
      col: C.ink,
      align: 'center',
    })
    const frame = this.add.graphics()
    frame.lineStyle(1, C.hairline)
    frame.lineBetween(this.barX - 14, this.barBottom, this.barX + this.barW + 14, this.barBottom)
    this.label(this.barX - 18, this.barBottom + 2, '$0', { size: 11, col: C.muted, align: 'right' })
    this.barG = this.add.graphics()
    this.barCap = this.label(this.barX + this.barW / 2, this.barBottom, '', {
      size: 15,
      bold: true,
      col: C.green,
      align: 'center',
    })
  }

  private metrics() {
    const gross = (this.sell - this.cover) * this.shares
    const borrow = this.borrowPerShareDay * this.shares * this.days
    const dividend = this.divPerShare * this.shares
    const net = gross - borrow - dividend
    return { gross, borrow, dividend, net }
  }

  private refresh(): void {
    this.drawCoverLine()
    const { gross, borrow, dividend, net } = this.metrics()

    // Stacked bar: gross block (green if positive, red if negative), then red fee/div
    // segments biting into it, capped by the NET line/label.
    this.barG.clear()
    const baseY = this.barBottom

    if (gross >= 0) {
      // green gross column
      const grossH = this.hForValue(gross)
      this.barG.fillStyle(C.green, 0.28)
      this.barG.fillRoundedRect(this.barX, baseY - grossH, this.barW, grossH, 4)
      // red costs eaten off the TOP of the gross column
      const costH = this.hForValue(borrow + dividend)
      const eatenH = Math.min(costH, grossH)
      this.barG.fillStyle(C.red, 0.8)
      this.barG.fillRect(this.barX, baseY - grossH, this.barW, eatenH)
      // net column (solid green) up to net
      if (net > 0) {
        const netH = this.hForValue(net)
        this.barG.fillStyle(C.green, 0.9)
        this.barG.fillRoundedRect(this.barX, baseY - netH, this.barW, netH, 4)
      }
    } else {
      // gross already a loss (covered above entry): a red column hanging below $0
      const lossH = this.hForValue(-gross + borrow + dividend)
      this.barG.fillStyle(C.red, 0.85)
      this.barG.fillRoundedRect(this.barX, baseY, this.barW, Math.min(lossH, this.barBottom - this.barTop), 4)
    }

    const netCol = net >= 0 ? C.green : C.red
    const netH = this.hForValue(Math.abs(net))
    const capY = net >= 0 ? baseY - netH - 14 : baseY + Math.min(netH, this.barBottom - this.barTop) + 6
    this.barCap.setY(capY)
    this.barCap.setText(`NET ${net >= 0 ? '+' : '−'}$${Math.abs(net).toFixed(0)}`)
    this.barCap.setColor(hex(color(netCol)))

    this.ledger.setText(
      `Gross $${gross.toFixed(0)}  −  borrow $${borrow.toFixed(0)} (${this.days}d)  −  dividend $${dividend.toFixed(0)}  =  ` +
        `NET ${net >= 0 ? '+' : '−'}$${Math.abs(net).toFixed(0)}`,
    )
  }

  protected onSubmit(): void {
    if (this.locked) return
    this.locked = true
    this.setCanSubmit(false)
    const { gross, borrow, dividend, net } = this.metrics()
    const correct = net > 0

    // Pulse the net cap so the result reads off the chart.
    this.tweens.add({ targets: this.barCap, scale: 1.25, yoyo: true, duration: 220 })

    let title: string
    let detail: string
    if (net > 0 && gross > borrow + dividend) {
      title = `Net profit · +$${net.toFixed(0)}`
      detail =
        `You covered at $${this.cover.toFixed(2)} after ${this.days} days. Gross was $${gross.toFixed(0)}, but the carry took a bite: ` +
        `borrow $${borrow.toFixed(0)} + dividends $${dividend.toFixed(0)} = $${(borrow + dividend).toFixed(0)} of costs. ` +
        `Net = ${gross.toFixed(0)} − ${borrow.toFixed(0)} − ${dividend.toFixed(0)} = +$${net.toFixed(0)}. Right on direction AND profitable after costs.`
    } else if (gross > 0 && net <= 0) {
      title = `Right on direction, but you lost money · −$${Math.abs(net).toFixed(0)}`
      detail =
        `The stock fell (gross +$${gross.toFixed(0)}), yet ${this.days} days of borrow ($${borrow.toFixed(0)}) plus owed dividends ($${dividend.toFixed(0)}) ` +
        `swallowed the whole gross — net = −$${Math.abs(net).toFixed(0)}. This is the trap: a slow grind down can lose to the carry. Cover faster or pick a cheaper-to-borrow name.`
    } else {
      title = `Loss · −$${Math.abs(net).toFixed(0)}`
      detail =
        `You covered at $${this.cover.toFixed(2)} — at or above your $${this.sell} entry, so even the gross is negative ($${gross.toFixed(0)}). ` +
        `Add borrow $${borrow.toFixed(0)} and dividends $${dividend.toFixed(0)} and the net is −$${Math.abs(net).toFixed(0)}. A short only profits when you cover BELOW your entry by more than the carry.`
    }
    this.report(correct, title, detail)
  }
}
