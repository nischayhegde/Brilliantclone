import Phaser from 'phaser'
import { ModuleScene } from '../../engine/ModuleScene'
import { C } from '../../engine/palette'
import type { Candle } from '../../data/candles'

interface ChartTradeParams {
  candles: Candle[]
  splitIndex: number
  entry: number
  constraints: { accountBalance: number; maxRiskPct: number }
}

/**
 * Practice Track A input scene. Draws real candles up to the split, lets the learner
 * choose take/skip, drag a stop + target, and set a position size. It NEVER grades —
 * on Submit it emits a structured `decision` for the React player to resolve + grade.
 * Live `nudge` events fire as risky inputs are set (sizing, no-stop).
 */
export default class ChartTradeScene extends ModuleScene {
  private p!: ChartTradeParams
  private took = true
  private shares = 100
  private stop = 0
  private target = 0
  private direction: 'long' | 'short' = 'long'
  private plot = { l: 12, r: 682, t: 22, b: 430, w: 670, h: 408 }
  private pmin = 0
  private pmax = 1

  protected build(): void {
    this.p = this.params as unknown as ChartTradeParams
    const c = this.p.candles
    let lo = Infinity, hi = -Infinity
    for (const k of c) { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h) }
    const pad = (hi - lo) * 0.08
    this.pmin = lo - pad; this.pmax = hi + pad

    this.drawCandlesToSplit()
    this.stop = this.direction === 'long' ? this.p.entry * 0.98 : this.p.entry * 1.02
    this.target = this.direction === 'long' ? this.p.entry * 1.04 : this.p.entry * 0.96

    this.drawEntryLine()
    this.buildControls()
    this.setCanSubmit(true)
    this.emitReady()
  }

  private yFor(price: number): number {
    const t = (price - this.pmin) / (this.pmax - this.pmin)
    return this.plot.b - t * this.plot.h
  }

  private yToPrice(y: number): number {
    const cy = Math.max(this.plot.t, Math.min(this.plot.b, y))
    const t = (this.plot.b - cy) / this.plot.h
    return this.pmin + t * (this.pmax - this.pmin)
  }

  private drawCandlesToSplit(): void {
    const c = this.p.candles
    const step = this.plot.w / c.length
    const bodyW = Math.max(1.5, Math.min(10, step * 0.62))
    for (let i = 0; i <= this.p.splitIndex; i++) {
      const k = c[i]
      const up = k.c >= k.o
      const col = up ? C.green : C.red
      const x = this.plot.l + i * step + step / 2
      const g = this.add.graphics()
      g.lineStyle(1.2, col, 1)
      g.lineBetween(x, this.yFor(k.h), x, this.yFor(k.l))
      const yo = this.yFor(k.o), yc = this.yFor(k.c)
      g.fillStyle(col, 1)
      g.fillRect(x - bodyW / 2, Math.min(yo, yc), bodyW, Math.max(1.5, Math.abs(yc - yo)))
    }
    // Mask the hidden region (mirrors CandleChartScene quiz mask).
    const sx = this.plot.l + (this.p.splitIndex + 1) * step
    const mg = this.add.graphics()
    mg.fillStyle(C.amberSoft, 0.96)
    mg.fillRect(sx, this.plot.t, this.plot.r - sx, this.plot.h)
  }

  private drawEntryLine(): void {
    const y = this.yFor(this.p.entry)
    const g = this.add.graphics()
    g.lineStyle(1.5, C.ink, 0.85)
    g.lineBetween(this.plot.l, y, this.plot.r, y)
    this.label(this.plot.l + 6, y - 12, `Entry ${this.fmt(this.p.entry)}`, { col: C.ink, bold: true, size: this.fs(13) })
  }

  private fmt(p: number): string {
    return p >= 100 ? p.toFixed(0) : p.toFixed(2)
  }

  private riskDollars(): number {
    return Math.abs(this.p.entry - this.stop) * this.shares
  }

  private buildControls(): void {
    // Take/Skip toggle.
    this.button(this.plot.l + 60, this.plot.t + 16, 'Take / Skip', () => {
      this.took = !this.took
      this.fireNudges()
    }, { w: 130, h: 30 })

    // Size slider 0..5000 shares.
    this.slider(this.plot.l + 6, this.plot.b + 8, 200, 0, 5000, this.shares, (v) => {
      this.shares = Math.round(v)
      this.fireNudges()
    }, { step: 50 })

    // Stop + target draggable lines using the CandleChartScene.addPriceLine constrain
    // pattern: the target is held on the profit side of entry; the stop is free to range
    // so a wrong-side (undefined-risk) drag can surface the live `no-stop` nudge.
    this.drawAdjustableLine('stop', C.red)
    this.drawAdjustableLine('target', C.green)
  }

  private drawAdjustableLine(which: 'stop' | 'target', col: number): void {
    const long = this.direction === 'long'
    const tick = (this.pmax - this.pmin) * 0.012
    const clampRange = (p: number) => Math.max(this.pmin, Math.min(this.pmax, p))
    const constrain = (p: number): number => {
      if (which === 'target') {
        // Target must sit on the profit side of entry.
        return long ? Math.max(this.p.entry + tick, clampRange(p)) : Math.min(this.p.entry - tick, clampRange(p))
      }
      // Stop: only kept on the chart so it can be (mis)placed either side of entry.
      return clampRange(p)
    }
    const get = () => (which === 'stop' ? this.stop : this.target)
    const set = (v: number) => { if (which === 'stop') this.stop = v; else this.target = v }
    set(constrain(get()))

    const lineG = this.add.graphics()
    const draw = () => {
      const y = this.yFor(get())
      lineG.clear()
      lineG.lineStyle(1.8, col, 1)
      for (let x = this.plot.l; x < this.plot.r - 14; x += 14) {
        lineG.lineBetween(x, y, Math.min(x + 8, this.plot.r - 14), y)
      }
      knob.y = y
    }

    const knob = this.add
      .circle(this.plot.r - 10, this.yFor(get()), this.compact ? 10 : 8, col)
      .setStrokeStyle(2.5, C.white)
      .setInteractive({ useHandCursor: true })
    draw()
    this.input.setDraggable(knob)
    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, _x: number, dy: number) => {
      if (obj !== knob) return
      const price = constrain(this.yToPrice(dy))
      set(price)
      knob.y = this.yFor(price)
      draw()
      this.fireNudges()
    })
  }

  private fireNudges(): void {
    if (!this.took) return
    const budget = (this.p.constraints.maxRiskPct / 100) * this.p.constraints.accountBalance
    if (this.riskDollars() > budget) this.emitNudge('sizing')
    // A stop on the wrong side of entry leaves the loss undefined.
    const wrongSide = this.direction === 'long' ? this.stop >= this.p.entry : this.stop <= this.p.entry
    if (wrongSide) this.emitNudge('no-stop')
  }

  protected onSubmit(): void {
    this.emitDecision(
      this.took
        ? { took: true, direction: this.direction, shares: this.shares, entry: this.p.entry, stop: this.stop, target: this.target }
        : { took: false },
    )
  }
}
