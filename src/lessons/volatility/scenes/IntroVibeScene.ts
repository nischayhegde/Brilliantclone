import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'

/**
 * Module 1 INTRO — "Betting on Motion, Not Direction".
 *
 * A coiled, vibrating price line with green-up / red-down outcome arrows and a
 * vertical profit meter that fills when the price moves FAR either way and drains to
 * a red "loss" when it sits near 100. A draggable future-price slider lets the learner
 * feel the V before any numbers/breakevens appear. No pass/fail. (Anchor S0 = 100.)
 */
export default class IntroVibeScene extends ModuleScene {
  private anchor = 100
  private price = 100
  private lineG!: Phaser.GameObjects.Graphics
  private meterFill!: Phaser.GameObjects.Graphics
  private upArrow!: Phaser.GameObjects.Graphics
  private downArrow!: Phaser.GameObjects.Graphics
  private badge!: Phaser.GameObjects.Text
  private badgePanel!: Phaser.GameObjects.Graphics
  private vibrate = true
  private t0 = 0
  /** Set once the learner grabs the slider, so the scripted intro's deferred sync never
   *  yanks the knob back to the anchor on top of their own drag. */
  private userDragged = false

  // layout
  private cx = 300
  private cy = 230
  private lineW = 360
  private meterX = 640
  private meterTop = 90
  private meterH = 280

  protected build(): void {
    this.label(this.W / 2, 30, 'Win if it MOVES — up OR down', { size: this.fs(20, 16, 24), bold: true, align: 'center', col: C.ink })

    this.lineG = this.add.graphics()
    this.upArrow = this.add.graphics()
    this.downArrow = this.add.graphics()

    // profit meter frame
    this.panel(this.meterX - 26, this.meterTop - 8, 52, this.meterH + 16, { fill: C.gray100, stroke: C.hairline, radius: 12 })
    this.label(this.meterX, this.meterTop - 22, 'PROFIT', { size: this.fs(12, 12, 15), col: C.muted, align: 'center', bold: true })
    this.meterFill = this.add.graphics()

    // badge readout under the meter
    this.badgePanel = this.add.graphics()
    this.badge = this.add
      .text(this.meterX, this.meterTop + this.meterH + 30, '', { fontFamily: FONT, fontSize: `${this.fs(13, 12, 16)}px`, color: hex(C.greenText), fontStyle: 'bold' })
      .setOrigin(0.5)

    this.label(this.W / 2, this.H - 18, 'Some trades win when the stock moves — up OR down. They lose only if it stays still.', {
      size: this.fs(12, 12, 15),
      col: C.muted,
      align: 'center',
    })

    this.t0 = this.time.now
    this.buildSlider()
    if (this.reduceMotion) {
      // No scripted fan / no ambient vibration — show a calm, representative state and
      // let the slider carry the interaction.
      this.vibrate = false
      this.price = this.anchor
      this.drawAll()
      this.emitReady()
    } else {
      this.playIntro()
      this.drawAll()
    }
  }

  /** Scripted intro loop: arrows fan out (meter fills both ways), then settle flat (meter drains). */
  private playIntro(): void {
    this.vibrate = true
    // 0.8–1.6s: fan arrows up & down, drive price far up then far down
    this.tweens.addCounter({
      from: 0, to: 1, duration: 800, delay: 800, ease: 'Cubic.out',
      onUpdate: (tw) => { this.price = this.anchor + 26 * (tw.getValue() ?? 0); this.drawAll() },
    })
    this.tweens.addCounter({
      from: 1, to: -1, duration: 700, delay: 1700, ease: 'Sine.inOut',
      onUpdate: (tw) => { this.price = this.anchor + 26 * (tw.getValue() ?? 0); this.drawAll() },
    })
    // 1.6–2.2s settle flat → meter drains, red flash
    this.tweens.addCounter({
      from: -1, to: 0, duration: 600, delay: 2500, ease: 'Cubic.inOut',
      onUpdate: (tw) => { this.price = this.anchor + 26 * (tw.getValue() ?? 0); this.drawAll() },
      onComplete: () => { this.flashLoss(); this.emitReady() },
    })
  }

  private buildSlider(): void {
    const y = this.cy + 150
    this.label(this.cx, y - 22, 'drag the future price ↔', { size: this.fs(12, 12, 15), col: C.amberInk, bold: true, align: 'center' })
    const ctrl = this.slider(this.cx - this.lineW / 2, y, this.lineW, 70, 130, this.price, (v) => {
      this.vibrate = false
      this.userDragged = true
      this.price = v
      this.drawAll()
    }, { step: 0.5, col: C.amber })
    // sync slider with the scripted intro's final value (skip under reduced motion,
    // where there is no scripted intro to sync to, and skip if the learner already grabbed
    // the slider — otherwise this would snap the knob off their own drag).
    if (!this.reduceMotion) this.time.delayedCall(3200, () => { if (!this.userDragged) ctrl.set(this.anchor) })
  }

