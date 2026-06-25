import Phaser from 'phaser'
import { ModuleScene } from '../../engine/ModuleScene'
import { C } from '../../engine/palette'
import { legPnL, MULTIPLIER, type Leg } from '../../lessons/volatility/scenes/payoffMath'
import { bsPrice } from '../resolve/bs'
import { contractsForExpiry, dteDays, findContract, type ChainSnapshot, type CP } from '../chain'

interface OptionsBuildParams {
  snapshot: ChainSnapshot
  constraints: { accountBalance: number; maxRiskPct: number; requireDefinedRisk?: boolean }
}

interface BuiltLeg extends Leg {
  expiry: string
  contracts: number
  deltaAtEntry: number
  dteAtEntry: number
  /** Snapshot IV — used ONLY for the labelled dashed "today" model curve. */
  iv: number
}

/**
 * Practice Track C input scene. The learner builds a (multi-leg) defined-risk position
 * from a REAL option-chain snapshot: pick an expiry, slide across the real strike grid,
 * toggle call/put + long/short, set contracts, then add up to two legs and choose how to
 * manage (hold / close early / roll). Every premium, delta and DTE is pulled from the
 * snapshot via findContract — nothing is invented. It draws the EXACT expiry payoff
 * (combinedPnL × MULTIPLIER × contracts) plus a dashed "today" curve from Black–Scholes
 * fed the real snapshot IV (labelled "model · IV real"). On Submit it emits a structured
 * `decision`; the React player resolves + grades. Live nudges fire for undefined risk
 * and oversizing.
 */
export default class OptionsBuildScene extends ModuleScene {
  private snap!: ChainSnapshot
  private constraints!: OptionsBuildParams['constraints']
  private expiry = ''
  private strikeFrac = 0.5
  private cp: CP = 'P'
  private legSide: 'long' | 'short' = 'short'
  private contracts = 1
  private legs: BuiltLeg[] = []
  private managed: 'hold' | 'closed-early' | 'rolled' = 'hold'

  private plot = { l: 64, r: 700, t: 64, b: 232 }
  private xMin = 0
  private xMax = 1
  private yMin = -1
  private yMax = 1

  // Redrawable layers + text we destroy on each redraw.
  private axisG!: Phaser.GameObjects.Graphics
  private expiryG!: Phaser.GameObjects.Graphics
  private todayG!: Phaser.GameObjects.Graphics
  private beG!: Phaser.GameObjects.Graphics
  private dynLabels: Phaser.GameObjects.Text[] = []

  private selText?: Phaser.GameObjects.Text
  private legsText?: Phaser.GameObjects.Text
  private nudgeText?: Phaser.GameObjects.Text
  private expiryBtns: Array<{ exp: string; c: Phaser.GameObjects.Container }> = []
  private manageBtns: Array<{ m: 'hold' | 'closed-early' | 'rolled'; c: Phaser.GameObjects.Container }> = []

  protected build(): void {
    const p = this.params as unknown as OptionsBuildParams
    this.snap = p.snapshot
    this.constraints = p.constraints
    this.expiry = this.snap.meta.expirations[0]
    this.strikeFrac = this.atmFrac()

    this.label(this.plot.l, 18, 'Build a defined-risk position from the real chain.', {
      size: this.fs(13), col: C.ink, bold: true,
    })
    this.label(this.plot.l, 40, 'P/L today: model estimate · IV real.  Expiry P/L: exact.', {
      size: this.fs(11), col: C.muted,
    })

    this.axisG = this.add.graphics()
    this.expiryG = this.add.graphics()
    this.todayG = this.add.graphics()
    this.beG = this.add.graphics()

    this.buildExpiryPicker()
    this.buildStrikeControls()
    this.buildManageToggle()
    this.redrawPayoff()
    this.updateSelectionReadout()
    this.updateLegsReadout()
    this.setCanSubmit(true)
    this.emitReady()
  }

