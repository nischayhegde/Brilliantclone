import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'
import { intrinsic, moneyness, type OptType } from './optionMath'

interface PremiumBarParams {
  mode?: 'interactive' | 'quiz' | 'challenge'
  type?: OptType
  K?: number
  /** starting spot. */
  S?: number
  /** illustrative TOTAL premium (used for the time-value remainder). For interactive
   * we model time value with a deterministic curve so the split always reads cleanly. */
  premium?: number
  sMin?: number
  sMax?: number
  /** quiz: the fixed numbers to reveal. */
  quizIntrinsic?: number
  quizTimeValue?: number
}

const AXIS_Y = 380
const BAR_X = 470
const BAR_W = 80
const SCALE = 13 // px per $ of premium height

/**
 * PremiumBarScene — premium = intrinsic (solid blue) + time value (light blue).
 * Module 5: drag S across the strike, toggle CALL/PUT, watch the split + moneyness.
 * Module 6: a masked single-block premium that SPLITS into 7/2 on reveal.
 */
export default class PremiumBarScene extends ModuleScene {
  private p!: Required<Omit<PremiumBarParams, 'quizIntrinsic' | 'quizTimeValue'>> & PremiumBarParams
  private type: OptType = 'call'
  private S = 100
  private revealed = false

  private barIntrinsic!: Phaser.GameObjects.Graphics
  private barTime!: Phaser.GameObjects.Graphics
  private intrLabel!: Phaser.GameObjects.Text
  private timeLabel!: Phaser.GameObjects.Text
  private totalLabel!: Phaser.GameObjects.Text
  private moneyTag!: Phaser.GameObjects.Container

  protected build(): void {
    const raw = this.params as PremiumBarParams
    this.p = {
      ...raw,
      mode: raw.mode ?? 'interactive',
      type: raw.type ?? 'call',
      K: raw.K ?? 100,
      S: raw.S ?? 100,
      premium: raw.premium ?? 3,
      sMin: raw.sMin ?? 70,
      sMax: raw.sMax ?? 130,
    }
    this.type = this.p.type
    this.S = this.p.S

    this.label(40, 28, 'PREMIUM = INTRINSIC + TIME VALUE', { size: 14, col: C.ink, bold: true })
    this.label(40, 48, '(time-value numbers illustrative; intrinsic math exact)', { size: 11, col: C.muted })

    // axis baseline for the bar
    const g = this.add.graphics()
    g.lineStyle(1.5, C.gray200)
    g.lineBetween(BAR_X - 30, AXIS_Y, BAR_X + BAR_W + 60, AXIS_Y)

    this.barIntrinsic = this.add.graphics()
    this.barTime = this.add.graphics()
    this.intrLabel = this.label(BAR_X + BAR_W + 12, 0, '', { size: 12, col: C.blue, bold: true })
    this.timeLabel = this.label(BAR_X + BAR_W + 12, 0, '', { size: 12, col: C.blue })
    this.totalLabel = this.label(BAR_X + BAR_W / 2, AXIS_Y + 16, '', { size: 12, col: C.ink, bold: true, align: 'center' })

    if (this.p.mode === 'quiz') this.buildQuiz()
    else if (this.p.mode === 'challenge') this.buildChallenge()
    else this.buildInteractive()
    this.emitReady()
  }

  // illustrative deterministic time value: peaks at the money, shrinks deep ITM/OTM
  private timeValue(): number {
    const dist = Math.abs(this.S - this.p.K)
    const tv = this.p.premium * Math.exp(-(dist * dist) / (2 * 18 * 18))
    return Math.max(0.2, tv)
  }

  private drawBar(intr: number, tv: number, animate = false): void {
    this.barIntrinsic.clear()
    this.barTime.clear()
    const intrH = intr * SCALE
    const tvH = tv * SCALE
    // intrinsic (solid blue) at bottom
    this.barIntrinsic.fillStyle(C.blue, 1)
    this.barIntrinsic.fillRect(BAR_X, AXIS_Y - intrH, BAR_W, intrH)
    // time value (light/translucent blue) on top
    this.barTime.fillStyle(C.blue, 0.28)
    this.barTime.fillRect(BAR_X, AXIS_Y - intrH - tvH, BAR_W, tvH)
    this.barTime.lineStyle(1, C.blue, 0.5)
    this.barTime.strokeRect(BAR_X, AXIS_Y - intrH - tvH, BAR_W, tvH)

    this.intrLabel.setText(`intrinsic ${intr.toFixed(2)}`)
    this.intrLabel.setY(AXIS_Y - intrH / 2)
    this.timeLabel.setText(`time value ${tv.toFixed(2)}`)
    this.timeLabel.setY(AXIS_Y - intrH - tvH / 2)
    this.totalLabel.setText(`premium ${(intr + tv).toFixed(2)}`)
    if (animate) {
      this.barIntrinsic.setAlpha(0)
      this.barTime.setAlpha(0)
      this.tweens.add({ targets: [this.barIntrinsic, this.barTime], alpha: 1, duration: 400 })
    }
  }

