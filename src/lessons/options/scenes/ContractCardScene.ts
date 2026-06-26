import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex, FONT } from '../../../engine/palette'
import { intrinsic, type OptType } from './optionMath'

interface ContractCardParams {
  /** 'coupon' = module 1 morph + toggle/slider ; 'compare' = module 2 side-by-side. */
  variant?: 'coupon' | 'compare'
  K?: number
  /** illustrative per-share premium. */
  premium?: number
  days?: number
}

/**
 * ContractCardScene — the coupon→contract metaphor (module 1) and the call-vs-put
 * side-by-side comparison with the ×100 stamp (module 2).
 */
export default class ContractCardScene extends ModuleScene {
  private p!: Required<ContractCardParams>
  private type: OptType = 'call'

  protected build(): void {
    const raw = this.params as ContractCardParams
    this.p = {
      variant: raw.variant ?? 'coupon',
      K: raw.K ?? 100,
      premium: raw.premium ?? 5,
      days: raw.days ?? 30,
    }
    if (this.p.variant === 'compare') this.buildCompare()
    else this.buildCoupon()
    this.emitReady()
  }

  // --- MODULE 1: coupon morph + toggle + deadline slider --------------------
  private cardSentence?: Phaser.GameObjects.Text
  private daysLabel?: Phaser.GameObjects.Text
  private verbLabel?: Phaser.GameObjects.Text
  private days = 30

  private buildCoupon(): void {
    this.days = this.p.days
    const reduced = this.reduceMotion

    // ── The contract card (left) ──────────────────────────────────────────
    const cardX = 56
    const cardY = 64
    const cardW = 372
    const cardH = 184

    const card = this.panel(cardX, cardY, cardW, cardH, { fill: C.white, stroke: C.blue, radius: 14 })
    card.setAlpha(reduced ? 1 : 0)
    // Fade the card in only. (A previous infinite y-float drifted the border while the
    // absolutely-positioned text inside stayed put — a visible desync; removed.)
    if (!reduced) this.tweens.add({ targets: card, alpha: 1, duration: 420, ease: 'Cubic.out' })

    const eyebrow = this.label(cardX + 22, cardY + 26, 'OPTION CONTRACT (illustrative)', {
      size: 13,
      col: C.blue,
      bold: true,
    })
    eyebrow.setAlpha(reduced ? 1 : 0)
    if (!reduced) this.tweens.add({ targets: eyebrow, alpha: 1, duration: 360, delay: 500 })

    this.verbLabel = this.label(cardX + 22, cardY + 62, '', { size: 22, col: C.green, bold: true })
    this.verbLabel.setAlpha(reduced ? 1 : 0)
    if (!reduced) this.tweens.add({ targets: this.verbLabel, alpha: 1, duration: 360, delay: 700 })

    this.cardSentence = this.add.text(cardX + 22, cardY + 94, '', {
      fontFamily: FONT,
      fontSize: '15px',
      color: hex(C.ink),
      lineSpacing: 4,
      wordWrap: { width: cardW - 44 },
    })
    this.cardSentence.setAlpha(reduced ? 1 : 0)
    if (!reduced) this.tweens.add({ targets: this.cardSentence, alpha: 1, duration: 360, delay: 850 })

    this.daysLabel = this.label(cardX + 22, cardY + cardH - 26, '', { size: 13, col: C.muted })

    // ── The "= 100 shares" panel (right) — the ×100 multiplier, made visible ──
    this.buildShareStack(456, cardY, 248, cardH, reduced)

    // ── Controls below ────────────────────────────────────────────────────
    this.couponToggle(cardX + 22, cardY + cardH + 44)
    const sx = cardX + 22
    this.label(sx, cardY + cardH + 84, 'Deadline (days to expiry)', { size: 13, col: C.muted })
    this.slider(sx, cardY + cardH + 108, 440, 7, 365, this.days, (v) => {
      this.days = Math.round(v)
      this.updateCoupon()
    })

    this.updateCoupon()
  }

