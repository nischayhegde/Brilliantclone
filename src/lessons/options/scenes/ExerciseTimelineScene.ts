import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'

interface ExerciseParams {
  /** 'timeline' = module 4 American/European ; 'doors' = module 14 sell-vs-exercise. */
  variant?: 'timeline' | 'doors'
  /** module 4 illustrative values. */
  intrinsicNow?: number
  timeValueNow?: number
  /** doors variant: make the doors a self-grading challenge (pick one + Submit). */
  challenge?: boolean
}

/**
 * ExerciseTimelineScene
 *  - 'timeline': American (green band, use any day) vs European (single node, deadline
 *    only); drag a "use it now" marker → you get real value only and forfeit the
 *    leftover time value, so selling is worth more until the deadline.
 *  - 'doors': held ITM call 8.00 (6 real + 2 time) with three action doors; the chosen
 *    door opens on quiz reveal.
 */
export default class ExerciseTimelineScene extends ModuleScene {
  private p!: Required<ExerciseParams>
  private revealed = false

  protected build(): void {
    const raw = this.params as ExerciseParams
    this.p = {
      variant: raw.variant ?? 'timeline',
      intrinsicNow: raw.intrinsicNow ?? 6,
      timeValueNow: raw.timeValueNow ?? 2,
      challenge: raw.challenge ?? false,
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
  private euY = 252

  private buildTimeline(): void {
    this.label(40, 24, 'AMERICAN vs EUROPEAN — when can you use it?', { size: 16, col: C.ink, bold: true })
    this.label(40, 46, '(time value illustrative)', { size: 13, col: C.muted })

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
    if (this.reduceMotion) {
      proxy.w = full
      drawBand()
    } else {
      this.tweens.add({ targets: proxy, w: full, duration: 800, ease: 'Cubic.out', onUpdate: drawBand })
    }
    this.label(this.trackL, this.amY - 30, 'AMERICAN — use it any day', { size: 13, col: C.green, bold: true })

    // European track (grey with single green node at expiry)
    const eu = this.add.graphics()
    eu.lineStyle(2, C.gray200)
    eu.lineBetween(this.trackL, this.euY, this.trackR, this.euY)
    this.add.circle(this.trackR, this.euY, 7, C.green).setStrokeStyle(2, C.white)
    this.label(this.trackL, this.euY - 22, 'EUROPEAN — only on the deadline', { size: 13, col: C.muted, bold: true })
    this.label(this.trackR, this.euY + 18, 'deadline', { size: 12, col: C.green, align: 'right' })

    // draggable "use it now" marker on the American track
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
    this.label(this.trackL, this.amY + 54, '↔ drag "use it now" earlier or later', { size: 13, col: C.muted })

    this.readoutTxt = this.label(40, 340, '', { size: 13, col: C.ink, bold: true })
    this.verdict = this.label(40, 370, '', { size: 14, col: C.green, bold: true })
    this.refreshTimeline()
  }

  private refreshTimeline(): void {
    // remaining time value scales with distance to expiry (0 at expiry)
    const remTV = this.p.timeValueNow * (1 - this.tFrac)
    const intr = this.p.intrinsicNow
    const exerciseVal = intr // real value only
    const sellVal = intr + remTV // real value + remaining time value
    this.readoutTxt.setText(
      `Use it now: get $${exerciseVal.toFixed(2)} (real value only)   ·   Sell it: get $${sellVal.toFixed(
        2,
      )} (real + time value)`,
    )

    // shatter the forfeited time value visually
    this.shatter.clear()
    if (remTV > 0.05 && this.tFrac < 0.98) {
      const x = this.trackL + this.tFrac * (this.trackR - this.trackL)
      this.shatter.fillStyle(C.muted, 0.4)
      for (let i = 0; i < 6; i++) this.shatter.fillCircle(x + (i - 3) * 6, this.amY + 30 + (i % 2) * 6, 2)
    }

    if (this.tFrac >= 0.98) {
      this.verdict.setText('At the deadline they tie — no time value is left.')
      this.verdict.setColor(hex(C.muted))
    } else {
      this.verdict.setText(`Selling keeps $${(sellVal - exerciseVal).toFixed(2)} more — the leftover time value.`)
      this.verdict.setColor(hex(C.green))
    }
  }

  // --- MODULE 14: three doors ----------------------------------------------
  private doors: Array<{ key: string; c: Phaser.GameObjects.Container; body: Phaser.GameObjects.Text }> = []
  private pick: string | null = null
  private doorPicked = false
  // Door geometry (shared by build / select / open so the row stays inside 760 wide).
  private readonly DW = 146
  private readonly DH = 150
  private buildDoors(): void {
    const intr = this.p.intrinsicNow // 6
    const tv = this.p.timeValueNow // 2
    const total = intr + tv

    this.label(40, 24, `Your call is worth $${total.toFixed(2)} — a week left`, {
      size: 16,
      col: C.ink,
      bold: true,
    })
    this.label(40, 46, `$${intr.toFixed(2)} real value + $${tv.toFixed(2)} time value (illustrative)`, {
      size: 13,
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
    this.label(bx + 58, by - intr * scale / 2, `real value ${intr.toFixed(2)}`, { size: 13, col: C.blue, bold: true })
    this.label(bx + 58, by - intr * scale - (tv * scale) / 2, `time value ${tv.toFixed(2)}`, { size: 13, col: C.blue })

    // three doors on the right
    const defs: Array<{ key: string; title: string }> = [
      { key: 'exercise', title: 'Exercise' },
      { key: 'sell', title: 'Sell-to-close' },
      { key: 'expire', title: 'Let it expire' },
    ]
    const dw = this.DW
    const dh = this.DH
    const gap = 16
    const x0 = 270
    const y = 116
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
        .text(dw / 2, dh / 2 + 20, '', {
          fontFamily: FONT,
          fontSize: '13px',
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
      if (this.p.challenge) {
        const hit = this.add
          .rectangle(x + dw / 2, y + dh / 2, dw, dh, 0x000000, 0)
          .setInteractive({ useHandCursor: true })
        hit.on('pointerup', () => {
          if (this.revealed) return
          this.pick = d.key
          this.doorPicked = true
          this.refreshDoorSelection()
        })
      }
    })

    if (this.p.challenge) {
      this.label(270, 286, 'Tap a door to choose, then Submit to open them →', { size: 13, col: C.muted })
      // Submit is always available so the learner can never get stuck: if they open
      // the doors without choosing, onSubmit still grades + explains (see below).
      this.setCanSubmit(true)
    } else {
      this.label(270, 286, 'Submit your choice to open the doors →', { size: 13, col: C.muted })
    }
  }

  private refreshDoorSelection(): void {
    this.setCanSubmit(this.doorPicked)
    const dw = this.DW
    const dh = this.DH
    for (const d of this.doors) {
      const selected = d.key === this.pick
      const panel = d.c.list[0] as Phaser.GameObjects.Graphics
      panel.clear()
      panel.fillStyle(selected ? C.blueSoft : C.gray100, 1)
      panel.fillRoundedRect(0, 0, dw, dh, 12)
      panel.lineStyle(selected ? 2.5 : 1.5, selected ? C.blue : C.muted)
      panel.strokeRoundedRect(0, 0, dw, dh, 12)
    }
  }

  protected onReveal(): void {
    if (this.revealed || this.p.variant !== 'doors' || this.p.challenge) return
    this.openAllDoors()
  }

  protected onSubmit(): void {
    if (this.revealed || this.p.variant !== 'doors' || !this.p.challenge) return
    this.setCanSubmit(false)
    this.openAllDoors()

    const intr = this.p.intrinsicNow
    const tv = this.p.timeValueNow
    const total = intr + tv

    // No door chosen: still resolve with a clear, gradeable verdict so the learner
    // is never blocked from continuing.
    if (this.pick === null) {
      this.report(
        false,
        `Selling keeps the most ($${total.toFixed(2)})`,
        `No door was chosen. Selling hands the contract to a buyer who pays for the real value AND the leftover time value, so you keep the full $${total.toFixed(
          2,
        )} — using it keeps only the $${intr.toFixed(2)} real value, and letting it expire keeps nothing.`,
      )
      return
    }

    const correct = this.pick === 'sell'
    const kept = this.pick === 'sell' ? total : this.pick === 'exercise' ? intr : 0
    const keptNote = correct
      ? ''
      : ` Your choice keeps $${kept.toFixed(2)} vs $${total.toFixed(2)} by selling.`
    const title = correct
      ? `Sell it · keep $${total.toFixed(2)}`
      : this.pick === 'exercise'
        ? `Using it loses the time value (kept $${intr.toFixed(2)})`
        : `Letting it expire wastes all $${total.toFixed(2)}`
    const detail = correct
      ? `Selling captures the full $${total.toFixed(2)} — including the $${tv.toFixed(
          2,
        )} of time value. Using it now would give you only the $${intr.toFixed(
          2,
        )} real value and throw away the $${tv.toFixed(2)}.`
      : this.pick === 'exercise'
        ? `Using it now gives you only the $${intr.toFixed(2)} real value and loses the $${tv.toFixed(
            2,
          )} time value. Sell it instead — a buyer pays for the real value AND the leftover time value, so you keep the full $${total.toFixed(2)}.`
        : `Letting it expire wastes all $${total.toFixed(2)}. Sell it instead — a buyer pays for the real value AND the leftover time value, so you keep the full $${total.toFixed(2)}.`
    this.report(correct, title, `${detail}${keptNote}`)
  }

  private openAllDoors(): void {
    if (this.revealed) return
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
      panel.fillRoundedRect(0, 0, this.DW, this.DH, 12)
      panel.lineStyle(2, col)
      panel.strokeRoundedRect(0, 0, this.DW, this.DH, 12)
      d.body.setText(txt).setColor(hex(col))
      this.tweens.add({ targets: d.body, alpha: 1, duration: 360, delay: 200 })
    }
    open('sell', `keep all $${total.toFixed(2)}\n(real + time value)`, C.green)
    open('exercise', `only $${intr.toFixed(2)} real value\n($${tv.toFixed(2)} time value lost)`, C.red)
    open('expire', `get $0\n(throws it all away)`, C.red)
  }

}
