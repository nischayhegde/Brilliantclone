import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'

interface ExerciseParams {
  /** 'timeline' = module 4 American/European ; 'doors' = module 14 sell-vs-exercise quiz. */
  variant?: 'timeline' | 'doors'
  /** module 4 illustrative values. */
  intrinsicNow?: number
  timeValueNow?: number
}

/**
 * ExerciseTimelineScene
 *  - 'timeline' (module 4): American (green band) vs European (single node); drag an
 *    "exercise now" marker → realize intrinsic only, forfeit time value; CALL/PUT
 *    toggle reveals the dividend / interest-on-strike special cases.
 *  - 'doors'    (module 14): held ITM call 8.00 (6 intrinsic + 2 time) with three
 *    action doors; the chosen door opens on quiz reveal.
 */
export default class ExerciseTimelineScene extends ModuleScene {
  private p!: Required<ExerciseParams>
  private isCall = true
  private revealed = false

  protected build(): void {
    const raw = this.params as ExerciseParams
    this.p = {
      variant: raw.variant ?? 'timeline',
      intrinsicNow: raw.intrinsicNow ?? 6,
      timeValueNow: raw.timeValueNow ?? 2,
    }
    if (this.p.variant === 'doors') this.buildDoors()
    else this.buildTimeline()
    this.emitReady()
  }

  // --- MODULE 4 -------------------------------------------------------------
  private verdict!: Phaser.GameObjects.Text
  private readoutTxt!: Phaser.GameObjects.Text
  private shatter!: Phaser.GameObjects.Graphics
  private tFrac = 0.4 // position of the exercise marker along American life (0=now,1=expiry)
  private trackL = 80
  private trackR = 620
  private amY = 130
  private euY = 210

  private buildTimeline(): void {
    this.label(40, 26, 'AMERICAN vs EUROPEAN — exercise window', { size: 14, col: C.ink, bold: true })
    this.label(40, 46, '(time-value figures illustrative; trade-off logic exact)', { size: 11, col: C.muted })

    // American band (green, full length) — grows in via a numeric proxy
    const am = this.add.graphics()
    const full = this.trackR - this.trackL
    const proxy = { w: 0 }
    const drawBand = () => {
      am.clear()
      am.fillStyle(C.green, 0.18)
      am.fillRoundedRect(this.trackL, this.amY - 12, proxy.w, 24, 6)
      am.lineStyle(1.5, C.green)
      am.strokeRoundedRect(this.trackL, this.amY - 12, proxy.w, 24, 6)
    }
    this.tweens.add({ targets: proxy, w: full, duration: 800, onUpdate: drawBand })
    this.label(this.trackL, this.amY - 30, 'AMERICAN — exercise ANYTIME', { size: 12, col: C.green, bold: true })

    // European track (grey with single green node at expiry)
    const eu = this.add.graphics()
    eu.lineStyle(2, C.gray200)
    eu.lineBetween(this.trackL, this.euY, this.trackR, this.euY)
    this.add.circle(this.trackR, this.euY, 7, C.green).setStrokeStyle(2, C.white)
    this.label(this.trackL, this.euY - 22, 'EUROPEAN — exercise ONLY at expiry', { size: 12, col: C.muted, bold: true })
    this.label(this.trackR, this.euY + 18, 'expiry', { size: 10, col: C.green, align: 'right' })

    // dividend flag near 0.7 of life
    const divX = this.trackL + 0.7 * (this.trackR - this.trackL)
    this.label(divX, this.amY + 26, '⚑ dividend', { size: 10, col: C.blue, align: 'center' })

    // draggable "exercise now" marker on the American track
    this.shatter = this.add.graphics()
    const marker = this.add.circle(0, this.amY, 9, C.ink).setStrokeStyle(3, C.white)
    const place = (frac: number) => marker.setX(this.trackL + frac * (this.trackR - this.trackL))
    marker.setInteractive({ useHandCursor: true, draggable: true })
    this.input.setDraggable(marker)
    marker.on('drag', (_pp: Phaser.Input.Pointer, dx: number) => {
      this.tFrac = Phaser.Math.Clamp(
        (dx - this.trackL) / (this.trackR - this.trackL),
        0,
        1,
      )
      place(this.tFrac)
      this.refreshTimeline()
    })
    place(this.tFrac)
    this.label(this.trackL, this.amY + 50, '↔ drag "exercise now" along the American life', { size: 10, col: C.muted })

    // CALL/PUT toggle for special cases
    this.toggle(120, 300, ['CALL', 'PUT'], 0, (i) => {
      this.isCall = i === 0
      this.refreshTimeline()
    })

    this.readoutTxt = this.label(40, 350, '', { size: 13, col: C.ink, bold: true })
    this.verdict = this.label(40, 376, '', { size: 13, col: C.green, bold: true })
    this.refreshTimeline()
  }

