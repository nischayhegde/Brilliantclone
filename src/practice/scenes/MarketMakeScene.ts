import Phaser from 'phaser'
import { ModuleScene } from '../../engine/ModuleScene'
import { C } from '../../engine/palette'
import { fmtPrice } from '../../lessons/order-book/scenes/book'
import type { MarketMakingDecision } from '../types'

export interface MarketMakeParams {
  /** Real mid path (close prices), from bookStatsFromCandles. */
  mids: number[]
  /** Realized volatility (price units). */
  sigma: number
  /** First mid — the snapshot the live ladder is drawn around. */
  mid0: number
  constraints: { accountBalance: number; maxRiskPct: number }
}

/**
 * Practice Track B input scene. The learner posts a two-sided quote (bid/ask half-widths,
 * quote size, inventory cap) around a REAL mid (from OHLC closes). The ladder it draws is an
 * illustrative snapshot; the deterministic session runs in the resolver
 * (src/practice/resolve/marketMaking.ts) — this scene NEVER grades. On Submit it emits a
 * structured MarketMakingDecision; live nudges fire as the spread is tightened past the
 * name's volatility or the inventory cap dwarfs the account.
 */
export class MarketMakeScene extends ModuleScene {
  // Registry kind key (matches PRACTICE_SCENES + marketMakingEngine.sceneKind).
  static readonly KEY = 'market-make'

  private p!: MarketMakeParams
  private decision: MarketMakingDecision = { bidWidth: 0, askWidth: 0, quoteSize: 0, maxInventory: 0 }
  private ladderG!: Phaser.GameObjects.Graphics
  private ladderText: Phaser.GameObjects.Text[] = []
  private nudgeText?: Phaser.GameObjects.Text

  protected build(): void {
    this.p = this.params as unknown as MarketMakeParams
    // Seed sane defaults from realized vol so the learner starts in a reasonable place.
    const sig = Math.max(0.01, Math.round(this.p.sigma * 100) / 100)
    this.decision = { bidWidth: sig, askWidth: sig, quoteSize: 100, maxInventory: 500 }

    this.label(40, 20, 'Post a two-sided quote', { size: this.fs(16), col: C.ink, bold: true })
    this.label(40, 42, 'Mid path is real · order flow is an illustrative simulation (spread/inventory math exact).', {
      size: this.fs(11), col: C.muted,
    })

    this.ladderG = this.add.graphics()
    this.drawLadder()
    this.drawControls()
    this.setCanSubmit(true)
    this.emitReady()
  }

  /** Called by the controls; re-evaluates live nudges and re-renders the ladder. */
  private update_(patch: Partial<MarketMakingDecision>): void {
    this.decision = { ...this.decision, ...patch }
    this.fireNudges()
    this.drawLadder()
  }

  private fireNudges(): void {
    const avg = (this.decision.bidWidth + this.decision.askWidth) / 2
    if (avg < 0.25 * this.p.sigma) this.showNudge('spread-too-tight', 'Spread far below the name’s vol — adverse selection.')
    else if (this.decision.maxInventory * this.p.mid0 > this.p.constraints.accountBalance * 2)
      this.showNudge('inventory-runaway', 'Inventory cap dwarfs your account.')
    else this.nudgeText?.destroy()
  }

  private showNudge(id: string, copy: string): void {
    this.emitNudge(id)
    this.nudgeText?.destroy()
    this.nudgeText = this.label(40, 432, `⚠ ${copy}`, { size: this.fs(11), col: C.red, bold: true })
  }

  private drawLadder(): void {
    const g = this.ladderG
    g.clear()
    for (const t of this.ladderText) t.destroy()
    this.ladderText = []

    const x = 60
    const w = 300
    const mid = this.p.mid0
    const ask = mid + this.decision.askWidth
    const bid = mid - this.decision.bidWidth
    const rows: Array<{ y: number; label: string; price: number; col: number }> = [
      { y: 90, label: 'Ask (you sell)', price: ask, col: C.red },
      { y: 140, label: 'Mid', price: mid, col: C.ink },
      { y: 190, label: 'Bid (you buy)', price: bid, col: C.green },
    ]
    for (const r of rows) {
      g.fillStyle(r.col, r.label === 'Mid' ? 0.08 : 0.16)
      g.fillRoundedRect(x, r.y, w, 38, 8)
      this.ladderText.push(this.label(x + 12, r.y + 19, r.label, { size: this.fs(12), col: r.col, bold: true }))
      this.ladderText.push(this.label(x + w - 12, r.y + 19, fmtPrice(r.price), { size: this.fs(13), col: C.ink, bold: true, align: 'right' }))
    }
    this.ladderText.push(
      this.label(x, 244,
        `Quote ${this.decision.quoteSize} · cap ±${this.decision.maxInventory} · spread ${fmtPrice(this.decision.bidWidth + this.decision.askWidth)}`,
        { size: this.fs(11), col: C.inkSoft }),
    )
  }

  private drawControls(): void {
    const x = 430
    const maxW = Math.max(2, Math.round(this.p.sigma * 4 * 100) / 100)
    this.label(x, 82, 'Bid width', { size: this.fs(11), col: C.muted })
    this.slider(x, 102, 240, 0, maxW, this.decision.bidWidth, (v) => this.update_({ bidWidth: Math.round(v * 100) / 100 }), { step: 0.01 })
    this.label(x, 142, 'Ask width', { size: this.fs(11), col: C.muted })
    this.slider(x, 162, 240, 0, maxW, this.decision.askWidth, (v) => this.update_({ askWidth: Math.round(v * 100) / 100 }), { step: 0.01 })
    this.label(x, 202, 'Quote size', { size: this.fs(11), col: C.muted })
    this.slider(x, 222, 240, 10, 1000, this.decision.quoteSize, (v) => this.update_({ quoteSize: Math.round(v) }), { step: 10 })
    this.label(x, 262, 'Inventory cap', { size: this.fs(11), col: C.muted })
    this.slider(x, 282, 240, 50, 5000, this.decision.maxInventory, (v) => this.update_({ maxInventory: Math.round(v) }), { step: 50 })
  }

  protected onSubmit(): void {
    this.emitDecision(this.decision as unknown as Record<string, unknown>)
  }
}

export default MarketMakeScene
