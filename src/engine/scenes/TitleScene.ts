import { ModuleScene } from '../ModuleScene'
import { C, type ColorName } from '../palette'

interface TitleParams {
  headline?: string
  subline?: string
  lines?: string[]
  accent?: ColorName
}

/**
 * Lightweight animated text scene: a headline + optional bullet lines that fade in.
 * Used for INTRO modules and as a safe fallback while richer scenes are authored.
 */
export default class TitleScene extends ModuleScene {
  protected build(): void {
    const p = this.params as TitleParams
    const accent = p.accent ?? 'blue'
    const cx = this.W / 2

    const badge = this.add.circle(cx, 96, 34, C[accent === 'green' ? 'greenSoft' : 'blueSoft'])
    const dot = this.add.circle(cx, 96, 12, C[accent])
    badge.setScale(0)
    dot.setScale(0)
    this.tweens.add({ targets: [badge, dot], scale: 1, duration: 420, ease: 'Back.out' })

    if (p.headline) {
      const h = this.label(cx, 168, p.headline, { size: 26, bold: true, align: 'center', col: C.ink })
      h.setWordWrapWidth(this.W - 120)
      this.fadeIn(h, 180)
    }
    if (p.subline) {
      const s = this.label(cx, 210, p.subline, { size: 15, align: 'center', col: C.muted })
      s.setWordWrapWidth(this.W - 160)
      this.fadeIn(s, 320)
    }

    const lines = p.lines ?? []
    lines.forEach((ln, i) => {
      const y = 262 + i * 36
      const bullet = this.add.circle(cx - 150, y, 4, C[accent])
      const t = this.label(cx - 134, y, ln, { size: 15, col: C.ink })
      t.setWordWrapWidth(this.W - 280)
      bullet.setAlpha(0)
      this.fadeIn(t, 460 + i * 140)
      this.tweens.add({ targets: bullet, alpha: 1, duration: 300, delay: 460 + i * 140 })
    })

    this.time.delayedCall(500 + lines.length * 140, () => this.emitReady())
  }
}
