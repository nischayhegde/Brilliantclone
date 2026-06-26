import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'

interface ThetaParams {
  K?: number
  S?: number
  /** illustrative time value at the start (far from expiry). */
  tv0?: number
  /** total life in days. */
  days?: number
  /** 'ITM' | 'ATM' | 'OTM' starting floor. */
  money?: 'ITM' | 'ATM' | 'OTM'
}

/**
 * ThetaDecayScene — time value is a MELTING ICE CUBE sitting on the intrinsic
 * floor. Drag days-to-expiry from 60d → 0d: the cube melts slowly while far out
 * and faster as the deadline nears (time value ∝ √(dte/days)), pooling into a
 * puddle, until only the constant intrinsic floor is left. The decay/intrinsic
 * math and the days-to-expiry drag are unchanged.
 */
export default class ThetaDecayScene extends ModuleScene {
  private p!: Required<ThetaParams>
  private money: 'ITM' | 'ATM' | 'OTM' = 'ITM'
  private intr = 5
  private dte = 60

  // layout (DESIGN space)
  private cx = 300
  private groundY = 344
  private cubeW = 116
  private slabW = 150
  private px = 25 // px per $ of value

  // live geometry, read by the drip spawner
  private tv = 3
  private cubeTopY = 0
  private cubeBottomY = 0

  // redrawn graphics
  private slab!: Phaser.GameObjects.Graphics
  private cube!: Phaser.GameObjects.Graphics
  private puddle!: Phaser.GameObjects.Graphics
  private ghost!: Phaser.GameObjects.Graphics
  private guides!: Phaser.GameObjects.Graphics
  private readouts!: Phaser.GameObjects.Text
  private tvLabel!: Phaser.GameObjects.Text
  private tvChip!: Phaser.GameObjects.Graphics
  private intrLabel!: Phaser.GameObjects.Text
  private intrChip!: Phaser.GameObjects.Graphics
  private ghostLabel!: Phaser.GameObjects.Text
  private ghostChip!: Phaser.GameObjects.Graphics

  protected build(): void {
    const raw = this.params as ThetaParams
    this.p = {
      K: raw.K ?? 100,
      S: raw.S ?? 105,
      tv0: raw.tv0 ?? 3,
      days: raw.days ?? 60,
      money: raw.money ?? 'ITM',
    }
    this.money = this.p.money
    this.dte = this.p.days
    this.recomputeIntrinsic()

    // Vertical scale: size px-per-$ so the tallest possible stack (full time value
    // on top of the deepest intrinsic floor) still fits above the title.
    const maxV = this.p.tv0 + Math.max(this.p.S - this.p.K, 0) + 2
    const avail = this.groundY - 92
    this.px = maxV > 0 ? avail / maxV : 25

    this.label(40, 24, 'TIME VALUE MELTS AWAY', { size: this.fs(16), col: C.ink, bold: true })
    this.label(40, 46, '(time value illustrative)', { size: this.fs(13), col: C.muted })

    // ground the cube + floor sit on
    const ground = this.add.graphics()
    ground.lineStyle(1.5, C.hairline)
    ground.lineBetween(this.cx - 170, this.groundY, this.cx + 210, this.groundY)

    this.ghost = this.add.graphics()
    this.puddle = this.add.graphics()
    this.slab = this.add.graphics()
    this.cube = this.add.graphics()
    this.guides = this.add.graphics()

    this.readouts = this.label(40, 372, '', { size: this.fs(13), col: C.ink, bold: true })

    // persistent annotation labels (re-targeted each refresh so toggles never stack them)
    this.tvChip = this.add.graphics()
    this.tvLabel = this.label(this.cx + this.cubeW / 2 + 14, 0, '', { size: this.fs(13), col: C.blue, bold: true })
    this.intrChip = this.add.graphics()
    this.intrLabel = this.label(this.cx + this.cubeW / 2 + 14, 0, '', { size: this.fs(13), col: C.blueDark, bold: true })
    this.ghostChip = this.add.graphics()
    this.ghostLabel = this.label(this.cx - this.cubeW / 2, 0, '', { size: this.fs(12), col: C.muted })

    // controls: moneyness toggle + days-to-expiry slider
    this.label(60, 404, 'In the money?', { size: this.fs(13), col: C.muted })
    this.toggle(60, 426, ['OTM', 'ATM', 'ITM'], 2, (i) => {
      this.money = (['OTM', 'ATM', 'ITM'] as const)[i]
      this.recomputeIntrinsic()
      this.refresh()
    })
    // The slider tracks "elapsed" (left = start, right = expiry) so the thumb and the
    // melting cube move the same way; dte = days − elapsed.
    this.label(380, 404, 'Days to expiry', { size: this.fs(13), col: C.muted })
    this.slider(380, 426, 300, 0, this.p.days, this.p.days - this.dte, (v) => {
      this.dte = this.p.days - v
      this.refresh()
    })

    this.refresh()
    this.entrance()
    this.startDrips()
    this.emitReady()
  }

