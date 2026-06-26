import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtMoney, fmtPrice, fmtShares, walkBuy, type Level } from './book'

interface CapstoneParams {
  asks?: Level[]
  bid?: number
  target?: number
  marketClip?: number
  limitClip?: number
}

const DEFAULT_ASKS: Level[] = [
  { price: 100.01, size: 300 },
  { price: 100.03, size: 300 },
  { price: 100.05, size: 400 },
  { price: 100.08, size: 600 },
  { price: 100.12, size: 800 },
]

/**
 * MODULE 15 — CAPSTONE "Trade the Tape". A live, churning book + a BUY 1,000 target.
 * The learner fills it with any mix of:
 *   • MARKET clip  — crosses now, walks the current asks (slippage shown on the tape),
 *   • REST LIMIT   — rests shares at the bid; fills when a sell-initiated churn tick
 *                    comes down to the bid (capturing the spread, no slippage).
 * A live scorecard tracks shares filled, realized avg fill, and cost vs mid. The book
 * replenishes/churns so the optimal play is "rest limits + small market clips."
 *
 * The all-market BASELINE (walk the whole 1,000 at once) is computed up front and kept
 * MASKED until the embedded Yes/No check ("did you beat the baseline?"). The scene grades
 * that check against the learner's ACTUAL realized average (deterministic per run), shows
 * the verdict, then a 3-shot recap reel. No React quiz is attached (the capstone footer
 * is the plain Finish button); the check + grading live entirely here, per spec §6 M15.
 */
export default class CapstoneScene extends ModuleScene {
  private asks: Level[] = []
  private bid = 100.0
  private mid = 100.0
  private target = 1000
  private marketClip = 200
  private limitClip = 250

  private filled = 0
  private notional = 0
  private baselineAvg = NaN

  private restingLimit = 0
  private restingPrice = 0

  private churnTimer?: Phaser.Time.TimerEvent
  private nextIsSell = true
  private done = false
  private checkPhase = false

  // ladder geometry
  private readonly cx = 175
  private readonly rowH = 28
  private readonly askTop = 90
  private readonly maxBarW = 170
  private maxSize = 1
  private ladderG!: Phaser.GameObjects.Graphics

  // tape
  private tapeX = 360
  private tapeY = 70
  private tapeLines: Phaser.GameObjects.Text[] = []

  // scorecard
  private sc: Record<string, Phaser.GameObjects.Text> = {}
  private restText!: Phaser.GameObjects.Text

