import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, color } from '../../../engine/palette'
import { CANDLES, type Candle } from '../../../data/candles'

interface CapstoneParams {
  /** Scenario chart at a decision point. Default 'short_quiz_HOOD'. */
  candlesKey?: string
  /** Reveal up to this index fraction (0..1) before masking. Default 0.4. */
  splitFrac?: number
  /** Scenario short interest (% of float). Default 35 (not squeeze fuel). */
  shortInterest?: number
  /** Scenario days-to-cover. Default 1.5. */
  daysToCover?: number
  /** Ground truth: is this a short worth taking? Default true (deteriorating, low SI). */
  worthShorting?: boolean
}

/**
 * M15 CAPSTONE — "The Short Seller's Scorecard".
 * A recap reel replays the lifecycle conveyor, the +100%/−∞ payoff line, and the
 * GME/VW spike signatures; a short-seller's checklist assembles; then a final SHORT/PASS
 * scenario is graded against the squeeze-fuel + asymmetry checklist. The embedded check
 * resolves on `reveal` (renderer emits it after the learner submits via QuizSpec).
 */
export default class CapstoneScene extends ModuleScene {
  private candlesKey = 'short_quiz_HOOD'
  private splitFrac = 0.4
  private shortInterest = 35
  private daysToCover = 1.5
  private worthShorting = true

  private candles: Candle[] = []
  private plot = { l: 430, r: 720, t: 280, b: 408 }
  private pmin = 0
  private pmax = 1
  private splitIdx = 0
  private chartG!: Phaser.GameObjects.Graphics
  private mask?: Phaser.GameObjects.Container
  private gradeText!: Phaser.GameObjects.Text

  protected build(): void {
    const p = this.params as CapstoneParams
    this.candlesKey = p.candlesKey ?? 'short_quiz_HOOD'
    this.splitFrac = p.splitFrac ?? 0.4
    this.shortInterest = p.shortInterest ?? 35
    this.daysToCover = p.daysToCover ?? 1.5
    this.worthShorting = p.worthShorting ?? true

    this.playRecapReel()
    this.buildChecklist()
    this.buildScenario()
    this.emitReady()
  }

  // --- Recap reel (three quick replays, top band) ---
  private playRecapReel(): void {
    // 1) lifecycle conveyor (borrow → sell → cover → return)
    const steps = ['Borrow', 'Sell high', 'Cover low', 'Return']
    steps.forEach((s, i) => {
      const x = 60 + i * 82
      const box = this.add.rectangle(x, 70, 74, 34, C.blueSoft).setStrokeStyle(1.5, C.blue)
      const t = this.label(x, 70, s, { size: 12, bold: true, col: C.blue, align: 'center' })
      box.setAlpha(0)
      t.setAlpha(0)
      this.tweens.add({ targets: [box, t], alpha: 1, duration: 280, delay: 200 + i * 220 })
    })
    this.label(60, 98, 'Profit = sell − buy back', { size: 12, col: C.muted })

    // 2) payoff line (+100% ceiling / −∞ tail), middle band
    this.time.delayedCall(1100, () => this.drawMiniPayoff())

    // 3) GME / VW spike signatures (normalized), right band
    this.time.delayedCall(1700, () => this.drawSpikeSignatures())
  }

