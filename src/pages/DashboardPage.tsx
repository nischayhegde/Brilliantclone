import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { warmLlmEndpoint } from '../services/aiModel'
import LessonCard from '../components/LessonCard'
import Spinner from '../components/ui/Spinner'
import { FlameIcon, TrophyIcon } from '../components/icons'
import { useLessonProgress, type LessonStats } from '../state/LessonProgressContext'
import { LESSONS } from '../lessons/registry'
import type { LessonSpec } from '../engine/types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { loading, bestStreak, stats, resetLesson } = useLessonProgress()

  // Pre-warm the Render LLM dyno on arrival so it's awake by the time the learner heads to
  // Practice — the cold start overlaps with reading the dashboard instead of blocking a click.
  useEffect(() => {
    warmLlmEndpoint()
  }, [])

  const start = (lessonId: string) => {
    const s = stats(lessonId)
    if (s.isComplete) navigate(`/congrats/${lessonId}`)
    else navigate(`/lesson/${lessonId}/${Math.min(s.resumeModuleId, s.total)}`)
  }

  const restart = (lessonId: string, title: string) => {
    if (window.confirm(`Restart "${title}"? This clears your progress for this lesson.`)) {
      resetLesson(lessonId)
    }
  }

  const withStats = LESSONS.map((lesson) => ({ lesson, s: stats(lesson.id) }))
  const totals = withStats.reduce(
    (acc, { s }) => ({ done: acc.done + s.completedCount, total: acc.total + s.total }),
    { done: 0, total: 0 },
  )
  const overallPct = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0

  // The one lesson to feature: in-progress first, else the first untouched, else none.
  const active =
    withStats.find((x) => x.s.completedCount > 0 && !x.s.isComplete) ??
    withStats.find((x) => x.s.completedCount === 0) ??
    null

  const grid = active ? withStats.filter((x) => x.lesson.id !== active.lesson.id) : withStats

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-12">
        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <>
            <header className="rise-in flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-5xl">
                  Read the markets.
                </h1>
                <p className="mt-3 text-base text-ink-soft">
                  The order book, charts, shorting, and options — five hands-on lessons, built on
                  real data.
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <div className="flex items-center gap-2 sm:justify-end">
                  <FlameIcon className={bestStreak > 0 ? 'text-brand-amber' : 'text-hairline'} />
                  <span className="text-sm font-semibold text-muted">
                    Best streak <span className="font-bold text-ink">{bestStreak}</span>
                  </span>
                </div>
                <div className="mt-3 sm:w-56">
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs font-semibold text-muted">
                    <span>
                      <span className="text-base font-bold text-ink">{totals.done}</span> / {totals.total} modules
                    </span>
                    <span>{overallPct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-ink transition-all duration-500"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </header>

            <div className="rise-in mt-8" style={{ animationDelay: '60ms' }}>
              {active ? (
                <FeaturedLesson
                  lesson={active.lesson}
                  stats={active.s}
                  onStart={() => start(active.lesson.id)}
                />
              ) : (
                <AllDoneHero onReview={() => navigate(`/lesson/${LESSONS[0].id}/1`)} />
              )}
            </div>

            <section className="mt-10">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-muted">
                {active ? 'All lessons' : 'Your lessons'}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {grid.map(({ lesson, s }, i) => (
                  <div key={lesson.id} className="rise-in" style={{ animationDelay: `${120 + i * 60}ms` }}>
                    <LessonCard
                      lesson={lesson}
                      stats={s}
                      onStart={() => start(lesson.id)}
                      onRestart={() => restart(lesson.id, lesson.title)}
                    />
                  </div>
                ))}
              </div>
            </section>

            <div className="rise-in mt-12" style={{ animationDelay: '240ms' }}>
              <PracticeCTA />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function PracticeCTA() {
  const tracks = ['Charts', 'Options', 'Market making']

  return (
    <Link
      to="/practice"
      aria-label="Go to practice — trade real historical setups"
      onMouseEnter={warmLlmEndpoint}
      onFocus={warmLlmEndpoint}
      className="group relative block overflow-hidden rounded-3xl bg-brand-amber px-6 py-8 text-ink shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/45 sm:px-9 sm:py-10"
    >
      <CandleMotif className="pointer-events-none absolute -right-4 -top-2 hidden h-44 w-72 text-ink/[0.08] transition-transform duration-500 ease-out group-hover:translate-x-1 sm:block" />
      <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-1.5">
            {tracks.map((t) => (
              <span
                key={t}
                className="rounded-full bg-ink/[0.08] px-2.5 py-0.5 text-xs font-bold text-ink"
              >
                {t}
              </span>
            ))}
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.04] sm:text-[2.5rem]">
            Put your read to the test.
          </h2>
          <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-ink">
            Trade real historical setups. You&rsquo;re graded on process — your plan, your risk, your
            discipline — never on luck.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2.5 self-start rounded-2xl bg-ink px-7 py-4 text-base font-bold text-white shadow-md transition duration-200 ease-out group-hover:bg-black group-hover:shadow-lg sm:self-auto sm:text-lg">
          Start practicing
          <span
            aria-hidden="true"
            className="transition-transform duration-200 ease-out group-hover:translate-x-1"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  )
}

