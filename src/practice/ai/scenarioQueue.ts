import type { ScenarioSpec, Track } from '../types'

/**
 * Background prefetch buffer for composed scenarios. Each buffered spec is a fully-formed
 * LAYOUT spec — `composeScenario` guarantees a `layout` on every result (server-composed or
 * curated fallback) — so `take()` always yields a WidgetHost-renderable scenario instantly.
 */
export const QUEUE_SIZE = 2

export interface ScenarioQueue {
  /** Return the next ready spec (instant if buffered); refill in the background. */
  take(track: Track): Promise<ScenarioSpec>
  /** Kick off background composes to fill the buffer to `size`. */
  prime(track: Track): void
  /** How many specs are buffered for a track right now. */
  ready(track: Track): number
}

/** The queue only needs the spec; ComposeResult satisfies this as a superset. */
type Composed = { spec: ScenarioSpec }

export function makeScenarioQueue(
  compose: (track: Track) => Promise<Composed>,
  opts: { size?: number } = {},
): ScenarioQueue {
  const size = opts.size ?? QUEUE_SIZE
  const buffers: Partial<Record<Track, ScenarioSpec[]>> = {}
  const inflight: Partial<Record<Track, number>> = {}

  const buf = (t: Track) => (buffers[t] ??= [])
  const inflightOf = (t: Track) => inflight[t] ?? 0

  function fill(track: Track): void {
    while (buf(track).length + inflightOf(track) < size) {
      inflight[track] = inflightOf(track) + 1
      compose(track)
        .then((res) => buf(track).push(res.spec))
        .catch(() => { /* swallow background failures; on-demand take still works */ })
        .finally(() => { inflight[track] = inflightOf(track) - 1 })
    }
  }

  return {
    prime(track) { fill(track) },
    ready(track) { return buf(track).length },
    async take(track) {
      const b = buf(track)
      if (b.length > 0) {
        const spec = b.shift()!
        fill(track) // refill in the background
        return spec
      }
      // Buffer empty: compose one now (composeScenario has its own curated fallback), then refill.
      const res = await compose(track)
      fill(track)
      return res.spec
    },
  }
}