  protected build(): void {
    const p = this.params as CapstoneParams
    this.asks = (p.asks ?? DEFAULT_ASKS).slice().sort((a, b) => a.price - b.price)
    this.bid = p.bid ?? 100.0
    this.target = p.target ?? 1000
    this.marketClip = p.marketClip ?? 200
    this.limitClip = p.limitClip ?? 250
    this.mid = (this.asks[0].price + this.bid) / 2
    this.maxSize = Math.max(...this.asks.map((l) => l.size))

    // baseline = all-market walk of the full target on the opening book
    this.baselineAvg = walkBuy(this.asks, this.target).avgFill

    this.label(this.W / 2, 24, 'Buy 1,000 shares as cheaply as you can — rest limits to save, take the rest at market', {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated live book — math exact', { size: 11, col: C.blue }).setAlpha(0.8)

    this.ladderG = this.add.graphics()
    this.drawLadder()
    this.drawTape()
    this.buildScorecard()
    this.buildControls()
    this.startChurn()

    this.emitReady()
  }

  // --- book churn ----------------------------------------------------------
  private startChurn(): void {
    this.churnTimer = this.time.addEvent({
      delay: 750,
      loop: true,
      callback: () => this.churn(),
    })
  }

  private churn(): void {
    if (this.done) return
    // alternate a tiny buy/sell pressure; the touch flickers but mid holds.
    // a sell-initiated tick fills any resting limit at the bid.
    if (this.nextIsSell && this.restingLimit > 0) {
      const fillNow = Math.min(this.restingLimit, this.limitClip)
      this.restingLimit -= fillNow
      this.recordFill(fillNow, this.restingPrice, 'LIMIT', C.green)
    }
    this.nextIsSell = !this.nextIsSell
    // gently replenish the touch so the learner always has depth to clip
    if (this.asks[0].size < 150) this.asks[0].size += 100
    this.drawLadder()
  }

  // --- rendering -----------------------------------------------------------
  private barW(size: number): number {
    return 30 + (Math.min(size, this.maxSize) / this.maxSize) * (this.maxBarW - 30)
  }

  private drawLadder(): void {
    this.ladderG.clear()
    const left = this.cx - this.maxBarW / 2
    const ordered = this.asks.slice().sort((a, b) => b.price - a.price)
    ordered.forEach((lvl, i) => {
      const y = this.askTop + i * this.rowH + this.rowH / 2
      const w = this.barW(lvl.size)
      this.ladderG.fillStyle(C.redSoft, 1)
      this.ladderG.fillRoundedRect(left, y - this.rowH / 2 + 3, w, this.rowH - 6, 4)
      this.ladderG.lineStyle(1.2, C.red, 1)
      this.ladderG.strokeRoundedRect(left, y - this.rowH / 2 + 3, w, this.rowH - 6, 4)
    })
    // spread gap + bid rung
    const gapY = this.askTop + ordered.length * this.rowH + 6
    this.ladderG.fillStyle(C.blueSoft, 1)
    this.ladderG.fillRoundedRect(left - 4, gapY - 10, this.maxBarW + 8, 20, 5)
    const bidY = gapY + 28
    this.ladderG.fillStyle(C.greenSoft, 1)
    this.ladderG.fillRoundedRect(left, bidY - this.rowH / 2 + 3, this.barW(600), this.rowH - 6, 4)
    this.ladderG.lineStyle(1.2, C.green, 1)
    this.ladderG.strokeRoundedRect(left, bidY - this.rowH / 2 + 3, this.barW(600), this.rowH - 6, 4)
    // resting limit overlay (blue) on the bid
    if (this.restingLimit > 0) {
      this.ladderG.fillStyle(C.blue, 0.85)
      this.ladderG.fillRoundedRect(left, bidY - this.rowH / 2 + 5, this.barW(this.restingLimit), this.rowH - 10, 3)
    }
    this.restingPrice = this.bid

    // labels (redrawn cheaply via persistent texts would be better; keep light)
    this.drawLadderLabels(ordered, gapY, bidY)
  }

  private ladderLabels: Phaser.GameObjects.GameObject[] = []
  private drawLadderLabels(ordered: Level[], gapY: number, bidY: number): void {
    // Labels are redrawn each churn tick, so destroy the previous set (text + chips)
    // before adding a new one — never let them stack.
    this.ladderLabels.forEach((t) => t.destroy())
    this.ladderLabels = []
    const left = this.cx - this.maxBarW / 2
    const push = (t: Phaser.GameObjects.Text, chip = false) => {
      if (chip) this.ladderLabels.push(this.chipBehind(t))
      this.ladderLabels.push(t)
    }
    ordered.forEach((lvl, i) => {
      const y = this.askTop + i * this.rowH + this.rowH / 2
      push(this.label(left + 6, y, fmtPrice(lvl.price), { size: 13, col: C.red, bold: true }), true)
      push(this.label(left + this.maxBarW + 8, y, fmtShares(lvl.size), { size: 12, col: C.ink }))
    })
    push(this.label(this.cx, gapY, 'spread', { size: 12, col: C.blue, align: 'center', bold: true }))
    push(this.label(left + 6, bidY, `${fmtPrice(this.bid)}`, { size: 13, col: C.green, bold: true }), true)
    if (this.restingLimit > 0) {
      push(this.label(left + this.maxBarW + 8, bidY, `${fmtShares(this.restingLimit)} resting`, { size: 12, col: C.blue, bold: true }))
    }
  }

  private drawTape(): void {
    this.panel(this.tapeX, this.tapeY - 22, 210, 200, { fill: C.gray100, stroke: C.hairline, radius: 8 })
    this.label(this.tapeX + 12, this.tapeY - 4, 'Your prints', { size: 12, col: C.muted, bold: true })
  }

  private addTape(text: string, col: number): void {
    const t = this.label(this.tapeX + 14, 0, text, { size: 13, col, bold: true })
    this.tapeLines.unshift(t)
    if (this.tapeLines.length > 7) {
      this.tapeLines.pop()?.destroy()
    }
    this.tapeLines.forEach((line, i) => line.setY(this.tapeY + 20 + i * 22))
  }

  private buildScorecard(): void {
    const px = 588
    const py = 66
    this.panel(px, py, 164, 232, { fill: C.blueSoft, stroke: C.blue, radius: 10 })
    this.label(px + 12, py + 16, 'Scorecard', { size: 13, col: C.blue, bold: true })
    // One stat per row: label left, value right-aligned. Short labels keep both at
    // ≥12px inside the narrow panel with no collision.
    const mk = (key: string, y: number, lbl: string) => {
      this.label(px + 12, py + y, lbl, { size: 12, col: C.muted })
      this.sc[key] = this.label(px + 152, py + y, '—', { size: 13, col: C.ink, bold: true, align: 'right' })
    }
    mk('filled', 46, 'Filled')
    mk('avg', 80, 'Avg fill')
    mk('cost', 114, 'Cost vs mid')
    mk('base', 148, 'Baseline')
    this.sc.base.setText('? masked')
    this.sc.base.setColor(hex(C.blue))
    mk('pct', 182, '% filled')
    this.updateScorecard()
  }

  private buildControls(): void {
    this.button(this.cx, 320, `MARKET clip ${this.marketClip}`, () => this.marketClipBuy(), { w: 200, h: 38, fill: C.red })
    this.button(this.cx, 366, `REST LIMIT ${this.limitClip} @ bid`, () => this.restLimit(), { w: 200, h: 38, fill: C.blue })
    this.restText = this.label(this.cx, 404, '', { size: 12, col: C.muted, align: 'center' })
    this.restText.setWordWrapWidth(340)
    this.button(560, 320, 'Reset', () => this.resetRun(), { w: 110, h: 32, fill: C.muted })
    this.checkBtn = this.button(560, 372, 'Finish & grade', () => this.startCheck(), { w: 150, h: 38, fill: C.green })
    this.setFinishEnabled(false)
  }

  private checkBtn!: Phaser.GameObjects.Container
  private setFinishEnabled(on: boolean): void {
    this.checkBtn.setAlpha(on ? 1 : 0.4)
    ;(this.checkBtn as Phaser.GameObjects.Container).disableInteractive()
    if (on) this.checkBtn.setInteractive({ useHandCursor: true })
  }

  // --- actions -------------------------------------------------------------
  private remaining(): number {
    return Math.max(0, this.target - this.filled - this.restingLimit)
  }

  private marketClipBuy(): void {
    if (this.done) return
    const want = Math.min(this.marketClip, this.remaining())
    if (want <= 0) return
    const r = walkBuy(this.asks, want)
    // consume the asks
    let need = r.filled
    for (const lvl of this.asks) {
      if (need <= 0) break
      const take = Math.min(need, lvl.size)
      lvl.size -= take
      need -= take
    }
    this.asks = this.asks.filter((l) => l.size > 0)
    if (this.asks.length === 0) this.asks.push({ price: 100.15, size: 800 })
    this.recordFill(r.filled, r.avgFill, 'MARKET', r.slippagePerShare > 0 ? C.red : C.green)
    this.drawLadder()
  }

  private restLimit(): void {
    if (this.done) return
    const want = Math.min(this.limitClip, this.remaining())
    if (want <= 0) return
    this.restingLimit += want
    this.restText.setText(`${fmtShares(this.restingLimit)} resting at the bid — fills as sellers come down`)
    this.drawLadder()
  }

  private recordFill(shares: number, price: number, kind: string, col: number): void {
    if (shares <= 0) return
    this.filled += shares
    this.notional += shares * price
    this.addTape(`${kind} ${fmtShares(shares)} @ ${fmtPrice(price)}`, col)
    this.updateScorecard()
    if (this.filled >= this.target) this.setFinishEnabled(true)
  }

  private updateScorecard(): void {
    const avg = this.filled > 0 ? this.notional / this.filled : NaN
    this.sc.filled.setText(`${fmtShares(this.filled)} / ${fmtShares(this.target)}`)
    this.sc.avg.setText(isFinite(avg) ? fmtPrice(avg, 3) : '—')
    const cost = isFinite(avg) ? (avg - this.mid) * this.filled : 0
    this.sc.cost.setText(fmtMoney(cost, 2))
    this.sc.cost.setColor(hex(cost > 0 ? C.red : C.green))
    this.sc.pct.setText(`${Math.round((this.filled / this.target) * 100)}%`)
  }

  private resetRun(): void {
    if (this.checkPhase) return
    const src = (this.params as CapstoneParams).asks ?? DEFAULT_ASKS
    this.asks = src.map((l) => ({ ...l })).sort((a, b) => a.price - b.price)
    this.filled = 0
    this.notional = 0
    this.restingLimit = 0
    this.tapeLines.forEach((t) => t.destroy())
    this.tapeLines = []
    this.restText.setText('')
    this.setFinishEnabled(false)
    this.updateScorecard()
    this.drawLadder()
  }

  // --- embedded check + recap ---------------------------------------------
  private startCheck(): void {
    if (this.filled < this.target || this.checkPhase) return
    this.checkPhase = true
    this.done = true
    this.churnTimer?.remove()

    // dim the sim, show the masked question overlay
    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, C.white, 0.86).setDepth(20)
    const realized = this.notional / this.filled
    this.label(this.W / 2, 120, 'Before the score unmasks:', { size: 13, col: C.muted, align: 'center' }).setDepth(21)
    this.label(this.W / 2, 150, 'Did your average price beat buying it all at market?', {
      size: 16,
      col: C.ink,
      align: 'center',
      bold: true,
    }).setDepth(21)

    const yes = this.button(this.W / 2 - 90, 210, 'Yes — I beat it', () => this.gradeCheck(true, realized), { w: 160, fill: C.green })
    const no = this.button(this.W / 2 + 90, 210, 'No — I did not', () => this.gradeCheck(false, realized), { w: 160, fill: C.red })
    yes.setDepth(21)
    no.setDepth(21)
    this.checkButtons = [yes, no]
  }

  private checkButtons: Phaser.GameObjects.Container[] = []
  private gradeCheck(answeredYes: boolean, realized: number): void {
    this.checkButtons.forEach((b) => b.destroy())
    const beat = realized < this.baselineAvg // ties = did not beat
    const correct = answeredYes === beat

    // unmask baseline in the scorecard
    this.sc.base.setText(fmtPrice(this.baselineAvg, 3))
    this.sc.base.setColor(hex(C.ink))

    const col = correct ? C.green : C.red
    this.panel(this.W / 2 - 230, 250, 460, 120, { fill: correct ? C.greenSoft : C.redSoft, stroke: col, radius: 12 }).setDepth(21)
    this.label(this.W / 2, 274, correct ? 'Correct!' : 'Not quite.', { size: 16, col, align: 'center', bold: true }).setDepth(21)
    const gap = Math.abs(realized - this.baselineAvg)
    const gapCents = gap * 100
    const verdict = beat
      ? `You beat it: realized ${fmtPrice(realized, 3)} vs baseline ${fmtPrice(this.baselineAvg, 3)} — ${gapCents.toFixed(1)}¢/sh cheaper (${fmtMoney(gap * this.filled, 2)}). Resting limits captured the spread instead of paying it.`
      : `You didn't beat it: realized ${fmtPrice(realized, 3)} vs baseline ${fmtPrice(this.baselineAvg, 3)}. Large market clips walked the book to worse rungs; resting more at the bid would have saved the spread.`
    this.label(this.W / 2, 326, verdict, { size: 12, col: C.ink, align: 'center' }).setWordWrapWidth(430).setDepth(21)

    this.time.delayedCall(600, () => this.recapReel())
  }

  private recapReel(): void {
    const shots = ['Spread = ask − bid', 'Limit rests · Market crosses', 'Size walks the book → slippage']
    // ONE persistent chip-backed text cycled through the recap lines — never a fresh
    // text per shot (which would pile overlapping labels at the same spot). The chip
    // graphic is rebuilt each line (text width changes) and the old one destroyed.
    const y = 410
    const chip = this.label(this.W / 2, y, shots[0], { size: 14, col: C.blue, align: 'center', bold: true })
      .setDepth(22)
      .setAlpha(0)
    let bg: Phaser.GameObjects.Graphics | undefined
    const cycle = (i: number) => {
      chip.setText(shots[i])
      bg?.destroy()
      bg = this.chipBehind(chip, C.blueSoft).setDepth(21).setAlpha(0)
      this.tweens.add({
        targets: [chip, bg],
        alpha: 1,
        duration: 300,
        yoyo: true,
        hold: 350,
        onComplete: () => {
          if (i < shots.length - 1) this.time.delayedCall(80, () => cycle(i + 1))
        },
      })
    }
    cycle(0)
  }
}