function FeaturedLesson({
  lesson,
  stats,
  onStart,
}: {
  lesson: LessonSpec
  stats: LessonStats
  onStart: () => void
}) {
  const started = stats.completedCount > 0
  const pct = stats.total > 0 ? Math.round((stats.completedCount / stats.total) * 100) : 0
  const num = String(lesson.index).padStart(2, '0')

  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-9">
      <CandleMotif className="pointer-events-none absolute -right-6 -top-4 hidden h-44 w-72 text-white/[0.07] sm:block" />
      <div className="relative max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-amber">
          {started ? 'Pick up where you left off' : 'Start here'}
        </p>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-3xl font-bold text-white/40">{num}</span>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{lesson.title}</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{lesson.blurb}</p>

        {started && (
          <div className="mt-6 max-w-sm">
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-white/60">
              <span>
                {stats.completedCount} / {stats.total} modules
              </span>
              <span className="text-brand-amber">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-brand-amber transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onStart}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-ink shadow-sm transition duration-200 ease-out hover:-translate-y-px hover:bg-brand-amber-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/40 active:scale-[0.98]"
        >
          {started ? 'Resume lesson' : 'Begin lesson'}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  )
}

function AllDoneHero({ onReview }: { onReview: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-9">
      <CandleMotif className="pointer-events-none absolute -right-6 -top-4 hidden h-44 w-72 text-white/[0.07] sm:block" />
      <div className="relative flex items-center gap-5">
        <span className="text-brand-amber">
          <TrophyIcon className="h-12 w-12" />
        </span>
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight">All five lessons, done.</h2>
          <p className="mt-1 text-sm text-white/70">
            You&rsquo;ve worked through every module. Revisit any lesson to sharpen your read.
          </p>
        </div>
      </div>
      <button
        onClick={onReview}
        className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-ink shadow-sm transition duration-200 ease-out hover:-translate-y-px hover:bg-brand-amber-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/40 active:scale-[0.98]"
      >
        Review from the top <span aria-hidden="true">→</span>
      </button>
    </section>
  )
}

function CandleMotif({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 120" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <line x1="20" y1="20" x2="20" y2="96" />
        <line x1="60" y1="34" x2="60" y2="108" />
        <line x1="100" y1="12" x2="100" y2="92" />
        <line x1="140" y1="40" x2="140" y2="104" />
        <line x1="180" y1="24" x2="180" y2="88" />
        <line x1="220" y1="8" x2="220" y2="76" />
      </g>
      <g fill="currentColor">
        <rect x="11" y="36" width="18" height="44" rx="3" />
        <rect x="51" y="52" width="18" height="38" rx="3" />
        <rect x="91" y="28" width="18" height="46" rx="3" />
        <rect x="131" y="56" width="18" height="36" rx="3" />
        <rect x="171" y="40" width="18" height="34" rx="3" />
        <rect x="211" y="22" width="18" height="40" rx="3" />
      </g>
    </svg>
  )
}
