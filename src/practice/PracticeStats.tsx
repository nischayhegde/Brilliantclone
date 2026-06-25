import { summarizePractice } from './summary'
import type { PracticeAccount } from './account'
import type { PracticeRun, Track } from './types'

const TRACK_LABEL: Record<Track, string> = {
  charts: 'Charts',
  options: 'Options',
  'market-making': 'Market making',
}

const TRACKS: Track[] = ['charts', 'options', 'market-making']

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-display text-2xl font-bold text-ink">{value}</dd>
    </div>
  )
}

/**
 * Presentational practice stats: total runs, best process score, resets (ruin
 * events), last played, and per-track tier/skill/avg-process. Pure props in.
 */
export default function PracticeStats({ runs, account }: { runs: PracticeRun[]; account: PracticeAccount }) {
  const s = summarizePractice(runs)
  return (
    <section aria-labelledby="practice-stats-heading" className="rounded-2xl border border-hairline bg-white p-5">
      <h2 id="practice-stats-heading" className="font-display text-xl font-bold">
        Your practice
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Runs" value={s.totalRuns} />
        <Stat label="Best score" value={s.totalRuns ? `${s.bestScore}/100` : '—'} />
        <Stat label="Resets" value={account.ruinEvents} />
        <Stat
          label="Last played"
          value={s.lastPlayedTs ? new Date(s.lastPlayedTs).toLocaleDateString('en-US') : '—'}
        />
      </dl>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {TRACKS.map((t) => (
          <div key={t} className="rounded-xl border border-hairline bg-paper p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">{TRACK_LABEL[t]}</div>
            <div className="mt-1 text-sm text-ink">
              Tier {account.tier[t]} · Skill {Math.round(account.skill[t])}/100
            </div>
            <div className="mt-1 text-sm text-muted">
              Avg process {s.avgScoreByTrack[t] != null ? `${s.avgScoreByTrack[t]}/100` : '—'}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
