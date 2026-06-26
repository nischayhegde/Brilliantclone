import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Spinner from '../components/ui/Spinner'
import Disclaimer from '../components/Disclaimer'
import ResetReflect from '../practice/ResetReflect'
import PracticeStats from '../practice/PracticeStats'
import { usePractice } from '../state/PracticeContext'
import { allTracks, scenariosFor } from '../practice/scenarioRegistry'
import { TRACK_BLURB } from '../practice/copy'
import type { Track } from '../practice/types'

const TRACK_LABEL: Record<Track, string> = {
  charts: 'Chart patterns',
  options: 'Options',
  'market-making': 'Market making',
}

/** What the learner walks away able to do — the teaching promise, in one short clause. */
const TRACK_SKILL: Record<Track, string> = {
  charts: 'Read price action, define risk, and trade a level with a plan.',
  options: 'Build a defined-risk options structure and manage it to expiry.',
  'market-making': 'Quote both sides, earn the spread, and survive adverse selection.',
}

function SkillBar({ skill }: { skill: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(skill)))
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Skill"
    >
      <div className="h-full rounded-full bg-brand-amber" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function PracticePage() {
  const { track } = useParams<{ track?: Track }>()
  const { loading, account, recentRuns, nextScenario, primeScenarios, pendingRuin } = usePractice()
  const navigate = useNavigate()
  const [starting, setStarting] = useState<Track | null>(null)

  // Gate the card on a pure, synchronous check (NOT on calling nextScenario) so the
  // button stays render-safe now that nextScenario is async/LLM-primary.
  const hasTrack = (t: Track) => scenariosFor(t).length > 0

  // Warm the prefetch queue for playable tracks so the first scenario is usually already LLM.
  useEffect(() => {
    if (loading) return
    for (const t of allTracks) if (scenariosFor(t).length > 0) primeScenarios(t)
  }, [loading, primeScenarios])

  // Suggest the playable track with the most room to grow.
  const recommended = useMemo<Track | null>(() => {
    const playable = allTracks.filter((t) => scenariosFor(t).length > 0)
    if (!playable.length) return null
    return playable.reduce((lo, t) => (account.skill[t] < account.skill[lo] ? t : lo), playable[0])
  }, [account.skill])

  const start = async (t: Track) => {
    if (starting) return
    setStarting(t)
    try {
      const s = await nextScenario(t) // LLM-primary: instant when warm, composes on demand otherwise
      if (s) navigate(`/practice/play/${s.id}`)
    } catch (e) {
      console.error('Failed to start scenario', e)
    } finally {
      setStarting(null)
    }
  }

  if (pendingRuin)
    return (
      <div className="min-h-screen bg-paper">
        <TopNav />
        <main className="mx-auto max-w-5xl px-4 py-10">
          <ResetReflect />
          <Disclaimer />
        </main>
      </div>
    )

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2">
                <h1 className="font-display text-4xl font-bold leading-[1.05] text-ink sm:text-5xl">Practice</h1>
                <p className="max-w-lg text-[15px] leading-relaxed text-ink-soft">
                  Trade real historical setups. You&rsquo;re graded on process — your read, your risk, your
                  discipline — never on luck.
                </p>
              </div>
              <div className="flex items-stretch gap-3">
                <div className="rounded-2xl bg-ink px-5 py-4 text-white">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/55">Paper balance</div>
                  <div className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                    ${account.balance.toLocaleString('en-US')}
                  </div>
                </div>
                <div className="rounded-2xl border border-hairline bg-paper px-5 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Resets</div>
                  <div className="mt-0.5 font-display text-2xl font-bold tabular-nums text-ink">{account.ruinEvents}</div>
                </div>
              </div>
            </header>

            <section aria-label="Practice tracks" className="mt-10 flex flex-col gap-4">
              {allTracks.map((t) => {
                const playable = hasTrack(t)
                const isRecommended = playable && recommended === t
                return (
                  <article
                    key={t}
                    className={`flex flex-col gap-5 rounded-2xl border bg-paper p-6 transition duration-200 ease-out sm:flex-row sm:items-center sm:justify-between sm:gap-8 ${
                      isRecommended ? 'border-brand-amber/50 shadow-[0_1px_2px_rgba(28,25,23,0.04)]' : 'border-hairline'
                    } ${playable ? 'hover:border-ink/25 hover:shadow-md' : 'opacity-70'}`}
                  >
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="font-display text-xl font-bold text-ink">{TRACK_LABEL[t]}</h2>
                        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-ink-soft">
                          Tier {account.tier[t]}
                        </span>
                        {isRecommended && (
                          <span className="rounded-full bg-brand-amber-soft px-2.5 py-0.5 text-xs font-bold text-brand-amber-ink">
                            Start here
                          </span>
                        )}
                      </div>
                      <p className="max-w-xl text-sm leading-relaxed text-ink-soft">{TRACK_BLURB[t]}</p>
                      <p className="text-xs font-medium text-muted">{TRACK_SKILL[t]}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <SkillBar skill={account.skill[t]} />
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">
                          {Math.round(account.skill[t])}
                          <span className="text-muted">/100</span>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={() => start(t)}
                        disabled={!playable || starting !== null}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:-translate-y-px hover:bg-black hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0 sm:w-auto"
                      >
                        {!playable ? 'Coming soon' : starting === t ? (
                          <>
                            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
                            Composing…
                          </>
                        ) : (
                          'Start scenario'
                        )}
                      </button>
                    </div>
                  </article>
                )
              })}
            </section>

            {track && (
              <p className="mt-6 text-sm text-muted">
                Selected track: <span className="font-bold text-ink">{TRACK_LABEL[track as Track] ?? track}</span>
              </p>
            )}

            <div className="mt-10">
              <PracticeStats runs={recentRuns} account={account} />
            </div>

            <Disclaimer />
          </>
        )}
      </main>
    </div>
  )
}
