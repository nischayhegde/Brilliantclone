import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import { NUDGES } from './nudges'
import { FEELING_LABEL } from './copy'
import type { Feeling, ProcessScore, ScenarioOutcome, ScenarioSpec } from './types'

export interface ScenarioDebriefProps {
  spec: ScenarioSpec
  score: ProcessScore
  feedback: string
  source: 'llm' | 'deterministic'
  outcome: ScenarioOutcome
  nudges: string[]
  journal: { rationale: string; feeling: Feeling } | null
  illus: string | null
  reduceMotion: boolean
  onContinue: () => void
}

/** Quality band for a 0..1 dimension score → fill color + short tag. */
function band(score: number): { fill: string; tag: string | null } {
  if (score >= 0.8) return { fill: 'var(--color-brand-green)', tag: null }
  if (score >= 0.5) return { fill: 'var(--color-brand-amber)', tag: null }
  return { fill: 'var(--color-brand-red)', tag: 'Focus here' }
}

/** Circular 0..100 gauge for the process score — the headline figure. */
function ScoreRing({ value, passed, reduceMotion }: { value: number; passed: boolean; reduceMotion: boolean }) {
  const r = 52
  const c = 2 * Math.PI * r
  const stroke = passed ? 'var(--color-brand-green)' : 'var(--color-brand-amber)'
  // Animate the sweep on mount (unless reduced motion) by transitioning the dash offset
  // from "empty" to the real value.
  const [shown, setShown] = useState(reduceMotion)
  useEffect(() => {
    if (reduceMotion) {
      setShown(true)
      return
    }
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [reduceMotion])
  const offset = c * (1 - (shown ? value / 100 : 0))
  return (
    <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0" role="img" aria-label={`Process score ${value} out of 100`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="10" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
        style={{ transition: reduceMotion ? undefined : 'stroke-dashoffset 700ms var(--ease-out-quint)' }}
      />
      <text x="64" y="60" textAnchor="middle" className="font-display" fontSize="32" fontWeight="700" fill="var(--color-ink)">
        {value}
      </text>
      <text x="64" y="82" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-muted)">
        / 100
      </text>
    </svg>
  )
}

/** The redesigned post-run result: process score is the headline; P&L is display-only. */
export default function ScenarioDebrief({
  spec,
  score,
  feedback,
  source,
  outcome,
  nudges,
  journal,
  illus,
  reduceMotion,
  onContinue,
}: ScenarioDebriefProps) {
  const passed = score.total >= spec.objective.passScore
  const pnl = outcome.pnl
  const pnlUp = pnl >= 0
  const modelEstimate = outcome.facts.modelEstimate === true

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Headline: the process score is the score of record. */}
      <section
        aria-label="Process score"
        className="flex flex-col items-center gap-5 rounded-2xl border border-hairline bg-paper p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:flex-row sm:items-center sm:gap-7"
      >
        <ScoreRing value={score.total} passed={passed} reduceMotion={reduceMotion} />
        <div className="flex flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              passed ? 'bg-brand-green-soft text-brand-green-text' : 'bg-brand-amber-soft text-brand-amber-ink'
            }`}
          >
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${passed ? 'bg-brand-green' : 'bg-brand-amber'}`} />
            {passed ? 'Process passed' : 'Keep building the process'}
          </span>
          <h2 className="font-display text-2xl font-bold leading-tight text-ink">{score.title}</h2>
          <p className="text-sm leading-relaxed text-ink-soft">{score.detail}</p>
          <span className="mt-0.5 text-xs font-semibold text-muted">
            {source === 'llm' ? 'Graded by GPT-5.5 · process, not P&L' : 'Deterministic grade · process, not P&L'}
          </span>
        </div>
      </section>

      {/* Per-dimension breakdown. */}
      <section aria-label="Score breakdown" className="flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">How you scored</h3>
        <ul className="flex flex-col gap-4">
          {score.dimensions.map((d) => {
            const pct = Math.round(d.score * 100)
            const { fill, tag } = band(d.score)
            return (
              <li key={d.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">{d.label}</span>
                  <span className="flex items-center gap-2">
                    {tag && (
                      <span className="rounded-full bg-brand-red-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-red">
                        {tag}
                      </span>
                    )}
                    <span className="text-sm font-bold tabular-nums text-ink">{pct}%</span>
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={d.label}
                >
                  <div
                    className={reduceMotion ? 'h-full rounded-full' : 'h-full rounded-full transition-[width] duration-700 ease-out'}
                    style={{ width: `${pct}%`, backgroundColor: fill }}
                  />
                </div>
                <p className="text-sm leading-relaxed text-ink-soft">{d.note}</p>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Written coaching feedback (LLM or curated). */}
      {feedback && (
        <section aria-label="Coach feedback" className="rounded-2xl bg-surface p-5">
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-ink">{feedback}</p>
        </section>
      )}

      {/* What the learner committed to before the result — closes the reflection loop. */}
      {journal && (
        <section aria-label="Your pre-trade note" className="flex flex-col gap-2 rounded-2xl border border-hairline bg-paper p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">What you logged going in</h3>
          <p className="text-[15px] leading-relaxed text-ink">&ldquo;{journal.rationale}&rdquo;</p>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-soft">
            Felt {FEELING_LABEL[journal.feeling]}
          </span>
        </section>
      )}

      {/* Coaching nudges that the setup tripped. */}
      {nudges.length > 0 && (
        <section aria-label="Risk notes" className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Worth noticing</h3>
          <ul className="flex flex-col gap-2">
            {nudges.map((id) => (
              <li
                key={id}
                className="rounded-xl border border-brand-amber-soft bg-brand-amber-soft/60 px-4 py-3 text-sm font-medium leading-relaxed text-brand-amber-ink"
              >
                {NUDGES[id]?.copy}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* P&L is display-only and deliberately secondary — never the headline. */}
      <section
        aria-label="Result profit and loss"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline pt-4"
      >
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Result P&amp;L · display only</span>
          <span className="text-xs text-muted">Real outcome; it never sets your grade.</span>
        </div>
        <span className={`font-display text-xl font-bold tabular-nums ${pnlUp ? 'text-brand-green-text' : 'text-brand-red'}`}>
          {pnlUp ? '+' : '−'}${Math.abs(Math.round(pnl)).toLocaleString('en-US')}
        </span>
      </section>

      {(modelEstimate || illus) && (
        <p className="-mt-3 text-xs leading-relaxed text-muted">
          {modelEstimate
            ? 'Closed early — this P&L is a model estimate (IV is real); a held-to-expiry P&L is exact. '
            : ''}
          {illus}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </div>
  )
}
