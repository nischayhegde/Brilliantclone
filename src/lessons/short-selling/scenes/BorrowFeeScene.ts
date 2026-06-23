import { ModuleScene } from '../../../engine/ModuleScene'
import { C, FONT, hex, color } from '../../../engine/palette'

interface BorrowFeeParams {
  /** Shares shorted. Default 100. */
  shares?: number
  /** Sell (entry) price. Default $50. */
  sell?: number
  /** Gross short P&L the NET is derived from (illustrative fixed). Default $600. */
  gross?: number
  /** Dividend per share when the toggle is on. Default $0.20. */
  divPerShare?: number
}

/**
 * M3 INTERACTIVE — "Borrow Fee & the Margin Account".
 * Collateral gauge (proceeds + 50% extra margin), a daily borrow-fee ticker, an
 * ex-dividend chip, and a live NET = gross − feeTotal − dividend. Controls: borrow-rate
 * slider (snap presets 0.3%/30%), holding-days slider (1..90), dividend toggle.
 * Fee math is EXACT: dailyFee = marketValue × annualRate / 365.
 */
export default class BorrowFeeScene extends ModuleScene {
  private shares = 100
  private sell = 50
  private gross = 600
  private divPerShare = 0.2

  private rate = 0.003 // 0.3%/yr
  private days = 30
  private divOn = false

  private marketValue = 5000
  private extraMargin = 2500

  private feeText!: Phaser.GameObjects.Text
  private cumText!: Phaser.GameObjects.Text
  private divText!: Phaser.GameObjects.Text
  private netText!: Phaser.GameObjects.Text
  private rateText!: Phaser.GameObjects.Text
  private daysText!: Phaser.GameObjects.Text
  private feeBar!: Phaser.GameObjects.Graphics

  protected build(): void {
    const p = this.params as BorrowFeeParams
    this.shares = p.shares ?? 100
    this.sell = p.sell ?? 50
    this.gross = p.gross ?? 600
    this.divPerShare = p.divPerShare ?? 0.2
    this.marketValue = this.shares * this.sell
    this.extraMargin = this.marketValue * 0.5

    this.label(this.W / 2, 24, 'Borrow fee & the margin account', {
      size: 16,
      bold: true,
      col: C.ink,
      align: 'center',
    })
    this.label(this.W / 2, 44, 'illustrative simulation · fee math exact', {
      size: 11,
      col: C.muted,
      align: 'center',
    })

    this.drawCollateralGauge()
    this.drawControls()
    this.drawReadouts()

    this.refresh()
    this.emitReady()
  }

  // --- Collateral gauge: proceeds + extra margin = total collateral held ---
  private drawCollateralGauge(): void {
    const gx = 60
    const gy = 90
    const gw = 280
    const gh = 150
    const total = this.marketValue + this.extraMargin // $7,500
    const proceedsH = (this.marketValue / total) * gh
    const marginH = (this.extraMargin / total) * gh

    // proceeds (green) at the bottom, locked as collateral
    const g = this.add.graphics()
    g.fillStyle(C.green, 0.8)
    g.fillRoundedRect(gx, gy + gh - proceedsH, gw, proceedsH, 6)
    // extra margin (blue) on top
    g.fillStyle(C.blue, 0.8)
    g.fillRoundedRect(gx, gy + gh - proceedsH - marginH, gw, marginH, 6)
    g.lineStyle(1.5, C.hairline)
    g.strokeRoundedRect(gx, gy, gw, gh, 6)
    this.fadeIn(g)

    this.label(gx + gw / 2, gy + gh - proceedsH / 2, `Sale proceeds  $${this.marketValue.toLocaleString()}`, {
      size: 12,
      bold: true,
      col: C.white,
      align: 'center',
    })
    this.label(gx + gw / 2, gy + gh - proceedsH - marginH / 2, `+50% extra margin  $${this.extraMargin.toLocaleString()}`, {
      size: 11,
      bold: true,
      col: C.white,
      align: 'center',
    })

    // brace spanning both → total collateral
    this.label(gx + gw + 12, gy + gh / 2, `Collateral the broker holds\n≈150% of proceeds = $${total.toLocaleString()}`, {
      size: 11,
      col: C.muted,
    })
  }