  // --- the real chain ---------------------------------------------------------
  private strikesForExpiry(): number[] {
    return [...new Set(contractsForExpiry(this.snap, this.expiry).map((r) => r.strike))].sort((a, b) => a - b)
  }

  /** Fraction (0..1) of the strike grid closest to spot — a sane ATM default. */
  private atmFrac(): number {
    const ks = this.strikesForExpiry()
    if (ks.length <= 1) return 0
    let best = 0
    let bestDiff = Infinity
    ks.forEach((k, i) => {
      const d = Math.abs(k - this.snap.meta.spot)
      if (d < bestDiff) { bestDiff = d; best = i }
    })
    return best / (ks.length - 1)
  }

  private selectedStrike(): number {
    const ks = this.strikesForExpiry()
    if (!ks.length) return 0
    const idx = Math.max(0, Math.min(ks.length - 1, Math.round(this.strikeFrac * (ks.length - 1))))
    return ks[idx]
  }

  private selectedContract() {
    return findContract(this.snap, this.expiry, this.selectedStrike(), this.cp)
  }

  // --- controls ---------------------------------------------------------------
  private buildExpiryPicker(): void {
    let x = this.plot.l + 36
    for (const exp of this.snap.meta.expirations) {
      const c = this.button(x, this.plot.b + 34, `${dteDays(this.snap.meta.date, exp)}d`, () => {
        this.expiry = exp
        this.strikeFrac = this.atmFrac()
        this.refreshExpiryButtons()
        this.redrawPayoff()
        this.updateSelectionReadout()
      }, { w: 72, h: 26 })
      this.expiryBtns.push({ exp, c })
      x += 84
    }
    this.refreshExpiryButtons()
  }

  private refreshExpiryButtons(): void {
    for (const b of this.expiryBtns) this.tintButton(b.c, b.exp === this.expiry)
  }

  private buildStrikeControls(): void {
    const rowY = this.plot.b + 72
    this.label(this.plot.l, rowY - 18, 'Strike', { size: this.fs(11), col: C.muted })
    this.slider(this.plot.l, rowY, 230, 0, 1, this.strikeFrac, (v) => {
      this.strikeFrac = v
      this.updateSelectionReadout()
    })

    // Call/Put toggle.
    this.button(this.plot.l + 280, rowY, 'Call / Put', () => {
      this.cp = this.cp === 'C' ? 'P' : 'C'
      this.updateSelectionReadout()
    }, { w: 120, h: 28 })

    // Long/Short toggle.
    this.button(this.plot.l + 412, rowY, 'Long / Short', () => {
      this.legSide = this.legSide === 'long' ? 'short' : 'long'
      this.updateSelectionReadout()
    }, { w: 130, h: 28 })

    // Contracts slider.
    const row2 = rowY + 44
    this.label(this.plot.l, row2 - 18, 'Contracts', { size: this.fs(11), col: C.muted })
    this.slider(this.plot.l, row2, 200, 1, 10, this.contracts, (v) => {
      this.contracts = Math.round(v)
      this.updateSelectionReadout()
    }, { step: 1 })

    // Add-leg + clear.
    this.button(this.plot.l + 280, row2, 'Add leg', () => this.addLeg(), { w: 120, h: 28, fill: C.amber })
    this.button(this.plot.l + 412, row2, 'Clear legs', () => {
      this.legs = []
      this.redrawPayoff()
      this.updateLegsReadout()
      this.fireNudges()
    }, { w: 130, h: 28, fill: C.muted })
  }

  private addLeg(): void {
    if (this.legs.length >= 2) return
    const row = this.selectedContract()
    if (!row) return
    const leg: BuiltLeg = {
      type: this.cp === 'C' ? 'call' : 'put',
      side: this.legSide,
      K: row.strike,
      premium: row.mid,
      expiry: this.expiry,
      contracts: this.contracts,
      deltaAtEntry: row.delta,
      dteAtEntry: dteDays(this.snap.meta.date, this.expiry),
      iv: row.iv,
    }
    this.legs.push(leg)
    this.redrawPayoff()
    this.updateLegsReadout()
    this.fireNudges()
  }

