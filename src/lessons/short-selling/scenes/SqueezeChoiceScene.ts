import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, color, FONT } from '../../../engine/palette'

interface SqueezeChoiceParams {
  /** Short interest as % of float. Default 140 (GME-like). */
  shortPct?: number
  /** Days-to-cover (sharesShort / avgDailyVolume). Default 6. */
  daysToCover?: number
  /** Free float in millions of shares. Default 50. */
  floatM?: number
  /** Is there a bullish retail catalyst pouring fuel on it? Default true. */
  catalyst?: boolean
  /** The right answer: should you STEP ASIDE? Default true when fuel is high. */
  stepAsideIsRight?: boolean
}

/**
 * M10 CHALLENGE — "Squeeze or Settle? Read the Setup".
 * Three dials show the squeeze fuel — short interest (% of float), days-to-cover, and
 * float — plus a catalyst flag. The learner reads them and presses SHORT IT or STEP
 * ASIDE. Submit reveals the verdict and grades: when the spring is loaded (short interest
 * above the float + high days-to-cover + a catalyst), STEP ASIDE is the disciplined call.
 *
 * Exact relationship surfaced: more shares sold short than exist to buy back (SI > 100%)
 * with high days-to-cover means forced covering must chase a near-empty float → squeeze.
 */
export default class SqueezeChoiceScene extends ModuleScene {
  private shortPct = 140
  private daysToCover = 6
  private floatM = 50
  private catalyst = true
  private stepAsideIsRight = true

  private choice: 'short' | 'aside' | null = null
  private locked = false
  private buttons: Array<{
    key: 'short' | 'aside'
    bg: Phaser.GameObjects.Graphics
    txt: Phaser.GameObjects.Text
    x: number
    y: number
    w: number
    h: number
    activeFill: number
  }> = []

  protected build(): void {
    const p = this.params as SqueezeChoiceParams
    this.shortPct = p.shortPct ?? 140
    this.daysToCover = p.daysToCover ?? 6
    this.floatM = p.floatM ?? 50
    this.catalyst = p.catalyst ?? true
    this.stepAsideIsRight = p.stepAsideIsRight ?? true

    this.label(this.W / 2, 16, 'Illustrative simulation · squeeze mechanics exact', {
      size: 12,
      col: C.muted,
      align: 'center',
    })

    // Three dials across the top.
    this.drawDial(150, 150, 'Short interest', `${this.shortPct.toFixed(0)}%`, this.shortPct / 200, this.shortPct >= 100 ? C.red : C.blue, this.shortPct >= 100 ? '> 100% of float!' : 'of float')
    this.drawDial(380, 150, 'Days-to-cover', `${this.daysToCover.toFixed(1)}`, Math.min(1, this.daysToCover / 10), this.daysToCover > 5 ? C.red : C.blue, this.daysToCover > 5 ? 'slow to buy back' : 'days of volume')
    this.drawDial(610, 150, 'Free float', `${this.floatM.toFixed(0)}M`, 1 - Math.min(1, this.floatM / 200), this.floatM < 80 ? C.red : C.blue, this.floatM < 80 ? 'thin — easy to corner' : 'shares')

    // Catalyst flag.
    const catCol = this.catalyst ? C.red : C.muted
    this.panel(230, 250, 300, 36, { fill: this.catalyst ? C.redSoft : C.gray100, stroke: catCol, radius: 10 })
    this.label(this.W / 2, 268, this.catalyst ? 'Catalyst: retail buying surging (bullish)' : 'Catalyst: none — interest fading', {
      size: 13,
      bold: true,
      col: catCol,
      align: 'center',
    })

    // Two in-scene choice buttons.
    this.drawChoiceButton('short', 'SHORT IT', 200, 330, C.red)
    this.drawChoiceButton('aside', 'STEP ASIDE', 460, 330, C.green)

    this.label(this.W / 2, 392, 'Pick a side, then Submit to reveal the verdict.', {
      size: 12,
      col: C.muted,
      align: 'center',
    })

    // Must choose before submitting.
    this.setCanSubmit(false)
    this.emitReady()
  }