  // --- interactive: number line for S + CALL/PUT toggle ---------------------
  private buildInteractive(): void {
    const lineY = 200
    const lx = 60
    const lw = 320
    const g = this.add.graphics()
    g.lineStyle(2, C.gray200)
    g.lineBetween(lx, lineY, lx + lw, lineY)
    // strike tick
    const xK = lx + ((this.p.K - this.p.sMin) / (this.p.sMax - this.p.sMin)) * lw
    g.lineStyle(2, C.blue)
    g.lineBetween(xK, lineY - 14, xK, lineY + 14)
    this.label(xK, lineY - 24, `K=${this.p.K}`, { size: 11, col: C.blue, bold: true, align: 'center' })
    // end labels
    this.label(lx, lineY + 22, `${this.p.sMin}`, { size: 10, col: C.muted, align: 'center' })
    this.label(lx + lw, lineY + 22, `${this.p.sMax}`, { size: 10, col: C.muted, align: 'center' })

    // draggable S marker
    const dot = this.add.circle(0, lineY, 9, C.ink).setStrokeStyle(3, C.white)
    const sTxt = this.label(0, lineY + 26, '', { size: 12, col: C.ink, bold: true, align: 'center' })
    const place = (S: number) => {
      const x = lx + ((S - this.p.sMin) / (this.p.sMax - this.p.sMin)) * lw
      dot.setX(x)
      sTxt.setX(x).setText(`S=${S.toFixed(0)}`)
    }
    dot.setInteractive({ useHandCursor: true, draggable: true })
    this.input.setDraggable(dot)
    dot.on('drag', (_pp: Phaser.Input.Pointer, dx: number) => {
      const t = Phaser.Math.Clamp((dx - lx) / lw, 0, 1)
      this.S = this.p.sMin + t * (this.p.sMax - this.p.sMin)
      place(this.S)
      this.refresh()
    })
    place(this.S)
    this.label(60, lineY + 50, '↔ drag S across the strike', { size: 10, col: C.muted })

    // CALL/PUT toggle
    this.toggle(120, 290, ['CALL', 'PUT'], 0, (i) => {
      this.type = i === 0 ? 'call' : 'put'
      this.refresh()
    })

    // moneyness tag
    this.moneyTag = this.makeTag(120, 340, 'ATM')
    this.refresh()
  }

  private refresh(): void {
    const intr = intrinsic(this.type, this.S, this.p.K)
    this.drawBar(intr, this.timeValue())
    const m = moneyness(this.type, this.S, this.p.K)
    this.setTag(this.moneyTag, m)
  }

  // --- challenge: DRAG the split point to divide the premium -----------------
  private chSubmitted = false
  private splitFrac = 0.5 // fraction of the bar that is intrinsic (from the bottom)
  private splitLine!: Phaser.GameObjects.Graphics
  private splitHandle!: Phaser.GameObjects.Arc
  private splitIntrLabel!: Phaser.GameObjects.Text
  private splitTimeLabel!: Phaser.GameObjects.Text

  private get chTotalH(): number {
    return this.p.premium * SCALE
  }

