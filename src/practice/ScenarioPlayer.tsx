import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Disclaimer from '../components/Disclaimer'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { usePractice } from '../state/PracticeContext'
import { getEngine } from './engines'
import { illustrativeLabel } from './copy'
import { evScenarioStarted, evDecision, evNudge, evCompleted } from './analytics'
import { nudgesForRun } from './runNudges'
import Journal from './Journal'
import ScenarioContext from './ScenarioContext'
import ScenarioDebrief from './ScenarioDebrief'
import WidgetHost from './genui/WidgetHost'
import {
  WIDGET_COMPONENTS,
  ChartDataProvider,
  ChainDataProvider,
  LegsProvider,
} from './genui/widgets'
import { defaultLayoutFor } from './genui/defaultLayout'
import { summarizeCandles, gradeRunHybrid, type GradeRunResult } from './ai/grade'
import { getGradeFn } from '../services/aiModel'
import type { Candle } from '../data/candles'
import type { ChainSnapshot } from './chain'
import type { BookStats } from './bookStats'
import type { ProcessSignals, ScenarioLayout, WidgetDataRef } from './genui/types'
import type { Decision, Feeling, ScenarioOutcome, ScenarioSpec } from './types'

type Phase = 'setup' | 'journal' | 'resolved'

const PHASES: { key: Phase; label: string }[] = [
  { key: 'setup', label: 'Set up' },
  { key: 'journal', label: 'Reflect' },
  { key: 'resolved', label: 'Result' },
]

/**
 * The interactive layout to render: the LLM-authored `spec.layout` (or the curated
 * default). For charts, drop the standalone `candle-chart` when an interactive chart
 * widget is present — `price-lines`/`annotate-chart` draw their own chart, so keeping
 * both would render two charts (WS-B note).
 */
function prepareLayout(spec: ScenarioSpec): ScenarioLayout {
  const layout = spec.layout && spec.layout.length ? spec.layout : defaultLayoutFor(spec.track)
  if (spec.track === 'charts') {
    const hasInteractiveChart = layout.some((w) => w.kind === 'price-lines' || w.kind === 'annotate-chart')
    if (hasInteractiveChart) return layout.filter((w) => w.kind !== 'candle-chart')
  }
  return layout
}

/** Build display candles for the mid-path chart of a market-making session. */
function midsToCandles(mids: number[]): Candle[] {
  return mids.map((m, i) => {
    const o = i === 0 ? mids[0] : mids[i - 1]
    return { t: i, o, h: Math.max(o, m), l: Math.min(o, m), c: m }
  })
}

/** Wrap a rendered layout in the chart-family data providers, seeded from the loaded data. */
function SetupData({ spec, data, children }: { spec: ScenarioSpec; data: unknown; children: ReactNode }) {
  if (spec.track === 'options') {
    const { snapshot, underlying } = data as { snapshot: ChainSnapshot; underlying: Candle[] }
    return (
      <ChartDataProvider candles={underlying}>
        <ChainDataProvider chain={snapshot}>
          <LegsProvider>{children}</LegsProvider>
        </ChainDataProvider>
      </ChartDataProvider>
    )
  }
  const candles = spec.track === 'market-making' ? midsToCandles((data as BookStats).mids) : (data as Candle[])
  // Pass the spec's dataRef for charts so the chart caption can name the instrument + timeframe.
  // Market-making draws a synthetic mid path (index-based timestamps), so it gets no dataRef.
  const dataRef = spec.track === 'charts' ? (spec.dataRef as WidgetDataRef) : undefined
  return (
    <ChartDataProvider candles={candles} dataRef={dataRef}>
      <LegsProvider>{children}</LegsProvider>
    </ChartDataProvider>
  )
}

/** Compact, citable real-candle summary for the grader (whitelist of numbers it may use). */
function candleSummaryFor(spec: ScenarioSpec, data: unknown) {
  if (spec.track === 'options') return summarizeCandles((data as { underlying: Candle[] }).underlying)
  if (spec.track === 'market-making') return summarizeCandles(midsToCandles((data as BookStats).mids))
  return summarizeCandles(data as Candle[])
}