  private refreshTimeline(): void {
    // remaining time value scales with distance to expiry (0 at expiry)
    const remTV = this.p.timeValueNow * (1 - this.tFrac)
    const intr = this.p.intrinsicNow
    const exerciseVal = intr // intrinsic only
    const sellVal = intr + remTV // intrinsic + remaining time value
    this.readoutTxt.setText(
      `If EXERCISE now: realize ${exerciseVal.toFixed(2)} (intrinsic only)   ·   if SELL-to-close: ${sellVal.toFixed(
        2,
      )} (intrinsic + time)`,
    )

    // shatter the forfeited time value visually
    this.shatter.clear()
    if (remTV > 0.05 && this.tFrac < 0.98) {
      const x = this.trackL + this.tFrac * (this.trackR - this.trackL)
      this.shatter.fillStyle(C.muted, 0.4)
      for (let i = 0; i < 6; i++) this.shatter.fillCircle(x + (i - 3) * 6, this.amY + 30 + (i % 2) * 6, 2)
    }

    // special-case logic
    const nearDividend = this.tFrac >= 0.6 && this.tFrac <= 0.78
    if (this.tFrac >= 0.98) {
      this.verdict.setText('At expiry: exercise = sell = intrinsic (time value is 0).')
      this.verdict.setColor(hex(C.muted))
    } else if (this.isCall && nearDividend && remTV < 1.0) {
      this.verdict.setText('Special case: deep-ITM CALL before a dividend → early exercise can WIN (capture the dividend).')
      this.verdict.setColor(hex(C.green))
    } else if (!this.isCall && remTV < 0.8) {
      this.verdict.setText('Special case: deep-ITM PUT → early exercise can WIN (earn interest on the strike cash now).')
      this.verdict.setColor(hex(C.green))
    } else {
      this.verdict.setText(`Selling wins by ${(sellVal - exerciseVal).toFixed(2)} — keep the time value.`)
      this.verdict.setColor(hex(C.green))
    }
  }

