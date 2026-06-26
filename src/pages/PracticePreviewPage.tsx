/**
 * DEV-ONLY visual-verification harness for the Trading Practice rebuild.
 *
 * The real Practice routes live behind a Google-popup `ProtectedRoute`, so the redesigned
 * hub and the generative `ScenarioPlayer` flow can't be screenshotted without signing in.
 * This page renders the SAME components with NO signed-in user required — it relies only on
 * the ambient `PracticeProvider`, which serves `initialAccount()` defaults when signed out,
 * and on curated specs (AI off → deterministic grade) so the full flow (layout → journal →
 * debrief) is exercisable offline.
 *
 * It is mounted ONLY behind an `import.meta.env.DEV` guard in `App.tsx`, so the route is
 * never registered (and this module is never bundled) in a production build.
 */
import { useEffect, useMemo, useState } from 'react'
import Spinner from '../components/ui/Spinner'
import PracticePage from './PracticePage'
import ScenarioPlayer from '../practice/ScenarioPlayer'
import { allTracks, proceduralSpec, scenariosFor } from '../practice/scenarioRegistry'
import { getEngine } from '../practice/engines'
import type { Track } from '../practice/types'

type View = 'hub' | Track

const TRACK_LABEL: Record<Track, string> = {
  charts: 'Charts',
  options: 'Options',
  'market-making': 'Market making',
}

const TIERS = [1, 2, 3] as const

/**
 * Load a curated spec for a track/tier and run it through the real `ScenarioPlayer`.
 * Data is loaded via the real engine (bundled candles for charts/MM; fetched chain for
 * options — both work against the dev server). Remounts on every spec change via `key`.
 */
function PreviewPlayer({ track }: { track: Track }) {
  const [tier, setTier] = useState<number>(1)
  // Procedural mode exercises the near-infinite offline engine; `gen` reseeds it on demand.
  const procedural = track === 'charts' || track === 'market-making'
  const [proc, setProc] = useState(false)
  const [gen, setGen] = useState(0)
  const spec = useMemo(
    () =>
      proc && procedural
        ? proceduralSpec(track as 'charts' | 'market-making', tier)
        : (scenariosFor(track, tier)[0] ?? scenariosFor(track)[0]),
    // `gen` is an intentional reseed trigger for the procedural branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track, tier, proc, procedural, gen],
  )
  // Tag loaded data with the spec id it belongs to, so we never hand ScenarioPlayer the
  // PREVIOUS spec's data shape for a frame while a new spec's data is still loading (the
  // tracks resolve to different data shapes — that mismatch would crash on render).
  const [loaded, setLoaded] = useState<{ id: string; data: unknown } | null>(null)

  useEffect(() => {
    setLoaded(null)
    if (!spec) return
    let active = true
    getEngine(spec.track)
      .loadData(spec)
      .then((d) => active && setLoaded({ id: spec.id, data: d }))
      .catch((e) => console.error('preview loadData failed', e))
    return () => {
      active = false
    }
  }, [spec])

  const ready = spec && loaded && loaded.id === spec.id

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tier</span>
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            aria-pressed={tier === t}
            className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
              tier === t ? 'bg-ink text-white' : 'border border-hairline bg-paper text-ink-soft hover:border-ink/30'
            }`}
          >
            {t}
          </button>
        ))}
        {procedural && (
          <>
            <button
              type="button"
              onClick={() => setProc((v) => !v)}
              aria-pressed={proc}
              className={`ml-2 rounded-lg px-3 py-1 text-sm font-semibold transition ${
                proc ? 'bg-brand-amber text-white' : 'border border-hairline bg-paper text-ink-soft hover:border-ink/30'
              }`}
            >
              Procedural ∞
            </button>
            {proc && (
              <button
                type="button"
                onClick={() => setGen((g) => g + 1)}
                className="rounded-lg border border-hairline bg-paper px-3 py-1 text-sm font-semibold text-ink-soft transition hover:border-ink/30"
              >
                New scenario
              </button>
            )}
          </>
        )}
        {spec && <span className="ml-2 text-xs font-medium text-muted">spec: {spec.id}</span>}
      </div>

      {!spec ? (
        <p className="py-24 text-center text-sm text-muted">No curated spec for {TRACK_LABEL[track]}.</p>
      ) : !ready ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <ScenarioPlayer key={spec.id} spec={spec} data={loaded.data} />
      )}
    </main>
  )
}

export default function PracticePreviewPage() {
  const [view, setView] = useState<View>('hub')
  const tabs: { id: View; label: string }[] = [
    { id: 'hub', label: 'Practice hub' },
    ...allTracks.map((t) => ({ id: t as View, label: TRACK_LABEL[t] })),
  ]

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-brand-amber/40 bg-brand-amber-soft/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="rounded-full bg-brand-amber px-2.5 py-0.5 text-xs font-bold text-white">DEV preview</span>
          <span className="text-xs font-medium text-brand-amber-ink">No sign-in required · curated specs · deterministic grade</span>
          <nav aria-label="Preview views" className="ml-auto flex flex-wrap items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                aria-pressed={view === tab.id}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  view === tab.id
                    ? 'bg-ink text-white'
                    : 'border border-hairline bg-paper text-ink-soft hover:border-ink/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {view === 'hub' ? <PracticePage /> : <PreviewPlayer key={view} track={view} />}
    </div>
  )
}
