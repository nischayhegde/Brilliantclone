import { useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Card from '../components/ui/Card'
import LessonCard from '../components/LessonCard'
import Spinner from '../components/ui/Spinner'
import { FlameIcon } from '../components/icons'
import { useLessonProgress } from '../state/LessonProgressContext'
import { TOTAL_MODULES } from '../domain/progress'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { loading, completedCount, bestStreak, resumeModuleId, isComplete } = useLessonProgress()

  const onStart = () => {
    if (isComplete) navigate('/congrats')
    else navigate(`/lesson/${Math.min(resumeModuleId, TOTAL_MODULES)}`)
  }

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
                <p className="text-sm font-bold">Your progress</p>
                <p className="mt-1 text-3xl font-extrabold">
                  {completedCount}
                  <span className="text-lg text-muted"> / {TOTAL_MODULES}</span>
                </p>
                <p className="text-xs font-semibold text-muted">modules complete</p>
              </Card>
            </aside>

            <section className="order-1 md:order-none">
              <LessonCard
                completedCount={completedCount}
                isComplete={isComplete}
                onStart={onStart}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