  private drawMiniPayoff(): void {
    const ox = 180
    const oy = 130
    const w = 160
    const h = 70
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline)
    g.lineBetween(ox, oy, ox + w, oy) // zero
    // short payoff: flat ceiling left, dives right
    g.lineStyle(2, C.red, 1)
    g.beginPath()
    g.moveTo(ox, oy - 18)
    g.lineTo(ox + w * 0.45, oy)
    g.lineTo(ox + w, oy + h)
    g.strokePath()
    this.label(ox + w + 6, oy - 18, '+100%', { size: 12, col: C.green })
    this.label(ox + w + 6, oy + h, '−∞', { size: 12, bold: true, col: C.red })
    g.alpha = 0
    this.tweens.add({ targets: g, alpha: 1, duration: 400 })
  }

  private drawSpikeSignatures(): void {
    const ox = 430
    const oy = 130
    const w = 280
    const h = 90
    const g = this.add.graphics()
    g.lineStyle(1, C.hairline)
    g.lineBetween(ox, oy + h, ox + w, oy + h)
    // GME-style spike
    g.lineStyle(2, C.red, 1)
    g.beginPath()
    g.moveTo(ox, oy + h - 6)
    g.lineTo(ox + w * 0.5, oy + h - 12)
    g.lineTo(ox + w * 0.62, oy + 4)
    g.lineTo(ox + w * 0.8, oy + h - 30)
    g.strokePath()
    this.label(ox + w * 0.62, oy - 6, 'GME ~$483 (2021)', { size: 12, bold: true, col: C.red, align: 'center' })
    // VW-style spike (blue, offset)
    g.lineStyle(2, C.blue, 0.8)
    g.beginPath()
    g.moveTo(ox, oy + h - 10)
    g.lineTo(ox + w * 0.45, oy + h - 16)
    g.lineTo(ox + w * 0.58, oy + 18)
    g.lineTo(ox + w * 0.78, oy + h - 24)
    g.strokePath()
    this.label(ox + w * 0.2, oy + 10, 'VW Oct 2008', { size: 12, bold: true, col: C.blue })
    g.alpha = 0
    this.tweens.add({ targets: g, alpha: 1, duration: 400 })
  }

  // --- Checklist assembles line-by-line ---
  private buildChecklist(): void {
    const items = [
      'Borrow the shares first',
      'Subtract borrow fees and dividends',
      'Keep a stop ABOVE (loss has no limit)',
      'Avoid squeeze fuel (high short interest, thin float)',
      'Watch margin and lender recall',
    ]
    this.label(60, 235, "Short seller's checklist", { size: 13, bold: true, col: C.ink })
    items.forEach((it, i) => {
      const y = 260 + i * 26
      const check = this.label(60, y, '☑', { size: 14, col: C.green })
      const t = this.label(80, y, it, { size: 12, col: C.ink })
      check.setAlpha(0)
      t.setAlpha(0)
      this.tweens.add({ targets: [check, t], alpha: 1, duration: 240, delay: 2200 + i * 200 })
    })
  }

  // --- Final scored scenario (SHORT / PASS) ---
  private buildScenario(): void {
    this.candles = CANDLES[this.candlesKey] ?? []
    // Title on its own row; SHORT/PASS buttons on the next row so they never sit on the
    // title text. Chart sits below both.
    this.label(430, 230, 'Final call — short or pass?', { size: 13, bold: true, col: C.ink })
    this.label(430, 422, `Short interest ${this.shortInterest}% · Days-to-cover ${this.daysToCover}`, {
      size: 12,
      col: C.muted,
    })

    if (this.candles.length > 0) {
      let lo = Infinity
      let hi = -Infinity
      for (const c of this.candles) {
        lo = Math.min(lo, c.l)
        hi = Math.max(hi, c.h)
      }
      const pad = (hi - lo) * 0.08
      this.pmin = lo - pad
      this.pmax = hi + pad
      this.splitIdx = Math.floor(this.candles.length * this.splitFrac)
      this.chartG = this.add.graphics()
      this.drawScenarioChart(0, this.splitIdx)
      this.drawScenarioMask()
    }

    // SHORT / PASS buttons (own row, below the title and above the chart)
    this.button(500, 256, 'SHORT', () => this.pick('short'), { w: 90, h: 28, fill: C.red })
    this.button(600, 256, 'PASS', () => this.pick('pass'), { w: 90, h: 28, fill: C.muted })
    this.gradeText = this.label(60, 378, '', { size: 12, bold: true, col: C.ink, align: 'left' })
    this.gradeText.setOrigin(0, 0)
    this.gradeText.setWordWrapWidth(350)
  }

  private pick(d: 'short' | 'pass'): void {
    // grade against the checklist: worthShorting → SHORT is good; else PASS is good.
    const good = this.worthShorting ? d === 'short' : d === 'pass'
    this.gradeText.setText(
      good
        ? `Good call. ${this.worthShorting ? 'A fading stock with low squeeze risk and a stop above — a clean short.' : 'High short interest and a thin float are squeeze fuel — stepping aside is right.'}`
        : `Re-think. ${this.worthShorting ? 'This stock is fading with low squeeze risk — a careful short fits.' : 'This is squeeze fuel (high short interest, thin float) — shorting it risks the unlimited loss.'}`,
    )
    this.gradeText.setColor(hex(color(good ? C.green : C.red)))
  }

  // Embedded check reveal: expose the masked outcome of the scenario chart.
  protected onReveal(): void {
    if (this.candles.length === 0 || !this.mask) return
    this.tweens.add({
      targets: this.mask,
      alpha: 0,
      x: this.W,
      duration: 480,
      ease: 'Cubic.inOut',
      onComplete: () => this.mask?.destroy(),
    })
    this.time.delayedCall(200, () => this.drawScenarioChart(this.splitIdx, this.candles.length))
  }

  private xFor(i: number): number {
    const step = (this.plot.r - this.plot.l) / this.candles.length
    return this.plot.l + i * step + step / 2
  }
  private yFor(pr: number): number {
    const t = (pr - this.pmin) / (this.pmax - this.pmin)
    return this.plot.b - t * (this.plot.b - this.plot.t)
  }

  private drawScenarioChart(from: number, to: number): void {
    const bw = Math.max(1.2, ((this.plot.r - this.plot.l) / this.candles.length) * 0.6)
    for (let i = from; i < to; i++) {
      const c = this.candles[i]
      const up = c.c >= c.o
      const col = up ? C.green : C.red
      const x = this.xFor(i)
      this.chartG.lineStyle(1, col, 1)
      this.chartG.lineBetween(x, this.yFor(c.h), x, this.yFor(c.l))
      const yo = this.yFor(c.o)
      const yc = this.yFor(c.c)
      this.chartG.fillStyle(col, 1)
      this.chartG.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1.2, Math.abs(yc - yo)))
    }
  }

  private drawScenarioMask(): void {
    const x = this.xFor(this.splitIdx)
    const w = this.plot.r - x + 4
    const g = this.add.graphics()
    g.fillStyle(C.blueSoft, 0.95)
    g.fillRect(x, this.plot.t, w, this.plot.b - this.plot.t)
    g.lineStyle(2, C.blue, 0.6)
    g.strokeRect(x, this.plot.t, w, this.plot.b - this.plot.t)
    const q = this.label(x + w / 2, (this.plot.t + this.plot.b) / 2, '?', { size: 34, bold: true, col: C.blue, align: 'center' })
    q.setAlpha(0.5)
    this.mask = this.add.container(0, 0, [g, q])
  }
}