  private drawDial(cx: number, cy: number, title: string, value: string, frac: number, col: number, sub: string): void {
    const r = 52
    this.label(cx, cy - r - 18, title, { size: 12, bold: true, col: C.ink, align: 'center' })
    // background arc (270° gauge)
    const start = Phaser.Math.DegToRad(135)
    const end = Phaser.Math.DegToRad(135 + 270)
    const bg = this.add.graphics()
    bg.lineStyle(9, C.gray200, 1)
    bg.beginPath()
    bg.arc(cx, cy, r, start, end, false)
    bg.strokePath()
    // value arc
    const f = Math.max(0, Math.min(1, frac))
    const valEnd = Phaser.Math.DegToRad(135 + 270 * f)
    const vg = this.add.graphics()
    vg.lineStyle(9, col, 1)
    vg.beginPath()
    vg.arc(cx, cy, r, start, valEnd, false)
    vg.strokePath()
    // center value + subtitle
    this.label(cx, cy - 2, value, { size: 19, bold: true, col, align: 'center' })
    this.label(cx, cy + r + 16, sub, { size: 12, col: color(col === C.red ? C.red : C.muted), align: 'center' })
  }

  private drawChoiceButton(key: 'short' | 'aside', text: string, cx: number, cy: number, activeFill: number): void {
    const w = 180
    const h = 44
    const bg = this.add.graphics()
    const txt = this.add
      .text(cx, cy, text, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold' })
      .setOrigin(0.5)
    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0).setInteractive({ useHandCursor: true })
    hit.on('pointerup', () => {
      if (this.locked) return
      this.choice = key
      this.refreshButtons()
      this.setCanSubmit(true)
    })
    this.buttons.push({ key, bg, txt, x: cx, y: cy, w, h, activeFill })
    this.refreshButtons()
  }

  private refreshButtons(): void {
    for (const b of this.buttons) {
      const selected = this.choice === b.key
      b.bg.clear()
      b.bg.fillStyle(selected ? b.activeFill : C.white, 1)
      b.bg.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12)
      b.bg.lineStyle(2, selected ? b.activeFill : C.hairline)
      b.bg.strokeRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12)
      b.txt.setColor(hex(selected ? C.white : b.activeFill))
    }
  }

  protected onSubmit(): void {
    if (this.locked) return
    this.locked = true
    this.setCanSubmit(false)

    const rightKey: 'short' | 'aside' = this.stepAsideIsRight ? 'aside' : 'short'
    // A missed tap (small touch target on a FIT-scaled canvas) must never trap the
    // learner: grade as not-correct but still reveal and explain the disciplined read.
    const correct = this.choice !== null && this.choice === rightKey

    // Flash the right answer's button to teach it.
    const rightBtn = this.buttons.find((b) => b.key === rightKey)
    if (rightBtn) {
      this.tweens.add({ targets: [rightBtn.bg, rightBtn.txt], alpha: 0.4, yoyo: true, repeat: 2, duration: 200 })
    }

    let title: string
    let detail: string
    if (this.choice === null) {
      title = this.stepAsideIsRight ? 'The smart call: STEP ASIDE' : 'The smart call: a careful SHORT'
      detail = this.stepAsideIsRight
        ? `More shares are short (${this.shortPct.toFixed(0)}%) than there are to buy back, and it takes ${this.daysToCover.toFixed(1)} days to cover. With buyers piling in, any rise snowballs. When the exit is that small, step aside. This was GME — it ran toward ~$483.`
        : `Short interest (${this.shortPct.toFixed(0)}%) and days-to-cover (${this.daysToCover.toFixed(1)}) are low, so there's little squeeze risk. With a stop above, a fading stock like this is a fair short.`
    } else if (this.stepAsideIsRight) {
      if (this.choice === 'aside') {
        title = 'Good call — step aside'
        detail =
          `More shares are short (${this.shortPct.toFixed(0)}%) than there are to buy back, and it takes ${this.daysToCover.toFixed(1)} days to cover. ` +
          `Add eager buyers and any rise snowballs. Being right on value won't save you. This was GME — it ran toward ~$483.`
      } else {
        title = 'Shorting into a trap'
        detail =
          `Short interest is ${this.shortPct.toFixed(0)}% (more shares short than exist to buy), days-to-cover is ${this.daysToCover.toFixed(1)}, and buyers are piling in. ` +
          `This is exactly the squeeze setup — GME ran to ~$483. When the exit is that small, step aside.`
      }
    } else {
      if (this.choice === 'short') {
        title = 'Reasonable short — squeeze risk is low'
        detail =
          `Short interest (${this.shortPct.toFixed(0)}%) and days-to-cover (${this.daysToCover.toFixed(1)}) are low, so there's little forced buying to fear. ` +
          `With a stop above, a fading stock like this is a fair short.`
      } else {
        title = 'Too cautious — little squeeze risk here'
        detail =
          `Short interest (${this.shortPct.toFixed(0)}%) and days-to-cover (${this.daysToCover.toFixed(1)}) are low — not the trap that crushes shorts. ` +
          `Stepping aside from every short means never taking the good ones. The trap needs high short interest, a thin float, and a catalyst — not here.`
      }
    }
    this.report(correct, title, detail)
  }
}
