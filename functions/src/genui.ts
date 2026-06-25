/**
 * Proof that the Cloud Functions toolchain can import + run the PURE / ISOMORPHIC
 * genui core (the WS-A backbone). This unblocks WS-D, which will build server-side
 * `composeScenario`/`gradeRun` callables that compose a layout with GPT-5.5 and then
 * validate it here with the SAME `validateLayout` the client uses (no schema drift).
 *
 * The core is mirrored into `src/shared/**` by `scripts/copy-shared.mjs` on prebuild.
 */
import { validateLayout, layoutFitsTrack } from './shared/practice/genui/schema'
import type { LayoutCatalog } from './shared/practice/genui/types'
import type { Track } from './shared/practice/types'

export interface LayoutSanity {
  ok: boolean
  errors: string[]
}

/**
 * Server-side sanity validation of an LLM/curated layout against the real-data
 * allow-list (and, when a track is given, widget/track fitness). Pure — delegates to
 * the shared isomorphic validators.
 */
export function sanityValidateLayout(
  layout: unknown,
  catalog: LayoutCatalog,
  track?: Track,
): LayoutSanity {
  const base = validateLayout(layout, catalog)
  const errors = [...base.errors]
  if (track) errors.push(...layoutFitsTrack(layout, track))
  return { ok: errors.length === 0, errors }
}
