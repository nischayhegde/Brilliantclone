import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtMoney, fmtPrice } from './book'

interface Anchor {
  name: string
  bid: number
  ask: number
}
interface SpreadCostParams {
  anchors?: Anchor[]
  startShares?: number
}

const DEFAULT_ANCHORS: Anchor[] = [
  { name: 'Mega-cap (~$400, 1¢)', bid: 400.0, ask: 400.01 },
  { name: 'Small-cap (~$5, 10¢)', bid: 4.95, ask: 5.05 },
]

/**
 * MODULE 11 — TEACH "The Spread Is a Cost". A token buys at the ask and immediately
 * sells at the bid; a cost meter tallies ½ spread + ½ spread = the full spread, then
 * converts to % of mid. The learner flips between two anchors (AAPL-like penny spread
 * vs a $5 dime-spread micro-cap) and a share-size slider; readouts show per-side cost
 * vs mid, round-trip $ cost, and spread-as-% — diverging ~800× between the anchors.
 */
export default class SpreadCostScene extends ModuleScene {
  private anchors: Anchor[] = []
  private anchorIdx = 0
  private shares = 1000

  private bid = 0
  private ask = 0

  private readouts: Record<string, Phaser.GameObjects.Text> = {}
  private token!: Phaser.GameObjects.Arc
  private meterFill!: Phaser.GameObjects.Graphics
  private anchorBtns: Phaser.GameObjects.Container[] = []

  private readonly axisX = 150
  private readonly yAsk = 110
  private readonly yMid = 180
  private readonly yBid = 250