function PhaseRail({ phase }: { phase: Phase }) {
  const idx = PHASES.findIndex((p) => p.key === phase)
  return (
    <ol className="flex items-center gap-2.5" aria-label="Scenario progress">
      {PHASES.map((p, i) => {
        const done = i < idx
        const current = i === idx
        return (
          <li key={p.key} className="flex items-center gap-2.5">
            <span
              aria-current={current ? 'step' : undefined}
              className="flex items-center gap-2 text-xs font-semibold"
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition-colors ${
                  done
                    ? 'bg-brand-amber text-white'
                    : current
                      ? 'bg-ink text-white'
                      : 'border border-hairline bg-paper text-muted'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={current ? 'text-ink' : done ? 'text-ink-soft' : 'text-muted'}>{p.label}</span>
            </span>
            {i < PHASES.length - 1 && (
              <span aria-hidden className={`h-px w-6 ${i < idx ? 'bg-brand-amber' : 'bg-hairline'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function DebriefSkeleton() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-6" aria-hidden>
      <div className="flex items-center gap-6 rounded-2xl border border-hairline bg-paper p-6">
        <div className="h-32 w-32 rounded-full bg-surface-2" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="h-4 w-24 rounded bg-surface-2" />
          <div className="h-6 w-48 rounded bg-surface-2" />
          <div className="h-3 w-full max-w-sm rounded bg-surface-2" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-32 rounded bg-surface-2" />
            <div className="h-2 w-full rounded-full bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ScenarioPlayer({ spec, data }: { spec: ScenarioSpec; data: unknown }) {
  const navigate = useNavigate()
  const { applyResult, analytics } = usePractice()
  const reduceMotion = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('setup')
  const [journal, setJournal] = useState<{ rationale: string; feeling: Feeling } | null>(null)
  const [outcome, setOutcome] = useState<ScenarioOutcome | null>(null)
  const [grade, setGrade] = useState<GradeRunResult | null>(null)
  const [firedNudges, setFiredNudges] = useState<string[]>([])
  const submitted = useRef<{ decision: Decision; signals: ProcessSignals } | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const engine = getEngine(spec.track)
  const layout = useMemo(() => prepareLayout(spec), [spec])
  const illus = useMemo(() => illustrativeLabel(spec), [spec])

  // Learning analytics: a scenario was presented (keyed on the spec so a new one re-emits).
  useEffect(() => {
    void analytics.emit(
      evScenarioStarted({ specId: spec.id, track: spec.track, tier: spec.tier, source: spec.source }),
    )
  }, [analytics, spec.id, spec.track, spec.tier, spec.source])

  // Move focus onto the result region when it appears (keyboard + screen-reader landing).
  useEffect(() => {
    if (phase === 'resolved') resultRef.current?.focus()
  }, [phase])

  const onLayoutSubmit = (decision: Decision, signals: ProcessSignals) => {
    submitted.current = { decision, signals }
    void analytics.emit(evDecision({ specId: spec.id, track: spec.track, tier: spec.tier }))
    setPhase('journal')
  }

  const onJournal = (entry: { rationale: string; feeling: Feeling }) => {
    if (!submitted.current) return
    const { decision, signals } = submitted.current
    setJournal(entry)

    // EXACT deterministic math — the only source of traded numbers.
    const out = engine.resolve(spec, data, decision)
    setOutcome(out)
    const nudges = nudgesForRun(spec, data, decision, out)
    setFiredNudges(nudges)
    setPhase('resolved')

    // Hybrid process grade (GPT-5.5 when wired; deterministic guardrail + curated otherwise).
    void gradeRunHybrid(
      { spec, decision, outcome: out, candleSummary: candleSummaryFor(spec, data), signals, journal: entry },
      getGradeFn(),
    ).then((result) => {
      if (!alive.current) return
      setGrade(result)
      void analytics.emit(
        evCompleted({
          specId: spec.id, track: spec.track, tier: spec.tier,
          score: result.score.total, pnl: out.pnl, nudgesFired: nudges,
        }),
      )
      for (const id of nudges) void analytics.emit(evNudge({ specId: spec.id, track: spec.track, nudgeId: id }))
    })
  }

  const finish = () => {
    if (!grade || !outcome || !journal || !submitted.current) return
    applyResult({
      specId: spec.id, track: spec.track, tier: spec.tier,
      decision: submitted.current.decision,
      nudgesFired: firedNudges,
      score: grade.score.total,
      breakdown: grade.score.dimensions,
      pnl: outcome.pnl,
      journal,
      createdAt: Date.now(),
    })
    navigate('/practice')
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-ink-soft">
            <span className="capitalize">{spec.track.replace('-', ' ')}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-muted" />
            <span>Tier {spec.tier}</span>
          </span>
          <PhaseRail phase={phase} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold leading-[1.1] text-ink">{spec.title}</h1>
          <p className="max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">{spec.brief}</p>
        </div>
      </header>

      <div aria-live="polite" className="flex w-full flex-col gap-6">
        {phase === 'setup' && (
          <>
            {(spec.track === 'charts' || spec.track === 'market-making') && <ScenarioContext spec={spec} />}
            <SetupData spec={spec} data={data}>
              <WidgetHost
                track={spec.track}
                layout={layout}
                components={WIDGET_COMPONENTS}
                onSubmit={onLayoutSubmit}
                submitLabel="Submit decision"
              />
            </SetupData>
          </>
        )}

        {phase === 'journal' && (
          <div className="flex w-full justify-center">
            <Journal onSubmit={onJournal} />
          </div>
        )}

        {phase === 'resolved' && (
          <div
            ref={resultRef}
            tabIndex={-1}
            aria-label="Scenario result"
            className={`outline-none ${
              reduceMotion ? '' : 'rise-in'
            }`}
          >
            {grade && outcome ? (
              <ScenarioDebrief
                spec={spec}
                score={grade.score}
                feedback={grade.feedback}
                source={grade.source}
                outcome={outcome}
                nudges={firedNudges}
                journal={journal}
                illus={illus}
                reduceMotion={reduceMotion}
                onContinue={finish}
              />
            ) : (
              <DebriefSkeleton />
            )}
          </div>
        )}
      </div>

      {/* Honesty label for any simulated elements ("illustrative; math exact"). */}
      {illus && phase !== 'resolved' && (
        <p className="text-center text-xs font-medium text-muted">{illus}</p>
      )}

      <Disclaimer />
    </div>
  )
}
