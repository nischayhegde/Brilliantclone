import { useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Card from '../components/ui/Card'
import LessonCard from '../components/LessonCard'
import Spinner from '../components/ui/Spinner'
import { FlameIcon } from '../components/icons'
import { useLessonProgress } from '../state/LessonProgressContext'
import { LESSONS } from '../lessons/registry'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { loading, bestStreak, stats, resetLesson } = useLessonProgress()

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

  const totals = LESSONS.reduce(
    (acc, l) => {
      const s = stats(l.id)
      acc.done += s.completedCount
      acc.total += s.total
      return acc
    },
    { done: 0, total: 0 },
  )

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <aside className="order-2 flex flex-col gap-4 md:order-none">
              <Card>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green-soft">
                    <FlameIcon className="text-brand-green" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold leading-none">{bestStreak}</p>
                    <p className="text-xs font-semibold text-muted">best streak</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted">
                  Your record for most modules completed in one sitting. Keep going to beat it.
                </p>
              </Card>
              <Card>
                <p className="text-sm font-bold">Overall progress</p>
                <p className="mt-1 text-3xl font-extrabold">
                  {totals.done}
                  <span className="text-lg text-muted"> / {totals.total}</span>
                </p>
                <p className="text-xs font-semibold text-muted">modules across {LESSONS.length} lessons</p>
              </Card>
            </aside>

            <section className="order-1 md:order-none">
              <h1 className="mb-4 text-2xl font-extrabold">Your lessons</h1>
              <div className="grid gap-4 sm:grid-cols-2">
                {LESSONS.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    stats={stats(lesson.id)}
                    onStart={() => start(lesson.id)}
                    onRestart={() => restart(lesson.id, lesson.title)}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
