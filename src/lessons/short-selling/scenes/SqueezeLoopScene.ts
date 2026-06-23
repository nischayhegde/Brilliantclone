import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, color } from '../../../engine/palette'

interface SqueezeLoopParams {
  /** Float in millions of shares. Default 50. */
  floatM?: number
  /** Avg daily volume in millions. Default 8. */
  avgVolM?: number
  /** Short interest as % of float. Default 90. */
  shortPct?: number
}

/**
 * M8 TEACH/INTERACTIVE — "Anatomy of a Short Squeeze".
 * Four-node feedback ring (Price ↑ → Margin pressure → Shorts buy to cover → More
 * buying) with a travelling arrow that speeds up each lap as the Price bar jumps higher.
 * Controls: short-interest % slider and float slider; a "Nudge price up" button runs the
 * covering cascade — more violent when SI is high and float is small.
 * Exact: daysToCover = sharesShort / avgDailyVolume.
 */
export default class SqueezeLoopScene extends ModuleScene {
  private floatM = 50
  private avgVolM = 8
  private shortPct = 90

  private ringX = 250
  private ringY = 210
  private ringR = 95
  private nodeNames = ['Price ↑', 'Margin pressure', 'Shorts buy to cover', 'More buying']
  private nodePos: { x: number; y: number }[] = []

  private arrow!: Phaser.GameObjects.Arc
  private priceBar!: Phaser.GameObjects.Graphics
  private priceLevel = 1 // multiplier
  private running = false

  private siBar!: Phaser.GameObjects.Graphics
  private dtcText!: Phaser.GameObjects.Text
  private peakText!: Phaser.GameObjects.Text
  private siReadout!: Phaser.GameObjects.Text

  protected build(): void {
    const p = this.params as SqueezeLoopParams
    this.floatM = p.floatM ?? 50
    this.avgVolM = p.avgVolM ?? 8
    this.shortPct = p.shortPct ?? 90

    this.label(this.W / 2, 22, 'Anatomy of a short squeeze', { size: 16, bold: true, col: C.ink, align: 'center' })
    this.label(this.W / 2, 40, 'illustrative simulation · days-to-cover math exact', { size: 11, col: C.muted, align: 'center' })

    this.drawRing()

    // Price bar (right of ring)
    this.label(420, 80, 'Price', { size: 12, bold: true, col: C.muted })
    const frame = this.add.graphics()
    frame.lineStyle(1.5, C.hairline)
    frame.strokeRoundedRect(410, 95, 50, 230, 6)
    this.priceBar = this.add.graphics()

    // Short-interest bar
    this.label(500, 80, 'Short interest', { size: 12, bold: true, col: C.muted })
    const f2 = this.add.graphics()
    f2.lineStyle(1.5, C.hairline)
    f2.strokeRoundedRect(500, 95, 50, 230, 6)
    this.siBar = this.add.graphics()

    // Days-to-cover dial (text gauge)
    this.dtcText = this.label(640, 130, '', { size: 13, bold: true, col: C.blue, align: 'center' })
    this.label(640, 96, 'Days-to-cover', { size: 12, bold: true, col: C.muted, align: 'center' })
    this.peakText = this.label(640, 200, '', { size: 13, bold: true, col: C.red, align: 'center' })

    // controls
    this.label(60, 360, 'Short interest (% of float)', { size: 12, bold: true, col: C.ink })
    this.slider(60, 382, 260, 10, 150, this.shortPct, (v) => {
      this.shortPct = Math.round(v)
      this.refresh()
    }, { step: 1, col: C.red })

    this.label(380, 360, 'Available float (M shares)', { size: 12, bold: true, col: C.ink })
    this.slider(380, 382, 200, 5, 120, this.floatM, (v) => {
      this.floatM = Math.round(v)
      this.refresh()
    }, { step: 1, col: C.blue })

    this.button(660, 382, 'Nudge price ↑', () => this.runCascade(), { w: 130, h: 32 })

    this.siReadout = this.label(60, 416, '', { size: 12, col: C.ink })

    this.refresh()
    this.startArrow()
    this.emitReady()
  }

