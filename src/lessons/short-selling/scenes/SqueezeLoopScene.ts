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
 *
 * Two halves, one story. LEFT: the four-node feedback ring (Price ↑ → Margin pressure →
 * Shorts buy to cover → More buying) with a pulse that speeds up as the loop runs — the
 * mechanism. RIGHT: the "crowd at one tiny exit" — a room of shorts (red dots = shares
 * sold short) who can only escape by buying back, through a single narrow door whose
 * width is the float (shares actually available to buy). Press "Nudge price ↑" and the
 * crowd surges the door, covered shorts pop upward, and the PRICE bar shoots up out of
 * that exit — the squeeze. Levers: short-interest % and float. The narrower the door and
 * the bigger the crowd, the higher the spike.
 *
 * Exact: sharesShort = (shortPct/100) × float ; daysToCover = sharesShort / avgDailyVolume.
 */
export default class SqueezeLoopScene extends ModuleScene {
  private floatM = 50
  private avgVolM = 8
  private shortPct = 90

  private ringX = 165
  private ringY = 200
  private ringR = 76
  private nodeNames = ['Price ↑', 'Margin pressure', 'Shorts buy to cover', 'More buying']
  private nodePos: { x: number; y: number }[] = []
  private nodeCircles: Phaser.GameObjects.Arc[] = []

  private arrow!: Phaser.GameObjects.Arc
  private arrowT = 0
  private arrowSpeed = 0.004

  // Right half — the room / exit / price riser.
  private doorG!: Phaser.GameObjects.Graphics
  private crowd!: Phaser.GameObjects.Container
  private doorLabel!: Phaser.GameObjects.Text
  private priceBar!: Phaser.GameObjects.Graphics
  private priceTag!: Phaser.GameObjects.Text
  private priceLevel = 1 // 1..6 multiplier
  private currentPeak = 0
  private running = false

  private dtcText!: Phaser.GameObjects.Text
  private siText!: Phaser.GameObjects.Text
  private peakText!: Phaser.GameObjects.Text
  private siReadout!: Phaser.GameObjects.Text

  // Room geometry (the crowd of shorts and their single exit).
  private roomL = 360
  private roomR = 580
  private roomT = 116
  private gapX = 470
  private wallY = 110

