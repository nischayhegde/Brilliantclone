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
const SCALE = 13 // default px per $ of premium height (challenge/quiz)
const BAR_TOP = 96 // bars never climb above this y (keeps them inside the canvas)

/**
 * PremiumBarScene — a premium is a ticket price: FACE VALUE (the real, intrinsic
 * part, solid) + a SCALPER'S HYPE MARKUP (time value, translucent), split by a
 * perforation line that slides live as the spot crosses the strike.
 * Module 4 (interactive): drag S across K, toggle CALL/PUT, watch the split + moneyness.
 * Module 5 (challenge): drag the divider to split a fixed premium yourself.
 * Quiz mode: a masked premium that splits open on reveal.
 * Intrinsic math is exact; time value is an illustrative, labelled curve.
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
  // interactive-only live explainer
  private note?: Phaser.GameObjects.Text
  /** px per $ — computed so the tallest possible bar fits between BAR_TOP and AXIS_Y. */
  private sy = SCALE

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

    // Dynamic vertical scale: the intrinsic leg can be as tall as the largest
    // in-the-money distance across the draggable range, so size px-per-$ to the
    // worst case (plus the time-value cap) and never let the bar leave the canvas.
    const maxIntrinsic = Math.max(this.p.sMax - this.p.K, this.p.K - this.p.sMin, 0)
    const worstTotal =
      this.p.mode === 'interactive' ? maxIntrinsic + this.p.premium : this.p.premium
    const avail = AXIS_Y - BAR_TOP
    this.sy = worstTotal > 0 ? Math.min(SCALE, avail / worstTotal) : SCALE

    this.label(40, 26, 'PRICE = REAL VALUE + TIME VALUE', { size: this.fs(16), col: C.ink, bold: true })
    this.label(40, 48, '(time value illustrative)', { size: this.fs(13), col: C.muted })

    // axis baseline for the bar
    const g = this.add.graphics()
    g.lineStyle(1.5, C.gray200)
    g.lineBetween(BAR_X - 30, AXIS_Y, BAR_X + BAR_W + 60, AXIS_Y)

    this.barIntrinsic = this.add.graphics()
    this.barTime = this.add.graphics()
    this.intrLabel = this.label(BAR_X + BAR_W + 12, 0, '', { size: this.fs(13), col: C.blueDark, bold: true })
    this.timeLabel = this.label(BAR_X + BAR_W + 12, 0, '', { size: this.fs(13), col: C.blue })
    this.totalLabel = this.label(BAR_X + BAR_W / 2, AXIS_Y + 18, '', { size: this.fs(13), col: C.ink, bold: true, align: 'center' })

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

  /** Draw the stacked "ticket": face value (intrinsic, solid) + hype markup (time, translucent). */
  private drawBar(intr: number, tv: number, animate = false): void {
    this.barIntrinsic.clear()
    this.barTime.clear()
    const intrH = intr * this.sy
    const tvH = tv * this.sy
    const boundaryY = AXIS_Y - intrH
    // face value (intrinsic) — solid blue at the bottom
    this.barIntrinsic.fillStyle(C.blue, 1)
    this.barIntrinsic.fillRect(BAR_X, boundaryY, BAR_W, intrH)
    // hype markup (time value) — light/translucent blue on top
    this.barTime.fillStyle(C.blue, 0.26)
    this.barTime.fillRect(BAR_X, boundaryY - tvH, BAR_W, tvH)
    this.barTime.lineStyle(1, C.blue, 0.5)
    this.barTime.strokeRect(BAR_X, boundaryY - tvH, BAR_W, tvH)
    // perforation line where real value ends and hype begins (the live split)
    if (intrH > 0.5 && tvH > 0.5) {
      this.barTime.lineStyle(1.5, C.white, 0.95)
      this.barTime.lineBetween(BAR_X, boundaryY, BAR_X + BAR_W, boundaryY)
    }

    this.intrLabel.setText(`real value ${intr.toFixed(2)}`)
    this.intrLabel.setY(AXIS_Y - intrH / 2)
    this.timeLabel.setText(`time value ${tv.toFixed(2)}`)
    this.timeLabel.setY(AXIS_Y - intrH - tvH / 2)
    this.totalLabel.setText(`total price ${(intr + tv).toFixed(2)}`)
    if (animate) {
      this.barIntrinsic.setAlpha(0)
      this.barTime.setAlpha(0)
      this.tweens.add({ targets: [this.barIntrinsic, this.barTime], alpha: 1, duration: this.dur(400) })
    }
  }

  // --- interactive: number line for S + CALL/PUT toggle ---------------------
  private buildInteractive(): void {
    const lineY = 210
    const lx = 60
    const lw = 320
    const g = this.add.graphics()
    g.lineStyle(2, C.gray200)
    g.lineBetween(lx, lineY, lx + lw, lineY)
    // strike tick
    const xK = lx + ((this.p.K - this.p.sMin) / (this.p.sMax - this.p.sMin)) * lw
    g.lineStyle(2, C.blue)
    g.lineBetween(xK, lineY - 14, xK, lineY + 14)
    this.label(xK, lineY - 26, `K=${this.p.K}`, { size: this.fs(13), col: C.blue, bold: true, align: 'center' })
    // end labels
    this.label(lx, lineY + 24, `${this.p.sMin}`, { size: this.fs(12), col: C.muted, align: 'center' })
    this.label(lx + lw, lineY + 24, `${this.p.sMax}`, { size: this.fs(12), col: C.muted, align: 'center' })

    // draggable S marker
    const dot = this.add.circle(0, lineY, 9, C.ink).setStrokeStyle(3, C.white)
    const sChip = this.add.graphics()
    const sTxt = this.label(0, lineY + 28, '', { size: this.fs(13), col: C.ink, bold: true, align: 'center' })
    const place = (S: number) => {
      const x = lx + ((S - this.p.sMin) / (this.p.sMax - this.p.sMin)) * lw
      dot.setX(x)
      sTxt.setX(x).setText(`S=${S.toFixed(0)}`)
      const padX = 6
      const padY = 3
      sChip.clear()
      sChip.fillStyle(C.white, 0.85)
      sChip.fillRoundedRect(
        sTxt.x - sTxt.originX * sTxt.width - padX,
        sTxt.y - sTxt.originY * sTxt.height - padY,
        sTxt.width + padX * 2,
        sTxt.height + padY * 2,
        5,
      )
      this.children.moveBelow(sChip, sTxt)
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
    this.label(60, lineY + 52, '↔ drag S across the strike', { size: this.fs(13), col: C.muted })

    // CALL/PUT toggle
    this.toggle(120, 300, ['CALL', 'PUT'], 0, (i) => {
      this.type = i === 0 ? 'call' : 'put'
      this.refresh()
    })

    // moneyness tag
    this.moneyTag = this.makeTag(120, 348, 'ATM')

    // a live one-line explainer
    this.note = this.label(60, 392, '', { size: this.fs(13), col: C.ink })

    this.refresh()
  }

  private refresh(): void {
    const intr = intrinsic(this.type, this.S, this.p.K)
    const tv = this.timeValue()
    this.drawBar(intr, tv)
    const m = moneyness(this.type, this.S, this.p.K)
    this.setTag(this.moneyTag, m)

    if (this.note) {
      const txt =
        m === 'OTM'
          ? "Out of the money — it's all time value (no real value yet)."
          : m === 'ATM'
            ? 'At the money — almost all time value.'
            : 'In the money — part real value, part time value.'
      this.note.setText(txt)
    }
  }

  // --- challenge: DRAG the split point to divide the premium -----------------
  private chSubmitted = false
  private splitFrac = 0.5 // fraction of the bar that is intrinsic (from the bottom)
  private splitLine!: Phaser.GameObjects.Graphics
  private splitHandle!: Phaser.GameObjects.Arc
  private splitIntrLabel!: Phaser.GameObjects.Text
  private splitTimeLabel!: Phaser.GameObjects.Text

  private get chTotalH(): number {
    return this.p.premium * this.sy
  }

  private buildChallenge(): void {
    // hide the deterministic interactive labels — this bar is fully learner-driven
    this.intrLabel.setAlpha(0)
    this.timeLabel.setAlpha(0)

    this.label(60, 150, `Call to buy at $${this.p.K} · stock now $${this.p.S}`, { size: this.fs(15), col: C.ink, bold: true })
    this.label(60, 176, `Split the $${this.p.premium.toFixed(2)} price into real value vs time value.`, {
      size: this.fs(13),
      col: C.muted,
    })

    // single outlined block representing the whole premium
    const totalH = this.chTotalH
    const outline = this.add.graphics()
    outline.lineStyle(1.5, C.blue)
    outline.strokeRect(BAR_X, AXIS_Y - totalH, BAR_W, totalH)
    this.label(BAR_X + BAR_W / 2, AXIS_Y + 18, `premium ${this.p.premium.toFixed(2)}`, {
      size: this.fs(13),
      col: C.ink,
      bold: true,
      align: 'center',
    })

    // live segments + split handle
    this.splitLine = this.add.graphics()
    this.splitIntrLabel = this.label(BAR_X + BAR_W + 12, 0, '', { size: this.fs(13), col: C.blueDark, bold: true })
    this.splitTimeLabel = this.label(BAR_X + BAR_W + 12, 0, '', { size: this.fs(13), col: C.blue })

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
    this.label(60, 232, '↕ drag the divider: below = real value, above = time value', {
      size: this.fs(13),
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
    this.barTime.fillStyle(C.blue, 0.26)
    this.barTime.fillRect(BAR_X, AXIS_Y - totalH, BAR_W, tvH)

    this.splitLine.clear()
    this.splitLine.lineStyle(2, C.ink)
    this.splitLine.lineBetween(BAR_X - 6, splitY, BAR_X + BAR_W + 6, splitY)
    this.splitHandle.setY(splitY)

    this.splitIntrLabel.setText(`real value ${intrVal.toFixed(2)}`).setY(AXIS_Y - intrH / 2)
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
    this.label(BAR_X - 16, AXIS_Y - trueIntr * this.sy - 6, `$${this.p.S} − $${this.p.K} = ${trueIntr.toFixed(0)}`, {
      size: this.fs(13),
      col: C.blue,
      bold: true,
      align: 'right',
      bg: true,
    })

    const title = correct
      ? `Real value ${trueIntr.toFixed(2)} · time value ${trueTv.toFixed(2)} — correct`
      : `It's $${trueIntr.toFixed(2)} real + $${trueTv.toFixed(2)} time value (you said $${guessIntr.toFixed(2)} real)`
    const detail = correct
      ? `Real value is how much it's already in the money: $${this.p.S} − $${this.p.K} = $${trueIntr.toFixed(
          2,
        )}. The rest, $${this.p.premium.toFixed(2)} − $${trueIntr.toFixed(2)} = $${trueTv.toFixed(
          2,
        )}, is time value — what you pay for the chance the stock climbs further before the deadline.`
      : `Real value is only how much it's in the money: $${this.p.S} − $${this.p.K} = $${trueIntr.toFixed(
          2,
        )}, so time value is $${this.p.premium.toFixed(2)} − $${trueIntr.toFixed(2)} = $${trueTv.toFixed(
          2,
        )}. The whole price isn't "real" value — but it isn't all time value either.`
    this.report(correct, title, detail)
  }

  // --- quiz: masked premium bar -> 7/2 split --------------------------------
  private mask?: Phaser.GameObjects.Graphics
  private buildQuiz(): void {
    const intr = this.p.quizIntrinsic ?? intrinsic(this.type, this.S, this.p.K)
    const tv = this.p.quizTimeValue ?? this.p.premium - intr
    // draw the real split underneath, then cover with a grey "premium 9.00" block
    this.drawBar(intr, tv)
    const totalH = (intr + tv) * this.sy
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
    this.label(60, 150, `CALL · strike ${this.p.K} · stock at ${this.S}`, { size: this.fs(15), col: C.ink, bold: true })
    this.label(60, 176, 'How does the 9.00 premium split?', { size: this.fs(13), col: C.muted })
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
        duration: this.dur(500),
        ease: 'Cubic.inOut',
        onComplete: () => this.mask?.destroy(),
      })
    }
    this.tweens.add({ targets: [this.intrLabel, this.timeLabel], alpha: 1, duration: this.dur(400), delay: this.dur(200) })
    const intr = this.p.quizIntrinsic ?? 7
    this.time.delayedCall(this.dur(260), () => {
      this.label(BAR_X - 16, AXIS_Y - intr * this.sy - 6, `max(${this.S}−${this.p.K},0)=${intr}`, {
        size: this.fs(13),
        col: C.blue,
        bold: true,
        align: 'right',
        bg: true,
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
        .text(x + i * segW + segW / 2, y, lab, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold' })
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
