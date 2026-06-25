import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'

/**
 * Module 1 INTRO — "Betting on Motion, Not Direction".
 *
 * The hook: a future-price track split into three labelled zones — a red "sits still →
 * lose" dead zone around today's price, flanked by two green "big move → win" zones. A
 * draggable price marker rides the track; a caliper measures how FAR it travelled and a
 * profit meter fills. The key teaching move is that the outcome is coloured by MAGNITUDE,
 * not direction: a big DROP and a big RISE both read green (win) — only sitting still
 * (the red middle) loses. No numbers, no breakevens, no pass/fail. (Anchor S0 = 100.)
 */
export default class IntroVibeScene extends ModuleScene {
  private anchor = 100
  private price = 100

  // layout (DESIGN 760×460)
  private trackX1 = 80
  private trackX2 = 560
  private trackY = 206
  private trackH = 18
  private priceMin = 70
  private priceMax = 130
  /** Move (from anchor) needed to leave the dead zone and start winning. */
  private winThresh = 13

  private meterX = 638
  private meterTop = 104
  private meterH = 220
  private meterW = 40

  private markerG!: Phaser.GameObjects.Graphics
  private caliperG!: Phaser.GameObjects.Graphics
  private meterFill!: Phaser.GameObjects.Graphics
  private halo!: Phaser.GameObjects.Arc
  private badge!: Phaser.GameObjects.Text
  private badgePanel!: Phaser.GameObjects.Graphics

  /** Set once the learner grabs the slider, so the scripted intro's deferred sync never
   *  yanks the knob back to the anchor on top of their own drag. */
  private userDragged = false