  protected build(): void {
    const p = this.params as SqueezeLoopParams
    this.floatM = p.floatM ?? 50
    this.avgVolM = p.avgVolM ?? 8
    this.shortPct = p.shortPct ?? 90

    this.label(this.W / 2, 14, 'Illustrative simulation · days-to-cover math exact', { size: 12, col: C.muted, align: 'center' })

    // --- LEFT: the feedback loop (mechanism) ---
    this.drawRing()
    this.label(this.ringX, 316, 'Their buying is what lifts the price.', { size: 12, bold: true, col: C.ink, align: 'center' })

    // --- RIGHT: the crowd at one tiny exit ---
    // The room that holds the crowd of shorts.
    this.panel(this.roomL, this.roomT, this.roomR - this.roomL, 182, { fill: C.gray100, stroke: C.hairline, radius: 10 })
    this.doorG = this.add.graphics()
    this.crowd = this.add.container(0, 0)
    this.doorLabel = this.label(this.gapX, 130, '', { size: 12, bold: true, col: C.ink, align: 'center' })
    this.label(this.gapX, 312, '= shares sold short, all must buy back', { size: 12, col: C.muted, align: 'center' })

    // Price bursts up out of the exit as shorts cover.
    this.priceBar = this.add.graphics()
    this.priceTag = this.label(this.gapX, 94, 'Price', { size: 12, bold: true, col: C.red, align: 'center' })

    // Right-edge gauges.
    this.label(680, 150, 'Days-to-cover', { size: 12, bold: true, col: C.muted, align: 'center' })
    this.dtcText = this.label(680, 174, '', { size: 14, bold: true, col: C.blue, align: 'center' })
    this.label(680, 214, 'Short interest', { size: 12, bold: true, col: C.muted, align: 'center' })
    this.siText = this.label(680, 238, '', { size: 14, bold: true, col: C.blue, align: 'center' })
    this.peakText = this.label(680, 282, '', { size: 13, bold: true, col: C.red, align: 'center' })

    // --- Controls (the levers) ---
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
      const circ = this.add.circle(x, y, 30, C.blueSoft).setStrokeStyle(1.5, C.blue)
      this.nodeCircles.push(circ)
      const t = this.label(x, y, this.nodeNames[i], { size: 12, bold: true, col: C.blue, align: 'center' })
      t.setWordWrapWidth(58)
    })
    // The travelling pulse rides the ring BEHIND the nodes, so it slips into each node
    // instead of covering the label text.
    this.arrow = this.add.circle(this.nodePos[0].x, this.nodePos[0].y, 7, C.red)
    this.children.moveBelow(this.arrow, this.nodeCircles[0])
  }

  private startArrow(): void {
    if (this.reduceMotion) {
      this.arrow.x = this.nodePos[0].x
      this.arrow.y = this.nodePos[0].y
      return
    }
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

  /** The single exit: a wall across the top of the room with a gap whose width = float. */
  private drawDoor(): void {
    const gw = 6 + ((Math.max(5, Math.min(120, this.floatM)) - 5) / 115) * 30 // half-width 6..36
    const g = this.doorG
    g.clear()
    g.fillStyle(C.ink, 1)
    g.fillRect(this.roomL, this.wallY - 1, this.gapX - gw - this.roomL, 8)
    g.fillRect(this.gapX + gw, this.wallY - 1, this.roomR - (this.gapX + gw), 8)
    // Amber posts frame the exit (amber = the active path the crowd is forced through).
    g.fillStyle(C.amber, 1)
    g.fillRect(this.gapX - gw - 3, this.wallY - 4, 3, 12)
    g.fillRect(this.gapX + gw, this.wallY - 4, 3, 12)
  }

  /** The crowd: red dots = shares sold short, packed in the room. */
  private drawCrowd(): void {
    this.crowd.removeAll(true)
    const n = Math.max(6, Math.min(30, Math.round(this.sharesShort())))
    const cols = 6
    const x0 = 388
    const y0 = 158
    const dx = 31
    const dy = 26
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      const dot = this.add.circle(x0 + c * dx, y0 + r * dy, 6, C.red, 0.85)
      this.crowd.add(dot)
    }
  }

  private refresh(): void {
    const dtc = this.daysToCover()
    this.drawDoor()
    this.drawCrowd()
    this.doorLabel.setText(`↑ exit: ${this.floatM}M free`)

    this.dtcText.setText(`${dtc.toFixed(1)} days`)
    this.dtcText.setColor(hex(color(dtc > 5 ? C.red : C.blue)))
    this.siText.setText(`${this.shortPct}%`)
    this.siText.setColor(hex(color(this.shortPct > 100 ? C.red : C.blue)))

    this.siReadout.setText(
      `Short interest ${this.shortPct}% · Float ${this.floatM}M · Avg vol ${this.avgVolM}M · ` +
        `Shares short ${this.sharesShort().toFixed(1)}M · Days-to-cover = ${this.sharesShort().toFixed(1)} ÷ ${this.avgVolM} = ${dtc.toFixed(1)}`,
    )

    // Arrow base speed scales with fuel.
    this.arrowSpeed = 0.003 + Math.min(0.02, (this.shortPct / 100) * (50 / this.floatM) * 0.004)

    if (!this.running) {
      this.priceLevel = 1
      this.drawPriceBar()
      this.peakText.setText('')
    }
  }

  /** The price column rising up out of the exit gap. */
  private drawPriceBar(): void {
    const baseY = 108
    const maxH = 60
    const frac = Math.min(1, (this.priceLevel - 1) / 5)
    const h = frac * maxH
    this.priceBar.clear()
    if (h > 0) {
      this.priceBar.fillStyle(C.red, 0.9)
      this.priceBar.fillRoundedRect(this.gapX - 11, baseY - h, 22, h, 4)
    }
    const pct = Math.round(frac * this.currentPeak)
    this.priceTag.setText(h > 0 ? `Price +${pct}%` : 'Price')
    this.priceTag.setY(baseY - h - 14)
  }

  /** Covered shorts: a few dots pop up out of the exit and fade. */
  private spawnCover(): void {
    if (this.reduceMotion) return
    for (let i = 0; i < 3; i++) {
      const d = this.add.circle(this.gapX + (i - 1) * 6, this.wallY - 2, 4, C.red, 0.9)
      this.tweens.add({ targets: d, y: 56, alpha: 0, duration: this.dur(520), ease: 'Cubic.out', onComplete: () => d.destroy() })
    }
  }

  /** Flash the loop firing: "Shorts buy to cover" then "Price ↑". */
  private pulseLoop(): void {
    ;[this.nodeCircles[2], this.nodeCircles[0]].forEach((c, i) => {
      if (!c) return
      this.tweens.add({ targets: c, scale: 1.14, duration: 140, delay: i * 90, yoyo: true, ease: 'Quad.out' })
    })
  }

  private runCascade(): void {
    if (this.running) return
    this.running = true
    // Fuel determines how many laps / how high: SI% × (50/float). Narrow float + heavy
    // short interest = a violent spike.
    const fuel = (this.shortPct / 100) * (50 / this.floatM)
    const laps = Math.max(2, Math.min(8, Math.round(2 + fuel * 4)))
    const peakMove = Math.round((fuel - 0.3) * 120) // % simulated spike, illustrative
    this.currentPeak = Math.max(10, peakMove)

    if (this.reduceMotion) {
      this.priceLevel = 6
      this.drawPriceBar()
      this.peakText.setText(`Simulated peak +${this.currentPeak}%`)
      this.running = false
      return
    }

    let lap = 0
    const step = () => {
      if (lap >= laps) {
        this.peakText.setText(`Simulated peak +${this.currentPeak}%`)
        this.running = false
        return
      }
      lap++
      this.priceLevel = 1 + (lap / laps) * 5
      this.arrowSpeed += 0.004 // each lap the loop spins faster
      this.drawPriceBar()
      this.spawnCover()
      this.pulseLoop()
      this.time.delayedCall(420, step)
    }
    step()
  }
}
