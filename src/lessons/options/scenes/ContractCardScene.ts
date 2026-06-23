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
    const cx = this.W / 2
    const cardW = 420
    const cardH = 168
    const cardX = cx - cardW / 2
    const cardY = 70

    // share-stack grid behind the card (10×10 light-blue tiles)
    const stack = this.add.container(cx + 150, cardY + cardH / 2)
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const tile = this.add
          .rectangle(-45 + c * 9, -45 + r * 9, 7, 7, C.blueSoft)
          .setStrokeStyle(0.5, C.blue, 0.4)
          .setAlpha(0)
        stack.add(tile)
        this.tweens.add({ targets: tile, alpha: 1, duration: 200, delay: 1400 + (r * 10 + c) * 6 })
      }
    }
    const stamp = this.label(cx + 150, cardY + cardH / 2, '×100', { size: 24, col: C.blue, bold: true, align: 'center' })
    stamp.setScale(0)
    this.tweens.add({ targets: stamp, scale: 1, duration: 360, delay: 2000, ease: 'Back.out' })

    // the card itself
    const card = this.panel(cardX, cardY, cardW, cardH, { fill: C.white, stroke: C.blue, radius: 14 })
    card.setAlpha(0)
    this.tweens.add({ targets: card, alpha: 1, duration: 500 })
    this.tweens.add({ targets: card, y: card.y - 4, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.inOut' })

    // "COUPON" eyebrow → cross-fades to contract framing
    const eyebrow = this.label(cardX + 20, cardY + 24, 'OPTION CONTRACT (illustrative)', {
      size: 11,
      col: C.blue,
      bold: true,
    })
    eyebrow.setAlpha(0)
    this.tweens.add({ targets: eyebrow, alpha: 1, duration: 400, delay: 700 })

    this.verbLabel = this.label(cardX + 20, cardY + 56, '', { size: 20, col: C.green, bold: true })
    this.verbLabel.setAlpha(0)
    this.tweens.add({ targets: this.verbLabel, alpha: 1, duration: 400, delay: 900 })

    this.cardSentence = this.add.text(cardX + 20, cardY + 80, '', {
      fontFamily: FONT,
      fontSize: '15px',
      color: hex(C.ink),
      wordWrap: { width: cardW - 40 },
    })
    this.cardSentence.setAlpha(0)
    this.tweens.add({ targets: this.cardSentence, alpha: 1, duration: 400, delay: 1000 })

    this.daysLabel = this.label(cardX + 20, cardY + 138, '', { size: 13, col: C.muted })

    // CALL/PUT toggle
    this.couponToggle(cardX + 20, cardY + cardH + 36)
    // deadline slider
    this.label(cx - 150, cardY + cardH + 78, 'Deadline (days to expiry)', { size: 12, col: C.muted })
    this.slider(cx - 150, cardY + cardH + 98, 300, 7, 365, this.days, (v) => {
      this.days = Math.round(v)
      this.updateCoupon()
    })

    this.updateCoupon()
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
    this.tweens.add({ targets: this.verbLabel, scale: { from: 1.12, to: 1 }, duration: 220, ease: 'Back.out' })
    this.cardSentence.setText(`100 shares of XYZ at $${this.p.K} each,\non or before expiry.  (${isCall ? 'a CALL' : 'a PUT'})`)

    if (this.days <= 9) {
      this.daysLabel.setText(`Expires in ${this.days} days  ·  less time = usually less value`)
      this.daysLabel.setColor(hex(C.red))
    } else {
      this.daysLabel.setText(`Expires in ${this.days} days  ·  multiplier ×100 shares`)
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

    // central S gauge sweeping 90 → 110
    const gx = this.W / 2
    const marker = this.add.circle(gx, cardY + 30, 6, C.blue).setStrokeStyle(2, C.white)
    const sLbl = this.label(gx, cardY + 12, 'S sweeps 90 → 110', { size: 11, col: C.blue, bold: true, align: 'center' })
    sLbl.setDepth(5)
    this.tweens.add({
      targets: marker,
      y: cardY + cardH - 30,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })
  }

  private makeSideCard(x: number, y: number, w: number, h: number, type: OptType): void {
    const accent = type === 'call' ? C.green : C.red
    const card = this.panel(x, y, w, h, { fill: C.white, stroke: accent, radius: 14 })
    card.setAlpha(0)
    this.tweens.add({ targets: card, alpha: 1, x: { from: x + (type === 'call' ? -40 : 40), to: x }, duration: 500 })

    this.label(x + 18, y + 26, type === 'call' ? 'CALL' : 'PUT', { size: 20, col: accent, bold: true })
    const verb = type === 'call' ? 'BUY' : 'SELL'
    this.label(x + 18, y + 56, `Right to ${verb}`, { size: 14, col: C.ink, bold: true })
    this.label(x + 18, y + 78, `100 shares @ $${this.p.K}`, { size: 14, col: C.ink })
    this.label(x + 18, y + 104, type === 'call' ? 'Helps when  S > K' : 'Helps when  S < K', {
      size: 13,
      col: accent,
      bold: true,
    })

    // worked example ribbon
    const exS = type === 'call' ? 110 : 90
    const gain = intrinsic(type, exS, this.p.K)
    this.label(x + 18, y + 134, `Example: S=${exS}, K=${this.p.K}`, { size: 12, col: C.muted })
    const ribbon = this.label(
      x + 18,
      y + 156,
      type === 'call' ? `buy 100 @ 100, worth ${exS} → +$${gain}/sh` : `sell 100 @ 100 into ${exS} → +$${gain}/sh`,
      { size: 12, col: accent, bold: true },
    )
    ribbon.setWordWrapWidth(w - 36)

    // ×100 stamp turning premium $3.00 → $300 (count-up)
    this.label(x + 18, y + 196, 'Premium $3.00/sh (illustrative)', { size: 11, col: C.muted })
    const cost = this.label(x + 18, y + 218, '×100 = $0', { size: 15, col: C.blue, bold: true })
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