  protected build(): void {
    this.label(this.W / 2, 30, 'Win on a BIG move — up OR down', {
      size: this.fs(20, 16, 24), bold: true, align: 'center', col: C.ink,
    })

    this.drawTrack()

    // profit meter frame + "win line" threshold tick
    this.panel(this.meterX - 28, this.meterTop - 10, 56, this.meterH + 20, { fill: C.gray100, stroke: C.hairline, radius: 12 })
    this.label(this.meterX, this.meterTop - 24, 'PROFIT', { size: this.fs(12, 12, 15), col: C.muted, align: 'center', bold: true })
    const winY = this.meterTop + this.meterH - (this.winThresh / (this.priceMax - this.anchor)) * this.meterH
    this.dashH(this.meterX - 24, winY, this.meterX + 24, C.greenText, 0.9)
    this.label(this.meterX + 30, winY, 'win line', { size: this.fs(11, 12, 14), col: C.greenText, bold: true })
    this.meterFill = this.add.graphics()

    // badge readout under the meter
    this.badgePanel = this.add.graphics()
    this.badge = this.label(this.meterX, this.meterTop + this.meterH + 30, '', {
      size: this.fs(13, 12, 16), col: C.greenText, align: 'center', bold: true,
    })

    this.caliperG = this.add.graphics()
    this.markerG = this.add.graphics()
    // soft "you control this" halo (amber = the active path); gently breathes
    this.halo = this.add.circle(this.priceToX(this.price), this.trackY, 16, C.amber, 0.16)
    this.loop({ targets: this.halo, scale: 1.3, alpha: 0.28, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    this.label(this.W / 2, this.H - 18, 'Some trades win when the stock moves — up OR down. They lose only if it stays still.', {
      size: this.fs(12, 12, 15), col: C.muted, align: 'center',
    })

    if (this.reduceMotion) {
      // Calm representative state: a clear winning move so the idea reads at a glance,
      // then let the slider carry the interaction.
      this.price = this.anchor + 18
      this.buildSlider()
      this.drawDynamic()
      this.emitReady()
    } else {
      this.buildSlider()
      this.drawDynamic()
      this.playIntro()
    }
  }

  /** Static track: green win zones at both ends, a red "sits still" dead zone in the middle. */
  private drawTrack(): void {
    const g = this.add.graphics()
    const xL = this.priceToX(this.priceMin)
    const xR = this.priceToX(this.priceMax)
    const xC = this.priceToX(this.anchor)
    const xDeadL = this.priceToX(this.anchor - this.winThresh)
    const xDeadR = this.priceToX(this.anchor + this.winThresh)
    const top = this.trackY - this.trackH / 2

    // base track
    g.fillStyle(C.gray100, 1)
    g.fillRoundedRect(xL, top, xR - xL, this.trackH, 9)
    // green win zones (either direction is a win)
    g.fillStyle(C.green, 0.22)
    g.fillRect(xL, top, xDeadL - xL, this.trackH)
    g.fillRect(xDeadR, top, xR - xDeadR, this.trackH)
    // red dead zone (sitting still loses)
    g.fillStyle(C.red, 0.18)
    g.fillRect(xDeadL, top, xDeadR - xDeadL, this.trackH)

    // today's-price anchor line
    this.dashV(g, xC, this.trackY - 30, this.trackY + 30, C.blue, 0.5)
    this.label(xC, this.trackY + 36, "today's price", { size: this.fs(12, 12, 15), col: C.blueDark, align: 'center', bg: true })

    // zone headers
    this.label((xL + xDeadL) / 2, this.trackY - 40, 'big DROP → WIN', { size: this.fs(13, 12, 16), col: C.greenText, align: 'center', bold: true, bg: true })
    this.label((xDeadR + xR) / 2, this.trackY - 40, 'big RISE → WIN', { size: this.fs(13, 12, 16), col: C.greenText, align: 'center', bold: true, bg: true })
    this.label(xC, this.trackY - 64, 'sits still → lose', { size: this.fs(12, 12, 15), col: C.red, align: 'center', bold: true, bg: true })
  }

  /** Scripted hook: sweep out to a big RISE (win), through the dead middle (loss), out to a
   *  big DROP (win), then settle still (loss) — proving direction doesn't matter, distance does. */
  private playIntro(): void {
    const sweep = (from: number, to: number, delay: number, duration: number, ease: string, onDone?: () => void) =>
      this.tweens.addCounter({
        from, to, delay, duration, ease,
        onUpdate: (tw) => { this.price = this.anchor + 28 * (tw.getValue() ?? 0); this.drawDynamic() },
        onComplete: () => onDone?.(),
      })
    sweep(0, 1, 600, 700, 'Cubic.out')
    sweep(1, -1, 1400, 900, 'Sine.easeInOut')
    sweep(-1, 0, 2400, 600, 'Cubic.out', () => { this.flashLoss(); this.emitReady() })
  }

  private buildSlider(): void {
    const y = 304
    this.label(this.W / 2, y - 26, 'drag the future price ↔', { size: this.fs(12, 12, 15), col: C.amberInk, bold: true, align: 'center' })
    const ctrl = this.slider(this.trackX1, y, this.trackX2 - this.trackX1, this.priceMin, this.priceMax, this.price, (v) => {
      this.userDragged = true
      this.price = v
      this.drawDynamic()
    }, { step: 0.5, col: C.amber })
    // Sync the knob to the scripted intro's resting value, unless the learner already grabbed it.
    if (!this.reduceMotion) this.time.delayedCall(3000, () => { if (!this.userDragged) ctrl.set(this.anchor) })
  }

  private priceToX(p: number): number {
    const t = (p - this.priceMin) / (this.priceMax - this.priceMin)
    return this.trackX1 + t * (this.trackX2 - this.trackX1)
  }

  private drawDynamic(): void {
    const moved = this.price - this.anchor
    const dist = Math.abs(moved)
    const frac = Math.min(1, dist / (this.priceMax - this.anchor))
    const win = dist >= this.winThresh
    const x = this.priceToX(this.price)
    const xc = this.priceToX(this.anchor)
    const col = win ? C.green : C.red

    // caliper: how FAR it travelled from today's price (green = winning distance, red = too small)
    this.caliperG.clear()
    if (dist > 0.5) {
      const cy = this.trackY - 16
      this.caliperG.lineStyle(5, col, 0.9)
      this.caliperG.lineBetween(xc, cy, x, cy)
      const dir = Math.sign(moved) || 1
      this.caliperG.fillStyle(col, 0.9)
      this.caliperG.fillTriangle(x, cy - 6, x, cy + 6, x + dir * 9, cy)
    }

    // marker (amber — the value the learner drives)
    this.markerG.clear()
    this.markerG.fillStyle(C.amber, 1)
    this.markerG.fillCircle(x, this.trackY, 9)
    this.markerG.lineStyle(2.5, C.white, 1)
    this.markerG.strokeCircle(x, this.trackY, 9)
    this.halo.setPosition(x, this.trackY)

    // profit meter (fills with distance; green once it clears the win line)
    this.meterFill.clear()
    const h = frac * this.meterH
    this.meterFill.fillStyle(col, win ? 0.85 : 0.4)
    this.meterFill.fillRoundedRect(this.meterX - this.meterW / 2, this.meterTop + this.meterH - h, this.meterW, h, 6)

    this.drawBadge(dist, win)
  }

  private drawBadge(dist: number, win: boolean): void {
    const worst = dist < 1.5
    const text = worst ? 'no move → worst case' : win ? 'BIG MOVE → profit' : 'too quiet → loss'
    const col = win ? C.greenText : C.red
    this.badge.setText(text).setColor(hex(col))
    const w = this.badge.width + 20
    const by = this.meterTop + this.meterH + 18
    this.badgePanel.clear()
    this.badgePanel.fillStyle(win ? C.greenSoft : C.redSoft, 1)
    this.badgePanel.fillRoundedRect(this.meterX - w / 2, by, w, 24, 8)
    this.children.bringToTop(this.badge)
  }

  private flashLoss(): void {
    const flash = this.add.rectangle(this.meterX, this.meterTop + this.meterH - 8, 44, 16, C.red, 0.6)
    this.tweens.add({ targets: flash, alpha: 0, duration: this.dur(600), onComplete: () => flash.destroy() })
  }

  private dashV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += 10) g.lineBetween(x, y, x, Math.min(y + 6, y2))
  }

  private dashH(x1: number, y: number, x2: number, col: number, alpha = 1): void {
    const g = this.add.graphics()
    g.lineStyle(1.5, col, alpha)
    for (let x = x1; x < x2; x += 8) g.lineBetween(x, y, Math.min(x + 5, x2), y)
  }
}