  private buildChallenge(): void {
    // hide the deterministic interactive labels — this bar is fully learner-driven
    this.intrLabel.setAlpha(0)
    this.timeLabel.setAlpha(0)

    this.label(60, 150, `CALL · strike ${this.p.K} · stock at ${this.p.S}`, { size: 14, col: C.ink, bold: true })
    this.label(60, 174, `The ${this.p.premium.toFixed(2)} premium — split it into real value vs time value.`, {
      size: 12,
      col: C.muted,
    })

    // single outlined block representing the whole premium
    const totalH = this.chTotalH
    const outline = this.add.graphics()
    outline.lineStyle(1.5, C.blue)
    outline.strokeRect(BAR_X, AXIS_Y - totalH, BAR_W, totalH)
    this.label(BAR_X + BAR_W / 2, AXIS_Y + 16, `premium ${this.p.premium.toFixed(2)}`, {
      size: 12,
      col: C.ink,
      bold: true,
      align: 'center',
    })

    // live segments + split handle
    this.splitLine = this.add.graphics()
    this.splitIntrLabel = this.label(BAR_X + BAR_W + 12, 0, '', { size: 12, col: C.blue, bold: true })
    this.splitTimeLabel = this.label(BAR_X + BAR_W + 12, 0, '', { size: 12, col: C.blue })

    this.splitHandle = this.add
      .circle(BAR_X + BAR_W / 2, 0, 9, C.ink)
      .setStrokeStyle(3, C.white)
      .setInteractive({ useHandCursor: true, draggable: true })
    this.input.setDraggable(this.splitHandle)
    this.splitHandle.on('drag', (_pp: Phaser.Input.Pointer, _dx: number, dy: number) => {
      if (this.chSubmitted) return
      // dy is the pointer's game-y; clamp to the bar, convert to intrinsic fraction
      const top = AXIS_Y - totalH
      const yy = Phaser.Math.Clamp(dy, top, AXIS_Y)
      this.splitFrac = (AXIS_Y - yy) / totalH
      this.redrawSplit()
    })
    this.redrawSplit()
    this.label(60, 230, '↕ drag the divider: below = intrinsic (real), above = time value', {
      size: 10,
      col: C.muted,
    })
    this.setCanSubmit(true)
  }

  private redrawSplit(): void {
    const totalH = this.chTotalH
    const intrH = this.splitFrac * totalH
    const tvH = totalH - intrH
    const splitY = AXIS_Y - intrH
    const intrVal = this.splitFrac * this.p.premium
    const tvVal = this.p.premium - intrVal

    this.barIntrinsic.clear()
    this.barTime.clear()
    // intrinsic (solid blue) at bottom
    this.barIntrinsic.fillStyle(C.blue, 1)
    this.barIntrinsic.fillRect(BAR_X, splitY, BAR_W, intrH)
    // time value (light blue) on top
    this.barTime.fillStyle(C.blue, 0.28)
    this.barTime.fillRect(BAR_X, AXIS_Y - totalH, BAR_W, tvH)

    this.splitLine.clear()
    this.splitLine.lineStyle(2, C.ink)
    this.splitLine.lineBetween(BAR_X - 6, splitY, BAR_X + BAR_W + 6, splitY)
    this.splitHandle.setY(splitY)

    this.splitIntrLabel.setText(`intrinsic ${intrVal.toFixed(2)}`).setY(AXIS_Y - intrH / 2)
    this.splitTimeLabel.setText(`time value ${tvVal.toFixed(2)}`).setY(AXIS_Y - intrH - tvH / 2)
  }

  protected onSubmit(): void {
    if (this.p.mode !== 'challenge' || this.chSubmitted) return
    this.chSubmitted = true
    this.setCanSubmit(false)

    const trueIntr = intrinsic(this.type, this.p.S, this.p.K) // exact: max(S−K,0)
    const trueTv = this.p.premium - trueIntr
    const guessIntr = this.splitFrac * this.p.premium
    const tol = 0.5 // within $0.50 of the exact intrinsic
    const correct = Math.abs(guessIntr - trueIntr) <= tol

    // snap the divider to the exact split and label the math
    this.splitFrac = trueIntr / this.p.premium
    this.redrawSplit()
    this.splitHandle.setFillStyle(correct ? C.green : C.red)
    this.label(BAR_X - 30, AXIS_Y - trueIntr * SCALE - 6, `max(${this.p.S}−${this.p.K},0)=${trueIntr.toFixed(0)}`, {
      size: 11,
      col: C.blue,
      bold: true,
      align: 'right',
    })

    const title = correct
      ? `Intrinsic ${trueIntr.toFixed(2)} · time ${trueTv.toFixed(2)} — correct`
      : `It splits ${trueIntr.toFixed(2)} / ${trueTv.toFixed(2)} (you said ${guessIntr.toFixed(2)} intrinsic)`
    const detail = correct
      ? `Call intrinsic = max(S−K,0) = max(${this.p.S}−${this.p.K},0) = ${trueIntr.toFixed(
          2,
        )}. The remaining ${this.p.premium.toFixed(2)} − ${trueIntr.toFixed(2)} = ${trueTv.toFixed(
          2,
        )} is time (extrinsic) value — what you pay for the chance the stock climbs further before expiry.`
      : `Intrinsic is the in-the-money part only: max(S−K,0) = max(${this.p.S}−${this.p.K},0) = ${trueIntr.toFixed(
          2,
        )}, so time value is ${this.p.premium.toFixed(2)} − ${trueIntr.toFixed(2)} = ${trueTv.toFixed(
          2,
        )}. The whole premium isn't "real" value, and an ITM call isn't all time value either — only ${trueTv.toFixed(
          2,
        )} of it decays away.`
    this.report(correct, title, detail)
  }

