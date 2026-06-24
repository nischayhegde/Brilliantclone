import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { SceneBus } from './bus'
import { DESIGN } from './ModuleScene'

// Crisp text under the supersampling camera zoom (see PhaserCanvas/ModuleScene).
// A Phaser Text rasterises to a texture at its font size; ModuleScene then zooms the
// camera by RES, which magnifies that texture and leaves text soft even though the
// vector graphics are sharp. Rendering each Text's texture at the zoom factor fixes it.
// We patch the factory once (idempotent) so EVERY `scene.add.text(...)` is covered,
// including the many scenes that build text without going through `label()`.
type CrispFactory = Phaser.GameObjects.GameObjectFactory & {
  __crispTextPatched?: boolean
  scene: Phaser.Scene
  text(...args: unknown[]): Phaser.GameObjects.Text
}
const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as CrispFactory
if (!factoryProto.__crispTextPatched) {
  const originalText = factoryProto.text
  factoryProto.text = function (this: CrispFactory, ...args: unknown[]) {
    const t = originalText.apply(this, args) as Phaser.GameObjects.Text
    const res = this.scene.scale.gameSize.width / DESIGN.width
    if (res > 1) t.setResolution(res)
    return t
  }
  factoryProto.__crispTextPatched = true
}

interface PhaserCanvasProps {
  /** The scene class to mount. */
  scene: new (config?: Phaser.Types.Scenes.SettingsConfig) => Phaser.Scene
  /** Params handed to the scene via init data. */
  params?: Record<string, unknown>
  /** Shared event bus between React and the scene. */
  bus: SceneBus
  className?: string
}

/**
 * React <-> Phaser bridge. Boots a fixed-resolution (DESIGN) game, FIT-scaled to the
 * responsive wrapper, and starts the scene with { params, bus }. One game per mount;
 * fully torn down on unmount (and on StrictMode's double-invoke in dev).
 */
export default function PhaserCanvas({ scene, params, bus, className }: PhaserCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // The on-screen width of the FIT-scaled canvas, so scenes can choose a compact
    // layout (fewer labels, larger touch targets) on phones. Measured once at boot.
    const displayW = Math.round(host.getBoundingClientRect().width || host.clientWidth || DESIGN.width)

    // Supersample factor. In Phaser's FIT mode the canvas drawing buffer is fixed to the
    // config width/height (zoom only affects CSS, never the backing store), so a 760-wide
    // buffer gets stretched across a wider, hi-DPI display and looks soft. We boot the
    // game at DESIGN×RES so the buffer comfortably exceeds the physical pixel count, then
    // ModuleScene zooms the camera by RES so every scene still authors in DESIGN space.
    // Clamped to 2–3: enough to be crisp on 1×–3× displays without a huge framebuffer.
    const RES = Math.max(2, Math.min(3, Math.ceil((window.devicePixelRatio || 1) * 1.2)))

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: DESIGN.width * RES,
      height: DESIGN.height * RES,
      backgroundColor: '#ffffff',
      transparent: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, roundPixels: false },
      callbacks: {
        postBoot: (g) => {
          g.scene.add('module', scene, true, { params: { ...(params ?? {}), _displayW: displayW }, bus })
        },
      },
    })

    return () => {
      game.destroy(true)
    }
    // Remount (new game) only when the scene identity changes — module switches use a
    // React `key` on the renderer, which remounts this component anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  return (
    <div
      ref={hostRef}
      className={className ?? 'w-full overflow-hidden rounded-2xl border border-hairline bg-white'}
      style={{ aspectRatio: `${DESIGN.width} / ${DESIGN.height}` }}
    />
  )
}