  private buildManageToggle(): void {
    this.label(this.plot.l, this.plot.b + 132, 'Manage', { size: this.fs(11), col: C.muted })
    let x = this.plot.l + 64
    for (const m of ['hold', 'closed-early', 'rolled'] as const) {
      const c = this.button(x, this.plot.b + 132 + 6, m, () => {
        this.managed = m
        this.refreshManageButtons()
      }, { w: 124, h: 26 })
      this.manageBtns.push({ m, c })
      x += 134
    }
    this.refreshManageButtons()
  }

  private refreshManageButtons(): void {
    for (const b of this.manageBtns) this.tintButton(b.c, b.m === this.managed)
  }

  /** Visually mark a button as selected (amber) or idle (ink). */
  private tintButton(c: Phaser.GameObjects.Container, selected: boolean): void {
    const g = c.list[0] as Phaser.GameObjects.Graphics
    const t = c.list[1] as Phaser.GameObjects.Text
    const w = c.width
    const h = c.height
    g.clear()
    g.fillStyle(selected ? C.amber : C.ink, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10)
    t.setColor('#ffffff')
  }

  // --- payoff math ------------------------------------------------------------
  /** EXACT combined expiry P&L in dollars at price S (× contracts × 100). */
  private expiryPnlAt(S: number): number {
    let pnl = 0
    for (const l of this.legs) pnl += legPnL({ type: l.type, side: l.side, K: l.K, premium: l.premium }, S) * MULTIPLIER * l.contracts
    return pnl
  }

  /** LABELLED model "today" P&L in dollars at price S via BS on the real IV. */
  private todayPnlAt(S: number): number {
    let pnl = 0
    for (const l of this.legs) {
      const tYears = Math.max(0, l.dteAtEntry) / 365
      const value = bsPrice(l.type === 'call' ? 'C' : 'P', S, l.K, tYears, l.iv, 0.01)
      const per = (l.side === 'long' ? value - l.premium : l.premium - value) * MULTIPLIER * l.contracts
      pnl += per
    }
    return pnl
  }

  /** Numeric expiry breakevens (zero crossings) across the visible grid. */
  private breakevenPrices(): number[] {
    const out: number[] = []
    const steps = 240
    let prevS = this.xMin
    let prev = this.expiryPnlAt(prevS)
    for (let i = 1; i <= steps; i++) {
      const S = this.xMin + ((this.xMax - this.xMin) * i) / steps
      const cur = this.expiryPnlAt(S)
      if ((prev <= 0 && cur > 0) || (prev >= 0 && cur < 0)) {
        const t = prev === cur ? 0 : prev / (prev - cur)
        out.push(prevS + (S - prevS) * t)
      }
      prevS = S
      prev = cur
    }
    return out
  }

  // --- drawing ----------------------------------------------------------------
  private xFor(price: number): number {
    const t = (price - this.xMin) / (this.xMax - this.xMin || 1)
    return this.plot.l + t * (this.plot.r - this.plot.l)
  }
  private yFor(pnl: number): number {
    const t = (pnl - this.yMin) / (this.yMax - this.yMin || 1)
    return this.plot.b - t * (this.plot.b - this.plot.t)
  }