  // --- MODULE 14: three doors ----------------------------------------------
  private doors: Array<{ key: string; c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Text }> = []
  private buildDoors(): void {
    const intr = this.p.intrinsicNow // 6
    const tv = this.p.timeValueNow // 2
    const total = intr + tv

    this.label(40, 26, `You hold an ITM CALL worth ${total.toFixed(2)} — a week left`, {
      size: 14,
      col: C.ink,
      bold: true,
    })
    this.label(40, 46, `intrinsic ${intr.toFixed(2)} + time value ${tv.toFixed(2)} (illustrative)`, {
      size: 11,
      col: C.muted,
    })

    // little stacked premium bar on the left
    const bx = 60
    const by = 320
    const scale = 22
    const g = this.add.graphics()
    g.fillStyle(C.blue, 1)
    g.fillRect(bx, by - intr * scale, 50, intr * scale)
    g.fillStyle(C.blue, 0.28)
    g.fillRect(bx, by - total * scale, 50, tv * scale)
    g.lineStyle(1, C.blue, 0.5)
    g.strokeRect(bx, by - total * scale, 50, total * scale)
    this.label(bx + 60, by - intr * scale / 2, `intrinsic ${intr.toFixed(2)}`, { size: 11, col: C.blue, bold: true })
    this.label(bx + 60, by - intr * scale - (tv * scale) / 2, `time value ${tv.toFixed(2)}`, { size: 11, col: C.blue })

    // three doors on the right
    const defs: Array<{ key: string; title: string }> = [
      { key: 'exercise', title: 'Exercise' },
      { key: 'sell', title: 'Sell-to-close' },
      { key: 'expire', title: 'Let it expire' },
    ]
    const dw = 150
    const dh = 150
    const gap = 24
    const x0 = 280
    const y = 120
    defs.forEach((d, i) => {
      const x = x0 + i * (dw + gap)
      const panel = this.panel(0, 0, dw, dh, { fill: C.gray100, stroke: C.muted, radius: 12 })
      const title = this.add
        .text(dw / 2, 22, d.title, { fontFamily: FONT, fontSize: '15px', color: hex(C.ink), fontStyle: 'bold' })
        .setOrigin(0.5)
      const closed = this.add
        .text(dw / 2, dh / 2, '🚪', { fontFamily: FONT, fontSize: '40px' })
        .setOrigin(0.5)
      const body = this.add
        .text(dw / 2, dh / 2 + 18, '', {
          fontFamily: FONT,
          fontSize: '12px',
          color: hex(C.ink),
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: dw - 16 },
        })
        .setOrigin(0.5)
        .setAlpha(0)
      const c = this.add.container(x, y, [panel, title, closed, body])
      c.setData('closed', closed)
      this.doors.push({ key: d.key, c, body })
    })
    this.label(280, 290, 'Submit your choice to open the doors →', { size: 11, col: C.muted })
  }

  protected onReveal(): void {
    if (this.revealed || this.p.variant !== 'doors') return
    this.revealed = true
    const intr = this.p.intrinsicNow
    const tv = this.p.timeValueNow
    const total = intr + tv
    const open = (key: string, txt: string, col: number) => {
      const d = this.doors.find((x) => x.key === key)
      if (!d) return
      const closed = d.c.getData('closed') as Phaser.GameObjects.Text
      this.tweens.add({ targets: closed, alpha: 0, scale: 0.6, duration: 300 })
      const panel = d.c.list[0] as Phaser.GameObjects.Graphics
      panel.clear()
      const soft = col === C.green ? C.greenSoft : col === C.red ? C.redSoft : C.blueSoft
      panel.fillStyle(soft, 1)
      panel.fillRoundedRect(0, 0, 150, 150, 12)
      panel.lineStyle(2, col)
      panel.strokeRoundedRect(0, 0, 150, 150, 12)
      d.body.setText(txt).setColor(hex(col))
      this.tweens.add({ targets: d.body, alpha: 1, duration: 360, delay: 200 })
    }
    open('sell', `+${total.toFixed(2)} realized\n(keeps the ${tv.toFixed(2)} time value)`, C.green)
    open('exercise', `only ${intr.toFixed(2)} intrinsic\n−${tv.toFixed(2)} time value thrown away`, C.red)
    open('expire', `forfeit all ${total.toFixed(2)}\n(nonsensical here)`, C.red)

    // assignment envelope flying to the (hypothetical) writer
    this.time.delayedCall(600, () => {
      const env = this.label(this.W / 2, 320, '✉ ASSIGNMENT → if you were SHORT, you would be assigned (forced to deliver shares)', {
        size: 11,
        col: C.blue,
        bold: true,
        align: 'center',
      })
      env.setAlpha(0)
      this.tweens.add({ targets: env, alpha: 1, duration: 400 })
    })
  }

  // --- shared toggle --------------------------------------------------------
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
}