  // --- quiz: masked premium bar -> 7/2 split --------------------------------
  private mask?: Phaser.GameObjects.Graphics
  private buildQuiz(): void {
    const intr = this.p.quizIntrinsic ?? intrinsic(this.type, this.S, this.p.K)
    const tv = this.p.quizTimeValue ?? this.p.premium - intr
    // draw the real split underneath, then cover with a grey "premium 9.00" block
    this.drawBar(intr, tv)
    const totalH = (intr + tv) * SCALE
    this.mask = this.add.graphics()
    this.mask.fillStyle(C.gray200, 1)
    this.mask.fillRect(BAR_X, AXIS_Y - totalH, BAR_W, totalH)
    this.mask.lineStyle(1.5, C.muted)
    this.mask.strokeRect(BAR_X, AXIS_Y - totalH, BAR_W, totalH)
    this.add
      .text(BAR_X + BAR_W / 2, AXIS_Y - totalH / 2, `premium\n${(intr + tv).toFixed(2)}`, {
        fontFamily: FONT,
        fontSize: '13px',
        color: hex(C.ink),
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setData('isMaskTxt', true)
    // hide the live split labels until reveal
    this.intrLabel.setAlpha(0)
    this.timeLabel.setAlpha(0)

    // setup labels
    this.label(60, 150, `CALL · strike ${this.p.K} · stock at ${this.S}`, { size: 14, col: C.ink, bold: true })
    this.label(60, 174, 'How does the 9.00 premium split?', { size: 12, col: C.muted })
  }

  protected onReveal(): void {
    if (this.revealed || this.p.mode !== 'quiz') return
    this.revealed = true
    // peel the mask up and away
    this.children.list.filter((o) => o.getData?.('isMaskTxt')).forEach((o) => o.destroy())
    if (this.mask) {
      this.tweens.add({
        targets: this.mask,
        alpha: 0,
        y: -40,
        duration: 500,
        ease: 'Cubic.inOut',
        onComplete: () => this.mask?.destroy(),
      })
    }
    this.tweens.add({ targets: [this.intrLabel, this.timeLabel], alpha: 1, duration: 400, delay: 200 })
    const intr = this.p.quizIntrinsic ?? 7
    this.time.delayedCall(260, () => {
      this.label(BAR_X - 30, AXIS_Y - intr * SCALE - 6, `max(${this.S}−${this.p.K},0)=${intr}`, {
        size: 11,
        col: C.blue,
        bold: true,
        align: 'right',
      })
    })
  }

  // --- small toggle + tag helpers -------------------------------------------
  private toggle(x: number, y: number, labels: string[], start: number, onPick: (i: number) => void): void {
    const segW = 64
    const h = 28
    const bg = this.add.graphics()
    bg.fillStyle(C.gray100, 1)
    bg.fillRoundedRect(x, y - h / 2, segW * labels.length, h, 8)
    const hi = this.add.graphics()
    const texts: Phaser.GameObjects.Text[] = []
    const draw = (active: number) => {
      hi.clear()
      hi.fillStyle(C.blue, 1)
      hi.fillRoundedRect(x + active * segW, y - h / 2, segW, h, 8)
      texts.forEach((t, i) => t.setColor(i === active ? hex(C.white) : hex(C.muted)))
    }
    labels.forEach((lab, i) => {
      const t = this.add
        .text(x + i * segW + segW / 2, y, lab, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      t.on('pointerup', () => {
        draw(i)
        onPick(i)
      })
      texts.push(t)
    })
    draw(start)
  }

  private makeTag(x: number, y: number, text: string): Phaser.GameObjects.Container {
    const panel = this.panel(0, 0, 120, 30, { fill: C.blueSoft, stroke: C.blue, radius: 8 })
    const t = this.add
      .text(60, 15, text, { fontFamily: FONT, fontSize: '14px', color: hex(C.blue), fontStyle: 'bold' })
      .setOrigin(0.5)
    return this.add.container(x, y, [panel, t])
  }

  private setTag(c: Phaser.GameObjects.Container, text: string): void {
    const t = c.list[1] as Phaser.GameObjects.Text
    t.setText(text)
  }
}
