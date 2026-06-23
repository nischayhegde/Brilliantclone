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
    this.offBus = this.bus.on((e) => this.handleBus(e))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offBus?.())
    this.build()
  }

  /** Build the whole scene at DESIGN size. Required. */
  protected abstract build(): void

  private handleBus(e: SceneEvent): void {
    if (e.type === 'reveal') this.onReveal()
    else if (e.type === 'reset') this.onReset()
    else if (e.type === 'set') this.onSet(e.key, e.value)
  }

  // Optional override points -------------------------------------------------
  protected onReveal(): void {}
  protected onReset(): void {}
  protected onSet(_key: string, _value: number | string | boolean): void {}

  /** Tell the renderer the intro animation finished (optional gating). */
  protected emitReady(): void {
    this.bus.emit({ type: 'ready' })
  }
  /** Push a live value to the renderer (optional; most scenes self-render readouts). */
  protected readout(key: string, value: number | string | boolean): void {
    this.bus.emit({ type: 'readout', key, value })
  }

  get W(): number {
    return DESIGN.width
  }
  get H(): number {
    return DESIGN.height
  }

  // --- Helpers --------------------------------------------------------------

  /** Text with the brand font and sensible defaults. */
  label(
    x: number,
    y: number,
    text: string,
    opts: { size?: number; col?: ColorName | number; bold?: boolean; align?: 'left' | 'center' | 'right' } = {},
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${opts.size ?? 15}px`,
      color: hex(opts.col ?? C.ink),
      fontStyle: opts.bold ? 'bold' : 'normal',
      align: opts.align ?? 'left',
    })
    if (opts.align === 'center') t.setOrigin(0.5, 0.5)
    else if (opts.align === 'right') t.setOrigin(1, 0.5)
    else t.setOrigin(0, 0.5)
    return t
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
    g.fillStyle(color(opts.fill ?? C.blue), 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10)
    const t = this.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: '15px', color: hex(opts.textCol ?? C.white), fontStyle: 'bold' })
      .setOrigin(0.5)
    const c = this.add.container(x, y, [g, t])
    c.setSize(w, h)
    c.setInteractive({ useHandCursor: true })
    c.on('pointerup', onClick)
    c.on('pointerover', () => c.setAlpha(0.9))
    c.on('pointerout', () => c.setAlpha(1))
    return c
  }

  /**
   * Horizontal slider. Press anywhere on the track and drag — the whole track is
   * grabbable. Calls onChange(value) live; `set(v)` moves it without firing onChange.
   * Range [min,max], snapped to `step` if given.
   *
   * Mapping note: the value domain [min,max] and the pixel domain [0,w] are kept
   * strictly separate (an earlier version conflated them, which made the knob jumpy
   * and unable to reach the ends). Pointer positions are game-space, and the slider
   * is placed at the scene root, so localX = pointer.x - container.x ∈ [0,w].
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
    track.fillRoundedRect(0, -3, w, 6, 3)
    const fill = this.add.graphics()
    // Oversized transparent hit area is the ONLY interactive object (the knob is
    // visual only) so there is never an input-priority fight between the two.
    const hit = this.add.rectangle(w / 2, 0, w + 24, 36, 0x000000, 0)
    const knob = this.add.circle(0, 0, 11, trackCol).setStrokeStyle(3, C.white)
    const container = this.add.container(x, y, [track, fill, hit, knob])

    const clampV = (v: number) => Math.max(min, Math.min(max, v))
    const snap = (v: number) => clampV(opts.step ? Math.round(v / opts.step) * opts.step : v)

    const redraw = (v: number) => {
      const t = max === min ? 0 : (clampV(v) - min) / (max - min)
      knob.x = t * w
      fill.clear()
      if (t > 0) {
        fill.fillStyle(trackCol, 1)
        fill.fillRoundedRect(0, -3, t * w, 6, 3)
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
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true
      apply(valueAt(p.x), true)
    })
    const onMove = (p: Phaser.Input.Pointer) => {
      if (dragging) apply(valueAt(p.x), true)
    }
    const onUp = () => {
      dragging = false
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

  /** Fade + rise a game object into view. */
  fadeIn(obj: Phaser.GameObjects.GameObject & { alpha: number; y: number }, delay = 0, dy = 8): void {
    const targetY = obj.y
    obj.alpha = 0
    obj.y = targetY + dy
    this.tweens.add({ targets: obj, alpha: 1, y: targetY, duration: 320, delay, ease: 'Cubic.out' })
  }
}