  // --- Controls ---
  private drawControls(): void {
    // Borrow-rate slider with snap presets (0.3% .. 30%/yr)
    this.label(60, 268, 'Annual borrow rate (example)', { size: 12, bold: true, col: C.ink })
    this.rateText = this.label(330, 268, '', { size: 12, bold: true, col: C.blue, align: 'right' })
    this.slider(60, 290, 280, 0.003, 0.3, this.rate, (v) => {
      // snap to nearest preset if close, else free-drag
      if (Math.abs(v - 0.003) < 0.02) v = 0.003
      else if (Math.abs(v - 0.3) < 0.03) v = 0.3
      this.rate = v
      this.refresh()
    }, { col: C.blue })
    this.label(60, 306, 'Easy ~0.3%', { size: 10, col: C.muted })
    this.label(340, 306, 'Hard ~30%', { size: 10, col: C.muted, align: 'right' })

    // Holding-days slider
    this.label(60, 330, 'Holding days', { size: 12, bold: true, col: C.ink })
    this.daysText = this.label(330, 330, '', { size: 12, bold: true, col: C.blue, align: 'right' })
    this.slider(60, 352, 280, 1, 90, this.days, (v) => {
      this.days = Math.round(v)
      this.refresh()
    }, { step: 1, col: C.blue })

    // Dividend toggle (build manually so we can drive its label)
    const bw = 170
    const bh = 30
    const bg = this.add.graphics()
    bg.fillStyle(C.blueSoft, 1)
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8)
    this.divBtnLabel = this.add
      .text(0, 0, 'Dividend: OFF', { fontFamily: FONT, fontSize: '13px', color: hex(C.blue), fontStyle: 'bold' })
      .setOrigin(0.5)
    const btn = this.add.container(145, 396, [bg, this.divBtnLabel])
    btn.setSize(bw, bh)
    btn.setInteractive({ useHandCursor: true })
    btn.on('pointerup', () => {
      this.divOn = !this.divOn
      this.refresh()
    })
  }

  private divBtnLabel!: Phaser.GameObjects.Text

  // --- Readouts panel on the right ---
  private drawReadouts(): void {
    const x = 470
    const y = 264
    this.panel(x, y, 240, 150, { fill: C.gray100, stroke: C.hairline, radius: 10 })
    this.label(x + 14, y + 20, 'Daily fee', { size: 12, col: C.muted })
    this.feeText = this.label(x + 226, y + 20, '', { size: 12, bold: true, col: C.ink, align: 'right' })
    this.label(x + 14, y + 44, 'Borrow cost so far', { size: 12, col: C.muted })
    this.cumText = this.label(x + 226, y + 44, '', { size: 12, bold: true, col: C.red, align: 'right' })
    this.label(x + 14, y + 68, 'Dividend owed', { size: 12, col: C.muted })
    this.divText = this.label(x + 226, y + 68, '', { size: 12, bold: true, col: C.red, align: 'right' })

    this.feeBar = this.add.graphics()

    this.label(x + 14, y + 104, 'NET (gross − costs)', { size: 12, bold: true, col: C.ink })
    this.netText = this.label(x + 226, y + 128, '', { size: 18, bold: true, col: C.green, align: 'right' })
    this.label(x + 14, y + 128, `gross $${this.gross}`, { size: 11, col: C.muted })
  }

  // --- Exact fee math ---
  private dailyFee(): number {
    return (this.marketValue * this.rate) / 365
  }

  private refresh(): void {
    const daily = this.dailyFee()
    const cumFee = daily * this.days
    const dividend = this.divOn ? this.divPerShare * this.shares : 0
    const net = this.gross - cumFee - dividend

    this.rateText.setText(`${(this.rate * 100).toFixed(this.rate < 0.01 ? 2 : 1)}%/yr`)
    this.daysText.setText(`${this.days} days`)
    this.feeText.setText(`$${daily.toFixed(2)}/day`)
    this.cumText.setText(`− $${cumFee.toFixed(2)}`)
    this.divText.setText(dividend > 0 ? `− $${dividend.toFixed(2)}` : '$0.00')

    const netCol = net >= 0 ? C.green : C.red
    const sign = net >= 0 ? '+' : '−'
    this.netText.setText(`${sign}$${Math.abs(net).toFixed(2)}`)
    this.netText.setColor(hex(color(netCol)))

    // small fee bar visual under the cost rows
    const x = 484
    const y = 354
    const w = 212
    this.feeBar.clear()
    this.feeBar.fillStyle(C.gray200, 1)
    this.feeBar.fillRoundedRect(x, y, w, 6, 3)
    const eaten = Math.min(1, (cumFee + dividend) / this.gross)
    this.feeBar.fillStyle(C.red, 0.85)
    this.feeBar.fillRoundedRect(x, y, w * eaten, 6, 3)

    this.divBtnLabel.setText(this.divOn ? `Dividend: ON ($${this.divPerShare.toFixed(2)}/sh)` : 'Dividend: OFF')
  }
}