  protected build(): void {
    const p = this.params as SpreadCostParams
    this.anchors = p.anchors ?? DEFAULT_ANCHORS
    this.shares = p.startShares ?? 1000
    this.setAnchor(0)

    this.label(this.W / 2, 30, 'Buy at the ask, sell at the bid — a round-trip pays the full spread', {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated quote; math exact', { size: 11, col: C.blue }).setAlpha(0.8)

    this.drawAxis()
    this.buildMeter()
    this.buildPanel()
    this.buildControls()

    this.token = this.add.circle(this.axisX, this.yMid, 9, C.green).setStrokeStyle(2, C.white)
    this.refresh()
    this.time.delayedCall(500, () => {
      this.playRoundTrip()
      this.emitReady()
    })
  }

  private setAnchor(i: number): void {
    this.anchorIdx = i
    this.bid = this.anchors[i].bid
    this.ask = this.anchors[i].ask
  }

  private get spread() { return this.ask - this.bid }
  private get mid() { return (this.ask + this.bid) / 2 }

  private drawAxis(): void {
    const g = this.add.graphics()
    g.lineStyle(2, C.hairline, 1)
    g.lineBetween(this.axisX, this.yAsk - 20, this.axisX, this.yBid + 20)
    // ask / mid / bid markers
    const mark = (y: number, col: number, txt: string, name: string) => {
      this.add.circle(this.axisX, y, 5, col)
      const t = this.label(this.axisX + 14, y, txt, { size: 13, col, bold: true })
      t.setName(name)
    }
    mark(this.yAsk, C.red, '', 'askLbl')
    mark(this.yMid, C.blue, '', 'midLbl')
    mark(this.yBid, C.green, '', 'bidLbl')

    // blue caliper for the spread
    const cal = this.add.graphics()
    cal.lineStyle(2, C.blue, 1)
    const calX = this.axisX - 30
    cal.lineBetween(calX, this.yAsk, calX, this.yBid)
    cal.lineBetween(calX - 6, this.yAsk, calX + 6, this.yAsk)
    cal.lineBetween(calX - 6, this.yBid, calX + 6, this.yBid)
    // half markers
    cal.lineStyle(1, C.blue, 0.5)
    cal.lineBetween(calX - 4, this.yMid, calX + 4, this.yMid)
  }

  private buildMeter(): void {
    const mx = 470
    const my = 90
    const mw = 250
    const mh = 30
    this.label(mx, my - 18, 'Round-trip cost meter', { size: 12, col: C.muted })
    const frame = this.add.graphics()
    frame.lineStyle(2, C.ink, 1)
    frame.strokeRoundedRect(mx, my, mw, mh, 6)
    this.meterFill = this.add.graphics()
    // half-spread tick at midpoint
    frame.lineStyle(1, C.muted, 1)
    frame.lineBetween(mx + mw / 2, my, mx + mw / 2, my + mh)
    this.label(mx + mw / 2, my + mh + 12, '½ spread', { size: 10, col: C.muted, align: 'center' })
    this.label(mx + mw, my + mh + 12, 'full spread', { size: 10, col: C.muted, align: 'right' })
  }

  private drawMeter(fraction: number): void {
    const mx = 470
    const my = 90
    const mw = 250
    const mh = 30
    this.meterFill.clear()
    this.meterFill.fillStyle(fraction >= 0.99 ? C.red : C.blue, 0.85)
    this.meterFill.fillRoundedRect(mx + 2, my + 2, (mw - 4) * Math.min(1, fraction), mh - 4, 5)
  }

  private buildPanel(): void {
    const px = 470
    const py = 160
    this.panel(px, py, 270, 175, { fill: C.blueSoft, stroke: C.blue, radius: 10 })
    const mk = (key: string, y: number, lbl: string) => {
      this.label(px + 16, py + y, lbl, { size: 12, col: C.muted })
      this.readouts[key] = this.label(px + 254, py + y, '—', { size: 13, col: C.ink, bold: true, align: 'right' })
    }
    this.label(px + 16, py + 20, 'Per 1,000-share round-trip', { size: 12, col: C.blue, bold: true })
    mk('spread', 48, 'Spread')
    mk('half', 74, '½-spread / side')
    mk('rt', 100, 'Round-trip / sh')
    mk('rtTotal', 126, 'Round-trip cost')
    mk('pct', 152, 'Spread % of mid')
  }

  private buildControls(): void {
    // anchor toggle
    this.label(150, 300, 'Anchor:', { size: 12, col: C.muted, align: 'center' })
    this.anchors.forEach((a, i) => {
      const c = this.button(150, 326 + i * 38, a.name, () => {
        this.setAnchor(i)
        this.refresh()
        this.restyleAnchors()
        this.playRoundTrip()
      }, { w: 240, h: 30, fill: C.gray200, textCol: C.muted })
      this.anchorBtns.push(c)
    })
    this.restyleAnchors()

    // share size slider
    this.label(this.W / 2 + 180, 380, 'Shares', { size: 11, col: C.muted, align: 'center' })
    this.slider(450, 405, 280, 100, 5000, this.shares, (v) => {
      this.shares = Math.round(v / 100) * 100
      this.refresh()
    }, { step: 100, col: C.blue })
  }

  private restyleAnchors(): void {
    this.anchorBtns.forEach((c, i) => {
      const g = c.getAt(0) as Phaser.GameObjects.Graphics
      const t = c.getAt(1) as Phaser.GameObjects.Text
      g.clear()
      const on = i === this.anchorIdx
      g.fillStyle(on ? C.blue : C.gray200, 1)
      g.fillRoundedRect(-120, -15, 240, 30, 8)
      t.setColor(hex(on ? C.white : C.muted))
    })
  }

  private refresh(): void {
    ;(this.children.getByName('askLbl') as Phaser.GameObjects.Text).setText(`ASK ${fmtPrice(this.ask)}`)
    ;(this.children.getByName('bidLbl') as Phaser.GameObjects.Text).setText(`BID ${fmtPrice(this.bid)}`)
    ;(this.children.getByName('midLbl') as Phaser.GameObjects.Text).setText(`MID ${this.fmtMid(this.mid)}`)

    const spread = this.spread
    const half = spread / 2
    const rt = spread
    const rtTotal = spread * this.shares
    const pct = (spread / this.mid) * 100

    this.readouts.spread.setText(fmtPrice(spread))
    this.readouts.half.setText(fmtPrice(half, 3))
    this.readouts.rt.setText(fmtPrice(rt))
    this.readouts.rtTotal.setText(fmtMoney(rtTotal, 2))
    this.readouts.pct.setText(`${pct.toFixed(pct < 0.01 ? 4 : pct < 1 ? 3 : 1)}%`)
    this.readouts.pct.setColor(hex(pct >= 1 ? C.red : C.green))

    this.drawMeter(1)
  }

  private fmtMid(m: number): string {
    return Math.abs(m * 100 - Math.round(m * 100)) > 1e-6 ? m.toFixed(3) : m.toFixed(2)
  }

  private playRoundTrip(): void {
    // token: mid -> ask (buy), then mid -> bid (sell); meter fills half then full
    this.token.setPosition(this.axisX, this.yMid)
    this.drawMeter(0)
    this.tweens.add({
      targets: this.token,
      y: this.yAsk,
      duration: 500,
      ease: 'Cubic.out',
      onComplete: () => {
        this.drawMeter(0.5)
        this.tweens.add({
          targets: this.token,
          y: this.yBid,
          duration: 700,
          delay: 250,
          ease: 'Cubic.inOut',
          onComplete: () => {
            this.drawMeter(1)
            this.tweens.add({ targets: this.token, y: this.yMid, duration: 300, delay: 200 })
          },
        })
      },
    })
  }
}
