import Phaser from 'phaser'
import { ModuleScene } from '../../../engine/ModuleScene'
import { C, hex } from '../../../engine/palette'
import { fmtMoney, fmtPrice, fmtShares, walkBuy, type Level } from './book'

interface TwoBooksParams {
  deep?: Level[]
  thin?: Level[]
  startSize?: number
  maxSize?: number
}

const DEFAULT_DEEP: Level[] = [
  { price: 400.0, size: 20000 },
  { price: 400.01, size: 25000 },
  { price: 400.02, size: 30000 },
]
const DEFAULT_THIN: Level[] = [
  { price: 5.0, size: 100 },
  { price: 5.4, size: 100 },
  { price: 6.0, size: 300 },
  { price: 6.5, size: 500 },
]

interface BookPane {
  title: string
  asks: Level[]
  cx: number
  bars: Array<{ lvl: Level; baseY: number; fillG: Phaser.GameObjects.Graphics; sizeT: Phaser.GameObjects.Text }>
  maxSize: number
  avgText: Phaser.GameObjects.Text
  slipText: Phaser.GameObjects.Text
}

/**
 * MODULE 12 — INTERACTIVE "Deep vs Thin: Two Books". One shared size slider drives a
 * MARKET BUY into BOTH books at once. The deep (AAPL-like, ~$400) book swallows 1,000
 * shares at the touch (0% slippage); the thin (~$5 micro-cap) book gets walked across
 * several rungs to a blended ~6.09 (+21.8%). A comparison panel shows avg fill,
 * slippage ($ and %), and price impact live for each. Math exact.
 */
export default class TwoBooksScene extends ModuleScene {
  private size = 1000
  private maxOrder = 2000
  private panes: BookPane[] = []
  private cmp: Record<string, Phaser.GameObjects.Text> = {}

  protected build(): void {
    const p = this.params as TwoBooksParams
    const deep = (p.deep ?? DEFAULT_DEEP).slice().sort((a, b) => a.price - b.price)
    const thin = (p.thin ?? DEFAULT_THIN).slice().sort((a, b) => a.price - b.price)
    this.size = p.startSize ?? 1000
    this.maxOrder = p.maxSize ?? 2000

    this.label(this.W / 2, 26, 'Same order, two books. One shared slider fires both. Depth absorbs size.', {
      size: 13,
      col: C.muted,
      align: 'center',
    })
    this.label(12, this.H - 14, 'Simulated depth — math exact', { size: 11, col: C.blue }).setAlpha(0.8)

    this.panes.push(this.buildPane('DEEP book — lots of shares', deep, 175, C.green))
    this.panes.push(this.buildPane('THIN book — few shares', thin, 430, C.red))

    this.buildComparison()
    this.buildSlider()

    this.recompute()
    this.time.delayedCall(600, () => this.emitReady())
  }

  private buildPane(title: string, asks: Level[], cx: number, accent: number): BookPane {
    this.label(cx, 52, title, { size: 12, col: accent, align: 'center', bold: true })
    const maxSize = Math.max(...asks.map((l) => l.size))
    const rowH = 30
    const top = 80
    const maxBarW = 200
    const left = cx - maxBarW / 2

    const bars: BookPane['bars'] = []
    // draw worst ask at top, best ask at bottom
    const ordered = asks.slice().sort((a, b) => b.price - a.price)
    ordered.forEach((lvl, i) => {
      const y = top + i * rowH + rowH / 2
      const w = 30 + (lvl.size / maxSize) * (maxBarW - 30)
      const bg = this.add.graphics()
      bg.fillStyle(C.redSoft, 1)
      bg.fillRoundedRect(left, y - rowH / 2 + 3, w, rowH - 6, 4)
      bg.lineStyle(1.5, C.red, 1)
      bg.strokeRoundedRect(left, y - rowH / 2 + 3, w, rowH - 6, 4)
      const fillG = this.add.graphics()
      this.label(left + 6, y, fmtPrice(lvl.price), { size: 12, col: C.red, bold: true })
      const sizeT = this.label(left + maxBarW + 8, y, fmtShares(lvl.size), { size: 12, col: C.ink })
      bars.push({ lvl, baseY: y, fillG, sizeT })
    })

    const avgText = this.label(cx, top + ordered.length * rowH + 16, '', { size: 13, col: C.blue, align: 'center', bold: true })
    const slipText = this.label(cx, top + ordered.length * rowH + 38, '', { size: 12, col: C.muted, align: 'center' })

    // stash geometry for fill drawing
    return { title, asks, cx, bars, maxSize, avgText, slipText }
  }

