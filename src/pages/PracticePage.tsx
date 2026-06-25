import { useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Spinner from '../components/ui/Spinner'
import { usePractice } from '../state/PracticeContext'
import { allTracks } from '../practice/scenarioRegistry'
import type { Track } from '../practice/types'

const TRACK_LABEL: Record<Track, string> = {
  charts: 'Chart patterns',
  options: 'Options',
  'market-making': 'Market making',
}

export default function PracticePage() {
  const { track } = useParams<{ track?: Track }>()
  const { loading, account } = usePractice()

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
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-4xl font-bold">Practice</h1>
                <p className="mt-2 text-ink-soft">
                  Trade real historical setups. Graded on process, not luck.
                </p>
              </div>
              <div className="rounded-2xl bg-ink px-5 py-3 text-white">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Paper balance</div>
                <div className="font-display text-2xl font-bold">${account.balance.toLocaleString('en-US')}</div>
              </div>
            </header>

            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              {allTracks.map((t) => (
                <div key={t} className="rounded-2xl border border-hairline bg-white p-5">
                  <div className="text-sm font-bold uppercase tracking-wide text-muted">{TRACK_LABEL[t]}</div>
                  <div className="mt-2 text-3xl font-bold">Tier {account.tier[t]}</div>
                  <div className="mt-1 text-sm text-muted">Skill {Math.round(account.skill[t])}/100</div>
                  <p className="mt-4 text-sm text-ink-soft">Scenario player arrives in the next milestone.</p>
                </div>
              ))}
            </section>

            {track && (
              <p className="mt-6 text-sm text-muted">
                Selected track: <span className="font-bold text-ink">{TRACK_LABEL[track as Track] ?? track}</span>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