  private drawRing(): void {
    const ring = this.add.graphics()
    ring.lineStyle(2, C.hairline, 1)
    ring.strokeCircle(this.ringX, this.ringY, this.ringR)
    const angles = [-90, 0, 90, 180]
    angles.forEach((a, i) => {
      const rad = (a * Math.PI) / 180
      const x = this.ringX + Math.cos(rad) * this.ringR
      const y = this.ringY + Math.sin(rad) * this.ringR
      this.nodePos.push({ x, y })
      this.add.circle(x, y, 30, C.blueSoft).setStrokeStyle(1.5, C.blue)
      const t = this.label(x, y, this.nodeNames[i], { size: 10, bold: true, col: C.blue, align: 'center' })
      t.setWordWrapWidth(70)
    })
    this.arrow = this.add.circle(this.nodePos[0].x, this.nodePos[0].y, 7, C.red)
  }

  private arrowT = 0
  private arrowSpeed = 0.004
  private startArrow(): void {
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        this.arrowT = (this.arrowT + this.arrowSpeed) % 1
        const a = (-90 + this.arrowT * 360) * (Math.PI / 180)
        this.arrow.x = this.ringX + Math.cos(a) * this.ringR
        this.arrow.y = this.ringY + Math.sin(a) * this.ringR
      },
    })
  }

  private sharesShort(): number {
    return (this.shortPct / 100) * this.floatM
  }
  private daysToCover(): number {
    return this.sharesShort() / this.avgVolM
  }

  private refresh(): void {
    const dtc = this.daysToCover()
    // SI bar height ∝ shortPct (cap visual at 150)
    this.siBar.clear()
    const siH = Math.min(1, this.shortPct / 150) * 226
    const siCol = this.shortPct > 100 ? C.red : C.blue
    this.siBar.fillStyle(siCol, 0.8)
    this.siBar.fillRoundedRect(503, 95 + 230 - siH, 44, siH, 4)

    this.dtcText.setText(`${dtc.toFixed(1)} days`)
    this.dtcText.setColor(hex(color(dtc > 5 ? C.red : C.blue)))

    this.siReadout.setText(
      `Short interest ${this.shortPct}% · Float ${this.floatM}M · Avg vol ${this.avgVolM}M · ` +
        `Shares short ${this.sharesShort().toFixed(1)}M · Days-to-cover = ${this.sharesShort().toFixed(1)} ÷ ${this.avgVolM} = ${dtc.toFixed(1)}`,
    )

    // arrow base speed scales with fuel
    this.arrowSpeed = 0.003 + Math.min(0.02, (this.shortPct / 100) * (50 / this.floatM) * 0.004)

    if (!this.running) {
      this.priceLevel = 1
      this.drawPriceBar()
      this.peakText.setText('')
    }
  }

  private drawPriceBar(): void {
    this.priceBar.clear()
    // priceLevel 1..6 maps to bar height
    const h = Math.min(1, (this.priceLevel - 1) / 5) * 226
    this.priceBar.fillStyle(C.red, 0.85)
    this.priceBar.fillRoundedRect(413, 95 + 230 - h, 44, h, 4)
  }

  private runCascade(): void {
    if (this.running) return
    this.running = true
    // fuel determines number of laps / peak: SI% × (50/float)
    const fuel = (this.shortPct / 100) * (50 / this.floatM)
    const laps = Math.max(2, Math.min(8, Math.round(2 + fuel * 4)))
    const peakMove = Math.round((fuel - 0.3) * 120) // % simulated spike, illustrative
    let lap = 0
    const step = () => {
      if (lap >= laps) {
        this.peakText.setText(`Simulated peak\n+${Math.max(10, peakMove)}%`)
        this.running = false
        this.refresh()
        return
      }
      lap++
      this.priceLevel = 1 + (lap / laps) * 5
      this.arrowSpeed += 0.004 // speed up each lap
      this.drawPriceBar()
      this.time.delayedCall(420, step)
    }
    step()
  }
}