  private recomputeIntrinsic(): void {
    // ITM: S>K (call) → S−K ; ATM/OTM floor = 0
    this.intr = this.money === 'ITM' ? Math.max(this.p.S - this.p.K, 0) : 0
  }

  // illustrative decay: time value ∝ sqrt(dte/days) so it melts faster near expiry
  private tvAt(dte: number): number {
    return this.p.tv0 * Math.sqrt(Math.max(dte, 0) / this.p.days)
  }

  private chipFor(g: Phaser.GameObjects.Graphics, t: Phaser.GameObjects.Text): void {
    const padX = 6
    const padY = 3
    g.clear()
    g.fillStyle(C.white, 0.85)
    g.fillRoundedRect(
      t.x - t.originX * t.width - padX,
      t.y - t.originY * t.height - padY,
      t.width + padX * 2,
      t.height + padY * 2,
      5,
    )
    this.children.moveBelow(g, t)
  }

  private dashSeg(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dash = 7, gap = 5): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len === 0) return
    const ux = dx / len
    const uy = dy / len
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(d + dash, len)
      g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e)
    }
  }

  private refresh(): void {
    const tv = this.tvAt(this.dte)
    this.tv = tv
    const total = this.intr + tv
    const intrH = this.intr * this.px
    const tvH = tv * this.px
    const slabTopY = this.groundY - intrH
    const cubeTopY = slabTopY - tvH
    this.cubeTopY = cubeTopY
    this.cubeBottomY = slabTopY
    const halfS = this.slabW / 2
    const halfC = this.cubeW / 2

    // intrinsic floor — a solid blue slab (the constant, in-the-money part)
    this.slab.clear()
    if (intrH > 0.5) {
      this.slab.fillStyle(C.blue, 1)
      this.slab.fillRoundedRect(this.cx - halfS, slabTopY, this.slabW, intrH, 6)
      this.slab.fillStyle(C.blueDark, 1)
      this.slab.fillRect(this.cx - halfS, slabTopY, this.slabW, 3)
    }

    // ghost outline of the cube's ORIGINAL size, so the amount melted is visible
    this.ghost.clear()
    const ghostTopY = slabTopY - this.p.tv0 * this.px
    this.ghost.lineStyle(1.5, C.blue, 0.35)
    this.dashSeg(this.ghost, this.cx - halfC, ghostTopY, this.cx + halfC, ghostTopY)
    this.dashSeg(this.ghost, this.cx - halfC, ghostTopY, this.cx - halfC, slabTopY)
    this.dashSeg(this.ghost, this.cx + halfC, ghostTopY, this.cx + halfC, slabTopY)

    // melt puddle on the floor surface — widens as the cube shrinks
    this.puddle.clear()
    const meltFrac = this.p.tv0 > 0 ? (this.p.tv0 - tv) / this.p.tv0 : 0
    const pw = this.cubeW * 0.7 + meltFrac * 150
    if (meltFrac > 0.01) {
      this.puddle.fillStyle(C.blueSoft, 0.95)
      this.puddle.fillEllipse(this.cx, slabTopY + 2, pw, 12)
      this.puddle.lineStyle(1, C.blue, 0.3)
      this.puddle.strokeEllipse(this.cx, slabTopY + 2, pw, 12)
    }

    // the ice cube — translucent, icy, with a highlight + melt-rounded corners
    this.cube.clear()
    if (tvH > 0.5) {
      const r = Math.min(10, tvH / 2)
      this.cube.fillStyle(C.blueSoft, 0.96)
      this.cube.fillRoundedRect(this.cx - halfC, cubeTopY, this.cubeW, tvH, r)
      this.cube.lineStyle(1.5, C.blue, 0.7)
      this.cube.strokeRoundedRect(this.cx - halfC, cubeTopY, this.cubeW, tvH, r)
      if (tvH > 18) {
        this.cube.fillStyle(C.white, 0.5)
        this.cube.fillRoundedRect(this.cx - halfC + 9, cubeTopY + 7, 15, tvH - 14, 4)
      }
    }

    // thin connectors from the stack to its value labels
    this.guides.clear()
    this.guides.lineStyle(1, C.muted, 0.35)
    if (tvH > 0.5) this.guides.lineBetween(this.cx + halfC, cubeTopY + tvH / 2, this.cx + halfC + 12, cubeTopY + tvH / 2)
    if (intrH > 0.5) this.guides.lineBetween(this.cx + halfS, slabTopY + intrH / 2, this.cx + halfC + 12, slabTopY + intrH / 2)

    // value labels
    this.tvLabel.setText(`time value ${tv.toFixed(2)} → 0`).setY(tvH > 14 ? cubeTopY + tvH / 2 : cubeTopY - 8)
    this.chipFor(this.tvChip, this.tvLabel)
    this.intrLabel
      .setText(`real value ${this.intr.toFixed(2)} (stays put)`)
      .setY(intrH > 14 ? slabTopY + intrH / 2 : this.groundY - 8)
    this.chipFor(this.intrChip, this.intrLabel)
    this.ghostLabel.setText(`started at ${this.p.tv0.toFixed(2)}`).setY(ghostTopY - 10)
    this.ghostLabel.setAlpha(meltFrac > 0.02 ? 1 : 0)
    if (meltFrac > 0.02) this.chipFor(this.ghostChip, this.ghostLabel)
    else this.ghostChip.clear()

    this.readouts.setText(
      `${this.dte.toFixed(0)} days left   real value ${this.intr.toFixed(2)} (stays)   time value ${tv.toFixed(
        2,
      )} → 0   total price ${total.toFixed(2)}`,
    )
    this.readouts.setColor(hex(this.dte <= 0 ? C.red : C.ink))
  }

  /** Stagger the slab, cube and puddle into view (instant under reduced motion). */
  private entrance(): void {
    const targets = [this.slab, this.cube, this.ghost, this.puddle, this.guides]
    targets.forEach((t) => (t.alpha = 0))
    this.tweens.add({ targets, alpha: 1, duration: this.dur(380), ease: 'Cubic.out' })
  }

  /** Periodic meltwater droplets sliding down the cube into the puddle. */
  private startDrips(): void {
    if (this.reduceMotion) return
    this.time.addEvent({ delay: 1500, loop: true, callback: () => this.spawnDrip() })
  }

  private spawnDrip(): void {
    if (this.tv <= 0.25) return
    const x = this.cx + this.cubeW * 0.32
    const d = this.add.circle(x, this.cubeTopY + 6, 3, C.blue, 0.85)
    this.tweens.add({
      targets: d,
      y: this.cubeBottomY,
      alpha: 0.15,
      duration: 700,
      ease: 'Quad.in',
      onComplete: () => d.destroy(),
    })
  }

  private toggle(x: number, y: number, labels: string[], start: number, onPick: (i: number) => void): void {
    const segW = 56
    const h = 28
    const x0 = x
    const bg = this.add.graphics()
    bg.fillStyle(C.gray100, 1)
    bg.fillRoundedRect(x0, y - h / 2, segW * labels.length, h, 8)
    const hi = this.add.graphics()
    const texts: Phaser.GameObjects.Text[] = []
    const draw = (active: number) => {
      hi.clear()
      hi.fillStyle(C.blue, 1)
      hi.fillRoundedRect(x0 + active * segW, y - h / 2, segW, h, 8)
      texts.forEach((t, i) => t.setColor(i === active ? hex(C.white) : hex(C.muted)))
    }
    labels.forEach((lab, i) => {
      const t = this.add
        .text(x0 + i * segW + segW / 2, y, lab, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold' })
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