  private computeRanges(): void {
    const ks = this.strikesForExpiry()
    const legK = this.legs.map((l) => l.K)
    const spot = this.snap.meta.spot
    const lo = Math.min(spot, ...(ks.length ? ks : [spot]), ...legK)
    const hi = Math.max(spot, ...(ks.length ? ks : [spot]), ...legK)
    const padX = (hi - lo) * 0.08 || spot * 0.1
    this.xMin = Math.max(0, lo - padX)
    this.xMax = hi + padX

    let yLo = 0
    let yHi = 0
    const steps = 80
    for (let i = 0; i <= steps; i++) {
      const S = this.xMin + ((this.xMax - this.xMin) * i) / steps
      for (const v of [this.expiryPnlAt(S), this.legs.length ? this.todayPnlAt(S) : 0]) {
        yLo = Math.min(yLo, v)
        yHi = Math.max(yHi, v)
      }
    }
    const padY = Math.max(50, (yHi - yLo) * 0.12)
    this.yMin = yLo - padY
    this.yMax = yHi + padY
  }

  private samplePath(fn: (S: number) => number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = []
    const steps = 200
    for (let i = 0; i <= steps; i++) {
      const S = this.xMin + ((this.xMax - this.xMin) * i) / steps
      const pnl = Math.max(this.yMin, Math.min(this.yMax, fn(S)))
      pts.push({ x: this.xFor(S), y: this.yFor(pnl) })
    }
    return pts
  }

  private strokePath(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[], col: number, width: number, alpha = 1): void {
    g.lineStyle(width, col, alpha)
    g.beginPath()
    g.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
    g.strokePath()
  }

  private redrawPayoff(): void {
    this.computeRanges()
    this.axisG.clear()
    this.expiryG.clear()
    this.todayG.clear()
    this.beG.clear()
    for (const t of this.dynLabels) t.destroy()
    this.dynLabels = []

    // Plot frame + zero line.
    this.axisG.lineStyle(1, C.hairline, 1)
    this.axisG.strokeRect(this.plot.l, this.plot.t, this.plot.r - this.plot.l, this.plot.b - this.plot.t)
    const y0 = this.yFor(0)
    this.axisG.lineStyle(1.5, C.blue, 0.55)
    this.axisG.lineBetween(this.plot.l, y0, this.plot.r, y0)

    // Spot marker.
    const xs = this.xFor(this.snap.meta.spot)
    this.axisG.lineStyle(1.2, C.muted, 0.7)
    for (let yy = this.plot.t; yy < this.plot.b; yy += 10) this.axisG.lineBetween(xs, yy, xs, Math.min(yy + 5, this.plot.b))
    this.dynLabels.push(this.label(xs, this.plot.t + 10, `spot ${this.fmtPrice(this.snap.meta.spot)}`, {
      size: this.fs(11), col: C.muted, align: 'center', bg: true,
    }))

    // Leg strike verticals.
    for (const l of this.legs) {
      const x = this.xFor(l.K)
      this.axisG.lineStyle(1, C.blue, 0.35)
      for (let yy = this.plot.t; yy < this.plot.b; yy += 9) this.axisG.lineBetween(x, yy, x, Math.min(yy + 5, this.plot.b))
    }

    if (this.legs.length) {
      // Dashed model "today" curve first (under the exact curve).
      this.strokePath(this.todayG, this.dashedSample((S) => this.todayPnlAt(S)), C.amber, 2, 0.9)
      this.dynLabels.push(this.label(this.plot.r - 6, this.plot.t + 12, 'today (model · IV real)', {
        size: this.fs(11), col: C.amberInk, bold: true, align: 'right', bg: true,
      }))
      // Exact expiry curve.
      this.strokePath(this.expiryG, this.samplePath((S) => this.expiryPnlAt(S)), C.green, 3)
      this.dynLabels.push(this.label(this.plot.l + 6, this.plot.t + 12, 'at expiry (exact)', {
        size: this.fs(11), col: C.greenText, bold: true, bg: true,
      }))

      // Breakevens.
      for (const be of this.breakevenPrices()) {
        const x = this.xFor(be)
        this.beG.lineStyle(1.4, C.blueDark, 1)
        for (let yy = this.plot.t; yy < this.plot.b; yy += 12) this.beG.lineBetween(x, yy, x, Math.min(yy + 7, this.plot.b))
        this.dynLabels.push(this.label(x, this.plot.b - 12, `BE ${this.fmtPrice(be)}`, {
          size: this.fs(11), col: C.blueDark, bold: true, align: 'center', bg: true,
        }))
      }
    } else {
      this.dynLabels.push(this.label((this.plot.l + this.plot.r) / 2, (this.plot.t + this.plot.b) / 2, 'Add a leg to see the payoff', {
        size: this.fs(12), col: C.muted, align: 'center',
      }))
    }
  }