  private recompute(): void {
    for (const pane of this.panes) {
      const r = walkBuy(pane.asks, this.size)
      const left = pane.cx - 100
      const maxBarW = 200
      const rowH = 30
      // consumed shares per price
      const consumed = new Map<number, number>()
      for (const f of r.fills) consumed.set(f.price, f.shares)

      for (const b of pane.bars) {
        b.fillG.clear()
        const taken = consumed.get(b.lvl.price) ?? 0
        if (taken > 0) {
          const w = 30 + (taken / pane.maxSize) * (maxBarW - 30)
          b.fillG.fillStyle(C.red, 0.55)
          b.fillG.fillRoundedRect(left, b.baseY - rowH / 2 + 3, w, rowH - 6, 4)
        }
        const fullyTaken = taken >= b.lvl.size
        b.sizeT.setColor(hex(fullyTaken ? C.red : C.ink))
      }

      pane.avgText.setText(isFinite(r.avgFill) ? `avg fill ${fmtPrice(r.avgFill)}` : 'unfilled')
      const pct = isFinite(r.avgFill) && r.touch > 0 ? (r.slippagePerShare / r.touch) * 100 : 0
      pane.slipText.setText(
        r.slippageTotal > 0
          ? `slippage ${fmtMoney(r.slippageTotal)} (+${pct.toFixed(1)}%)`
          : 'slippage $0 (0%)',
      )
      pane.slipText.setColor(hex(r.slippageTotal > 0 ? C.red : C.green))
    }
    this.updateComparison()
  }

  private buildComparison(): void {
    const px = 600
    const py = 80
    this.panel(px, py, 152, 240, { fill: C.white, stroke: C.hairline, radius: 10 })
    this.label(px + 12, py + 18, 'Compare', { size: 13, col: C.ink, bold: true })
    const mk = (key: string, y: number, lbl: string, col = C.ink) => {
      this.label(px + 12, py + y, lbl, { size: 12, col: C.muted })
      this.cmp[key] = this.label(px + 12, py + y + 17, '—', { size: 13, col, bold: true })
    }
    mk('order', 40, 'Order')
    mk('deepAvg', 78, 'Deep: avg / cost')
    mk('thinAvg', 134, 'Thin: avg / cost')
  }

  private updateComparison(): void {
    const rDeep = walkBuy(this.panes[0].asks, this.size)
    const rThin = walkBuy(this.panes[1].asks, this.size)
    this.cmp.order.setText(`${fmtShares(this.size)} sh`)
    const pctD = rDeep.touch > 0 ? (rDeep.slippagePerShare / rDeep.touch) * 100 : 0
    const pctT = rThin.touch > 0 ? (rThin.slippagePerShare / rThin.touch) * 100 : 0
    this.cmp.deepAvg.setText(`${fmtPrice(rDeep.avgFill)}\n${fmtMoney(rDeep.slippageTotal)} (+${pctD.toFixed(1)}%)`)
    this.cmp.deepAvg.setColor(hex(rDeep.slippageTotal > 0 ? C.red : C.green))
    this.cmp.thinAvg.setText(`${fmtPrice(rThin.avgFill)}\n${fmtMoney(rThin.slippageTotal)} (+${pctT.toFixed(1)}%)`)
    this.cmp.thinAvg.setColor(hex(rThin.slippageTotal > 0 ? C.red : C.green))
  }

  private buildSlider(): void {
    this.label(this.W / 2, 362, `Order size: shared across both books`, { size: 12, col: C.muted, align: 'center' })
    this.slider(this.W / 2 - 180, 392, 360, 100, this.maxOrder, this.size, (v) => {
      this.size = Math.round(v / 100) * 100
      this.recompute()
      this.emitReady()
    }, { step: 100, col: C.blue })
  }
}