  update(): void {
    if (this.vibrate) this.drawAll()
  }

  private priceToX(p: number): number {
    // map 70..130 to the line width around center
    const t = (p - 70) / 60
    return this.cx - this.lineW / 2 + t * this.lineW
  }

  private drawAll(): void {
    this.drawLine()
    this.drawArrows()
    this.drawMeter()
    this.drawBadge()
  }

  private drawLine(): void {
    const g = this.lineG
    g.clear()
    const x = this.priceToX(this.price)
    // baseline (anchor) faint
    g.lineStyle(1, C.hairline)
    g.lineBetween(this.cx - this.lineW / 2, this.cy, this.cx + this.lineW / 2, this.cy)
    // anchor tick
    this.dashV(g, this.priceToX(this.anchor), this.cy - 70, this.cy + 70, C.blue, 0.4)
    // coiled vibrating line drawn toward the current price
    const jitter = this.vibrate ? Math.sin((this.time.now - this.t0) / 60) * 3 : 0
    g.lineStyle(3, C.blue, 1)
    g.beginPath()
    g.moveTo(this.cx - this.lineW / 2, this.cy)
    const segs = 26
    for (let i = 1; i <= segs; i++) {
      const fx = this.cx - this.lineW / 2 + (x - (this.cx - this.lineW / 2)) * (i / segs)
      const fy = this.cy + Math.sin(i * 0.9 + (this.time.now - this.t0) / 120) * jitter
      g.lineTo(fx, fy)
    }
    g.strokePath()
    // current price dot — amber: it's the value the learner drives with the slider.
    // Soft amber halo so the "you control this" point reads at a glance.
    g.fillStyle(C.amber, 0.18)
    g.fillCircle(x, this.cy, 13)
    g.fillStyle(C.amber, 1)
    g.fillCircle(x, this.cy, 7)
    g.lineStyle(2.5, C.white, 1)
    g.strokeCircle(x, this.cy, 7)
  }

  private drawArrows(): void {
    const up = this.upArrow
    const down = this.downArrow
    up.clear(); down.clear()
    const moved = this.price - this.anchor
    const mag = Math.min(1, Math.abs(moved) / 26)
    const x = this.priceToX(this.anchor)
    // up arrow grows with upward move, down arrow with downward move
    if (moved >= 0) {
      this.drawArrow(up, x, this.cy - 12, this.cy - 12 - 70 * mag, C.green, 0.25 + 0.6 * mag)
      this.drawArrow(down, x, this.cy + 12, this.cy + 12 + 6, C.red, 0.12)
    } else {
      this.drawArrow(down, x, this.cy + 12, this.cy + 12 + 70 * mag, C.red, 0.25 + 0.6 * mag)
      this.drawArrow(up, x, this.cy - 12, this.cy - 12 - 6, C.green, 0.12)
    }
  }

  private drawArrow(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha: number): void {
    g.lineStyle(4, col, alpha)
    g.lineBetween(x, y1, x, y2)
    const dir = Math.sign(y2 - y1) || 1
    g.fillStyle(col, alpha)
    g.fillTriangle(x - 6, y2, x + 6, y2, x, y2 + dir * 10)
  }

  private drawMeter(): void {
    const g = this.meterFill
    g.clear()
    const moved = Math.abs(this.price - this.anchor)
    // fill height proportional to distance moved (either way fills it)
    const frac = Math.min(1, moved / 26)
    const h = frac * this.meterH
    const top = this.meterTop + this.meterH - h
    const col = frac > 0.45 ? C.green : C.red
    g.fillStyle(col, frac > 0.45 ? 0.85 : 0.4)
    g.fillRoundedRect(this.meterX - 18, top, 36, h, 6)
  }

  private drawBadge(): void {
    const moved = Math.abs(this.price - this.anchor)
    const big = moved > 12
    const worst = moved < 1.5
    const text = worst ? 'worst case — no move' : big ? 'BIG MOVE → profit' : 'too quiet → loss'
    const col = big ? C.greenText : C.red
    this.badge.setText(text).setColor(hex(col))
    const w = this.badge.width + 20
    const bx = this.meterX - w / 2
    const by = this.meterTop + this.meterH + 18
    this.badgePanel.clear()
    this.badgePanel.fillStyle(big ? C.greenSoft : C.redSoft, 1)
    this.badgePanel.fillRoundedRect(bx, by, w, 24, 8)
  }

  private flashLoss(): void {
    const flash = this.add.rectangle(this.meterX, this.meterTop + this.meterH - 10, 40, 20, C.red, 0.6)
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() })
  }

  private dashV(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, col: number, alpha = 1): void {
    g.lineStyle(1.2, col, alpha)
    for (let y = y1; y < y2; y += 10) g.lineBetween(x, y, x, Math.min(y + 6, y2))
  }
}