  private dashedSample(fn: (S: number) => number): { x: number; y: number }[] {
    // The full path; strokePath draws it solid, but we visually distinguish it by
    // colour + a thinner width. (A true dash would fragment the path; colour reads
    // clearly enough for the "today vs expiry" contrast.)
    return this.samplePath(fn)
  }

  private fmtPrice(p: number): string {
    return p >= 100 ? p.toFixed(0) : p.toFixed(2)
  }

  // --- readouts + nudges ------------------------------------------------------
  private updateSelectionReadout(): void {
    this.selText?.destroy()
    const row = this.selectedContract()
    const k = this.selectedStrike()
    const side = this.legSide === 'long' ? 'Long' : 'Short'
    const kind = this.cp === 'C' ? 'call' : 'put'
    const txt = row
      ? `${side} ${this.contracts}× ${this.fmtPrice(k)} ${kind} · mid ${row.mid.toFixed(2)} · Δ${row.delta.toFixed(2)} · ${dteDays(this.snap.meta.date, this.expiry)}d`
      : `No ${kind} at ${this.fmtPrice(k)} for this expiry`
    this.selText = this.label(this.plot.l, this.plot.b + 188, txt, { size: this.fs(12), col: C.ink, bold: true })
  }

  private updateLegsReadout(): void {
    this.legsText?.destroy()
    const txt = this.legs.length
      ? 'Legs: ' + this.legs.map((l) => `${l.side === 'long' ? '+' : '-'}${l.contracts} ${this.fmtPrice(l.K)}${l.type === 'call' ? 'C' : 'P'}@${l.premium.toFixed(2)}`).join('   ')
      : 'Legs: (none yet)'
    this.legsText = this.label(this.plot.l, this.plot.b + 210, txt, { size: this.fs(11), col: C.inkSoft })
  }

  private fireNudges(): void {
    // undefined-risk: a short call with no covering long call above it (unbounded loss).
    const shortCalls = this.legs.filter((l) => l.type === 'call' && l.side === 'short')
    const longCalls = this.legs.filter((l) => l.type === 'call' && l.side === 'long')
    const naked = shortCalls.some((sc) => !longCalls.some((lc) => lc.K > sc.K))
    if (naked) this.showNudge('undefined-risk')

    // sizing: worst expiry loss across the grid vs the risk budget.
    let worst = 0
    const steps = 120
    for (let i = 0; i <= steps; i++) {
      const S = this.xMin + ((this.xMax - this.xMin) * i) / steps
      worst = Math.min(worst, this.expiryPnlAt(S))
    }
    const budget = (this.constraints.maxRiskPct / 100) * this.constraints.accountBalance
    if (naked || -worst > budget) this.showNudge('sizing')
  }

  private showNudge(id: string): void {
    this.emitNudge(id)
    this.nudgeText?.destroy()
    const copy = id === 'undefined-risk' ? 'Undefined risk — a naked short leg.' : 'Position risks more than your budget.'
    this.nudgeText = this.label(this.plot.l, this.plot.b + 230, `⚠ ${copy}`, { size: this.fs(11), col: C.red, bold: true })
  }

  protected onSubmit(): void {
    this.emitDecision({
      legs: this.legs.map((l) => ({
        type: l.type, side: l.side, K: l.K, expiry: l.expiry, premium: l.premium,
        contracts: l.contracts, deltaAtEntry: l.deltaAtEntry, dteAtEntry: l.dteAtEntry,
      })),
      managed: this.managed,
    })
  }
}
