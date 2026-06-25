import Phaser from 'phaser'
import { SceneBus, type SceneEvent } from './bus'
import { C, FONT, hex, color, type ColorName } from './palette'

/**
 * Fixed logical canvas. Every scene lays out in this coordinate space; PhaserCanvas
 * uses Scale.FIT to letterbox-scale it to the container, so scenes NEVER do resize
 * math. Design for 760x460 and it looks right on phone and desktop.
 */
export const DESIGN = { width: 760, height: 460 } as const

export interface SceneInit {
  params: Record<string, unknown>
  bus: SceneBus
}

/**
 * Base class for all module scenes. Subclasses implement `build()` (called once on
 * create) and optionally `onReveal()` / `onReset()` / `onSet()`. Helpers cover the
 * 90% needs: text, panels, buttons, sliders, draggable markers, tween-in.
 */
export abstract class ModuleScene extends Phaser.Scene {
  bus!: SceneBus
  params: Record<string, unknown> = {}
  private offBus?: () => void

  init(data: SceneInit): void {
    this.bus = data.bus
    this.params = data.params ?? {}
  }

  create(): void {
    // The game boots at DESIGN×RES (see PhaserCanvas) for a crisp, supersampled drawing
    // buffer on hi-DPI screens. Zoom the camera by that same factor and re-centre on the
    // design midpoint so the visible world is exactly [0,DESIGN.width]×[0,DESIGN.height] —
    // every scene keeps authoring in DESIGN space and never sees the larger buffer.
    // (Input hit-testing and drag deltas are camera-aware; manual pointer reads use
    // `pointer.worldX/worldY`, which this zoom maps back into design space.)
    const res = this.scale.gameSize.width / DESIGN.width
    if (res !== 1) {
      this.cameras.main.setZoom(res)
      this.cameras.main.centerOn(DESIGN.width / 2, DESIGN.height / 2)
    }
    this.offBus = this.bus.on((e) => this.handleBus(e))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offBus?.())
    this.build()
  }

  /** Build the whole scene at DESIGN size. Required. */
  protected abstract build(): void

  private handleBus(e: SceneEvent): void {
    // Guard against a torn-down scene that is still subscribed. Under React StrictMode
    // (and any race where game.destroy()'s deferred SHUTDOWN hasn't fired yet) a discarded
    // scene instance can still receive a bus event and would then operate on destroyed
    // game objects — throwing and stranding the learner, or grading invisibly off-screen.
    // Only the live, active scene whose game is still running may grade. (game.destroy()
    // is deferred to the next step, so isActive() alone can still be true for the discard;
    // pendingDestroy/isRunning close that window.)
    const game = this.sys?.game
    // `pendingDestroy` is a real runtime flag on Phaser.Game but is missing from its
    // type defs, so read it through a narrow cast rather than dropping the guard.
    const pendingDestroy = (game as unknown as { pendingDestroy?: boolean })?.pendingDestroy
    if (!this.sys || !game || pendingDestroy || !game.isRunning || !this.sys.isActive()) return
    if (e.type === 'reveal') this.onReveal()
    else if (e.type === 'reset') this.onReset()
    else if (e.type === 'set') this.onSet(e.key, e.value)
    else if (e.type === 'submit') this.onSubmit()
  }

  // Optional override points -------------------------------------------------
  protected onReveal(): void {}
  protected onReset(): void {}
  protected onSet(_key: string, _value: number | string | boolean): void {}
  /** Challenge modules: run the simulation/reveal, then call this.report(...). */
  protected onSubmit(): void {}

  /** Challenge: enable/disable the renderer's Submit button. */
  protected setCanSubmit(value: boolean): void {
    this.bus.emit({ type: 'canSubmit', value })
  }
  /** Challenge: report the graded outcome (renderer shows banner + detail). */
  protected report(correct: boolean, title: string, detail: string): void {
    this.bus.emit({ type: 'result', correct, title, detail })
  }

  /** Tell the renderer the intro animation finished (optional gating). */
  protected emitReady(): void {
    this.bus.emit({ type: 'ready' })
  }
  /** Push a live value to the renderer (optional; most scenes self-render readouts). */
  protected readout(key: string, value: number | string | boolean): void {
    this.bus.emit({ type: 'readout', key, value })
  }

  /** Practice: emit the learner's structured decision (payload is cast by the player). */
  protected emitDecision(payload: Record<string, unknown>): void {
    this.bus.emit({ type: 'decision', payload })
  }
  /** Practice: fire a decision-point nudge by id. */
  protected emitNudge(id: string): void {
    this.bus.emit({ type: 'nudge', id })
  }

  get W(): number {
    return DESIGN.width
  }
  get H(): number {
    return DESIGN.height
  }

  /**
   * The on-screen CSS width (px) of the FIT-scaled canvas, passed in by PhaserCanvas.
   * Falls back to the design width when unknown. Use it to decide compact layouts.
   */
  get displayW(): number {
    const w = Number((this.params as { _displayW?: number })._displayW)
    return Number.isFinite(w) && w > 0 ? w : DESIGN.width
  }

  /** True on phone-width canvases — scenes trim labels and grow touch targets. */
  get compact(): boolean {
    return this.displayW < 560
  }

  /** Physical px ≈ design px × this. Lets scenes keep text ≥ a legible floor. */
  get displayScale(): number {
    return this.displayW / DESIGN.width
  }

  /**
   * Design-space font size that renders at ~targetPx on the actual screen,
   * clamped to a sane design range. The canvas is FIT-scaled, so a fixed
   * design font shrinks to ~half on a phone; routing every label through `fs`
   * keeps on-screen text at a legible target regardless of device.
   */
  fs(targetPx: number, min = 12, max = 30): number {
    const d = targetPx / this.displayScale
    return Math.round(Math.max(min, Math.min(max, d)))
  }

  private _reduceMotion?: boolean
  /** Honour the OS "reduce motion" setting; scenes skip/shorten tweens when true. */
  get reduceMotion(): boolean {
    if (this._reduceMotion === undefined) {
      this._reduceMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return this._reduceMotion
  }

  /** Collapse a duration to ~instant when reduced motion is requested. */
  dur(ms: number): number {
    return this.reduceMotion ? 0 : ms
  }

  /**
   * A gentle, infinite "breathing" or sweep loop that becomes a no-op under
   * reduced motion. Use for ambient motion (floating cards, sweeping markers)
   * so the reduced-motion fallback is handled in one place.
   */
  loop(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween | undefined {
    if (this.reduceMotion) return undefined
    return this.tweens.add(config)
  }

  // --- Helpers --------------------------------------------------------------

  /**
   * Text with the brand font and sensible defaults. Font size is floored at 12px for
   * legibility. Pass `bg: true` to draw a semi-opaque rounded chip behind the text so
   * it stays readable over candles/fills/other elements (use for any label that sits
   * over busy graphics or a moving element).
   */
  label(
    x: number,
    y: number,
    text: string,
    opts: {
      size?: number
      col?: ColorName | number
      bold?: boolean
      align?: 'left' | 'center' | 'right'
      bg?: boolean
      bgCol?: ColorName | number
      bgAlpha?: number
    } = {},
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, {
      fontFamily: FONT,
      // Floored at 13px: at the canvas's smallest (mobile FIT) scale this is the
      // lowest size that still reads. Tiny 11px labels are the #1 mobile-legibility tell.
      fontSize: `${Math.max(13, opts.size ?? 15)}px`,
      color: hex(opts.col ?? C.ink),
      fontStyle: opts.bold ? 'bold' : 'normal',
      align: opts.align ?? 'left',
    })
    if (opts.align === 'center') t.setOrigin(0.5, 0.5)
    else if (opts.align === 'right') t.setOrigin(1, 0.5)
    else t.setOrigin(0, 0.5)
    if (opts.bg) this.chipBehind(t, opts.bgCol, opts.bgAlpha)
    return t
  }

  /** Draw a rounded background chip behind an existing text object (sized to it). */
  chipBehind(t: Phaser.GameObjects.Text, bgCol?: ColorName | number, bgAlpha = 0.85): Phaser.GameObjects.Graphics {
    const padX = 6
    const padY = 3
    const bx = t.x - t.originX * t.width - padX
    const by = t.y - t.originY * t.height - padY
    const g = this.add.graphics()
    g.fillStyle(color(bgCol ?? C.white), bgAlpha)
    g.fillRoundedRect(bx, by, t.width + padX * 2, t.height + padY * 2, 5)
    this.children.moveBelow(g, t)
    // Tie the chip to its text's lifecycle. Scenes that redraw labels (e.g. breakevens
    // on a slider drag) destroy and recreate the text each frame; without this the chip
    // graphics leak and pile up as stray white rectangles wherever the label used to be.
    t.once(Phaser.GameObjects.Events.DESTROY, () => g.destroy())
    return g
  }

  /** Rounded panel. Returns the graphics object. */
  panel(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { fill?: ColorName | number; stroke?: ColorName | number; radius?: number; alpha?: number } = {},
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics()
    g.fillStyle(color(opts.fill ?? C.white), opts.alpha ?? 1)
    g.fillRoundedRect(x, y, w, h, opts.radius ?? 12)
    if (opts.stroke !== undefined) {
      g.lineStyle(1.5, color(opts.stroke))
      g.strokeRoundedRect(x, y, w, h, opts.radius ?? 12)
    }
    return g
  }

  /** Dashed horizontal line from x1 to x2 at y. */
  dashedLine(
    x1: number,
    y: number,
    x2: number,
    col: ColorName | number,
    dash = 8,
    gap = 6,
    width = 1.5,
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics()
    g.lineStyle(width, color(col))
    for (let x = x1; x < x2; x += dash + gap) {
      g.lineBetween(x, y, Math.min(x + dash, x2), y)
    }
    return g
  }

  /** Simple clickable in-canvas button. Calls onClick on pointer-up. */
  button(
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    opts: { w?: number; h?: number; fill?: ColorName | number; textCol?: ColorName | number } = {},
  ): Phaser.GameObjects.Container {
    const w = opts.w ?? 150
    const h = opts.h ?? 40
    const g = this.add.graphics()
    g.fillStyle(color(opts.fill ?? C.ink), 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10)
    const t = this.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: '15px', color: hex(opts.textCol ?? C.white), fontStyle: 'bold' })
      .setOrigin(0.5)
    const c = this.add.container(x, y, [g, t])
    c.setSize(w, h)
    c.setInteractive({ useHandCursor: true })
    // Tactile feedback: lift + brighten on hover, press down on pointerdown.
    const press = (scale: number, alpha: number) =>
      this.tweens.add({ targets: c, scale, alpha, duration: 90, ease: 'Quad.out' })
    c.on('pointerover', () => press(1.03, 1))
    c.on('pointerout', () => press(1, 1))
    c.on('pointerdown', () => press(0.96, 0.92))
    c.on('pointerup', () => {
      press(1.03, 1)
      onClick()
    })
    return c
  }

  /**
   * Horizontal slider. Press anywhere on the track and drag — the whole track is
   * grabbable. Calls onChange(value) live; `set(v)` moves it without firing onChange.
   * Range [min,max], snapped to `step` if given.
   *
   * Mapping note: the value domain [min,max] and the pixel domain [0,w] are kept
   * strictly separate (an earlier version conflated them, which made the knob jumpy
   * and unable to reach the ends). Pointer positions are read in DESIGN/world space
   * (pointer.worldX, camera-zoom-safe) and the slider sits at the scene root, so
   * localX = pointer.worldX - container.x ∈ [0,w].
   */
  slider(
    x: number,
    y: number,
    w: number,
    min: number,
    max: number,
    value: number,
    onChange: (v: number) => void,
    opts: { step?: number; col?: ColorName | number } = {},
  ): { set: (v: number) => void; container: Phaser.GameObjects.Container } {
    const trackCol = color(opts.col ?? C.blue)
    const track = this.add.graphics()
    track.fillStyle(C.gray200, 1)
    track.fillRoundedRect(0, -4, w, 8, 4)
    const fill = this.add.graphics()
    // Oversized transparent hit area is the ONLY interactive object (the knob is
    // visual only) so there is never an input-priority fight between the two. The
    // 48px-tall band keeps it comfortably tappable once the canvas is FIT-scaled
    // down on a phone.
    const hit = this.add.rectangle(w / 2, 0, w + 28, 48, 0x000000, 0)
    // Soft halo behind the knob — fades in while dragging for a clear "grabbed" state.
    const halo = this.add.circle(0, 0, 20, trackCol, 0.16).setVisible(false)
    const knob = this.add.circle(0, 0, 13, trackCol).setStrokeStyle(3, C.white)
    const container = this.add.container(x, y, [track, fill, hit, halo, knob])

    const clampV = (v: number) => Math.max(min, Math.min(max, v))
    const snap = (v: number) => clampV(opts.step ? Math.round(v / opts.step) * opts.step : v)

    const redraw = (v: number) => {
      const t = max === min ? 0 : (clampV(v) - min) / (max - min)
      knob.x = t * w
      halo.x = t * w
      fill.clear()
      if (t > 0) {
        fill.fillStyle(trackCol, 1)
        fill.fillRoundedRect(0, -4, t * w, 8, 4)
      }
    }
    const apply = (v: number, fire: boolean) => {
      const sv = snap(v)
      redraw(sv)
      if (fire) onChange(sv)
    }
    redraw(snap(value))

    const valueAt = (pointerX: number): number => {
      const localX = Math.max(0, Math.min(w, pointerX - container.x))
      return min + (localX / w) * (max - min)
    }

    let dragging = false
    hit.setInteractive({ useHandCursor: true })
    hit.on('pointerover', () => knob.setScale(1.12))
    hit.on('pointerout', () => {
      if (!dragging) knob.setScale(1)
    })
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true
      halo.setVisible(true)
      knob.setScale(1.18)
      apply(valueAt(p.worldX), true)
    })
    const onMove = (p: Phaser.Input.Pointer) => {
      if (dragging) apply(valueAt(p.worldX), true)
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      halo.setVisible(false)
      knob.setScale(1)
    }
    this.input.on('pointermove', onMove)
    this.input.on('pointerup', onUp)
    this.input.on('pointerupoutside', onUp)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', onMove)
      this.input.off('pointerup', onUp)
      this.input.off('pointerupoutside', onUp)
    })

    return { set: (v: number) => apply(v, false), container }
  }

  /** Fade + rise a game object into view (instant under reduced motion). */
  fadeIn(obj: Phaser.GameObjects.GameObject & { alpha: number; y: number }, delay = 0, dy = 8): void {
    const targetY = obj.y
    if (this.reduceMotion) {
      obj.alpha = 1
      obj.y = targetY
      return
    }
    obj.alpha = 0
    obj.y = targetY + dy
    this.tweens.add({ targets: obj, alpha: 1, y: targetY, duration: 320, delay, ease: 'Cubic.out' })
  }
}
