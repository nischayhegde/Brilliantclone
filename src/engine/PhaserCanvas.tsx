import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { SceneBus } from './bus'
import { DESIGN } from './ModuleScene'

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

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: DESIGN.width,
      height: DESIGN.height,
      backgroundColor: '#ffffff',
      transparent: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, roundPixels: false },
      callbacks: {
        postBoot: (g) => {
          g.scene.add('module', scene, true, { params: params ?? {}, bus })
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