  /** The right-hand panel: one contract controls a 10×10 grid of 100 shares. */
  private buildShareStack(x: number, y: number, w: number, h: number, reduced: boolean): void {
    this.panel(x, y, w, h, { fill: C.surface, stroke: C.hairline, radius: 14 })
    const cx = x + w / 2
    this.label(cx, y + 24, 'ONE CONTRACT', { size: 13, col: C.muted, bold: true, align: 'center' })

    const gridCY = y + h / 2 + 4
    const cell = 9
    const sizePx = 6.5
    const origin = -((10 - 1) * cell) / 2
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const tile = this.add
          .rectangle(cx + origin + c * cell, gridCY + origin + r * cell, sizePx, sizePx, C.blueSoft)
          .setStrokeStyle(0.5, C.blue, 0.45)
        if (!reduced) {
          tile.setAlpha(0)
          this.tweens.add({ targets: tile, alpha: 1, duration: 180, delay: 700 + (r * 10 + c) * 5 })
        }
      }
    }

    // ×100 stamp pops over the grid once it has populated
    const stamp = this.label(cx, gridCY, '×100', { size: 26, col: C.blue, bold: true, align: 'center', bg: true })
    if (!reduced) {
      stamp.setScale(0)
      this.tweens.add({ targets: stamp, scale: 1, duration: 360, delay: 1300, ease: 'Back.out' })
    }
    this.label(cx, y + h - 22, '= 100 shares of XYZ', { size: 13, col: C.ink, bold: true, align: 'center' })
  }

  private couponToggle(x: number, y: number): void {
    const segW = 70
    const h = 30
    const bg = this.add.graphics()
    bg.fillStyle(C.gray100, 1)
    bg.fillRoundedRect(x, y - h / 2, segW * 2, h, 9)
    const hi = this.add.graphics()
    const labels = ['CALL', 'PUT']
    const texts: Phaser.GameObjects.Text[] = []
    const draw = (active: number) => {
      hi.clear()
      hi.fillStyle(active === 0 ? C.green : C.red, 1)
      hi.fillRoundedRect(x + active * segW, y - h / 2, segW, h, 9)
      texts.forEach((t, i) => t.setColor(i === active ? hex(C.white) : hex(C.muted)))
    }
    labels.forEach((lab, i) => {
      const t = this.add
        .text(x + i * segW + segW / 2, y, lab, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      t.on('pointerup', () => {
        this.type = i === 0 ? 'call' : 'put'
        draw(i)
        this.updateCoupon()
      })
      texts.push(t)
    })
    draw(0)
  }

  private updateCoupon(): void {
    if (!this.cardSentence || !this.daysLabel || !this.verbLabel) return
    const isCall = this.type === 'call'
    const verb = isCall ? 'BUY' : 'SELL'
    const verbCol = isCall ? C.green : C.red
    // a prominent coloured verb on its own line, then the neutral rest of the sentence
    this.verbLabel.setText(`RIGHT to ${verb}`).setColor(hex(verbCol))
    if (!this.reduceMotion)
      this.tweens.add({ targets: this.verbLabel, scale: { from: 1.12, to: 1 }, duration: 220, ease: 'Back.out' })
    this.cardSentence.setText(`100 shares of XYZ at $${this.p.K} each,\non or before expiry.  (${isCall ? 'a CALL' : 'a PUT'})`)

    if (this.days <= 9) {
      this.daysLabel.setText(`Expires in ${this.days} days  ·  less time = usually less value`)
      this.daysLabel.setColor(hex(C.red))
    } else {
      this.daysLabel.setText(`Expires in ${this.days} days  ·  covers 100 shares`)
      this.daysLabel.setColor(hex(C.muted))
    }
  }

  // --- MODULE 2: call vs put compare with ×100 stamp ------------------------
  private buildCompare(): void {
    const cardW = 250
    const cardH = 250
    const gap = 40
    const totalW = cardW * 2 + gap
    const x0 = (this.W - totalW) / 2
    const cardY = 56

    this.makeSideCard(x0, cardY, cardW, cardH, 'call')
    this.makeSideCard(x0 + cardW + gap, cardY, cardW, cardH, 'put')
  }

  private makeSideCard(x: number, y: number, w: number, h: number, type: OptType): void {
    const accent = type === 'call' ? C.green : C.red
    const card = this.panel(x, y, w, h, { fill: C.white, stroke: accent, radius: 14 })
    // panel() draws at absolute (x,y) with the graphics' own x/y at 0, so the
    // slide-in must tween a relative offset back to 0 (tweening to the absolute x
    // would double-apply the offset and push the card off its intended position).
    if (this.reduceMotion) card.setAlpha(1)
    else {
      card.setAlpha(0)
      card.x = type === 'call' ? -40 : 40
      this.tweens.add({ targets: card, alpha: 1, x: 0, duration: 500, ease: 'Expo.out' })
    }

    this.label(x + 18, y + 28, type === 'call' ? 'CALL' : 'PUT', { size: 20, col: accent, bold: true })
    const verb = type === 'call' ? 'BUY' : 'SELL'
    this.label(x + 18, y + 62, `Right to ${verb} 100 @ $${this.p.K}`, { size: 14, col: C.ink, bold: true })
    this.label(x + 18, y + 90, type === 'call' ? 'Good if the stock goes UP' : 'Good if the stock goes DOWN', {
      size: 13,
      col: accent,
      bold: true,
    })

    // plain worked example
    const exS = type === 'call' ? 110 : 90
    const gain = intrinsic(type, exS, this.p.K)
    this.label(x + 18, y + 124, 'Example', { size: 12, col: C.muted })
    const ribbon = this.label(
      x + 18,
      y + 148,
      type === 'call'
        ? `Stock at $${exS}: buy at $${this.p.K}, make $${gain}/share`
        : `Stock at $${exS}: sell at $${this.p.K}, make $${gain}/share`,
      { size: 13, col: accent, bold: true },
    )
    ribbon.setWordWrapWidth(w - 36)

    // ×100 stamp turning premium $3.00 → $300 (count-up)
    this.label(x + 18, y + 198, 'Premium $3.00/share (illustrative)', { size: 12, col: C.muted })
    const cost = this.label(x + 18, y + 220, '×100 = $0', { size: 15, col: C.blue, bold: true })
    if (this.reduceMotion) {
      cost.setText('×100 = $300')
    } else {
      const obj = { v: 0 }
      this.tweens.add({
        targets: obj,
        v: 300,
        duration: 1100,
        delay: 800,
        onUpdate: () => cost.setText(`×100 = $${Math.round(obj.v)}`),
      })
    }
  }
}
