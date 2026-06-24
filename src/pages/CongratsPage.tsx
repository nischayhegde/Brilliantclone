import { useNavigate, useParams, Navigate } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { TrophyIcon } from '../components/icons'
import { useLessonProgress } from '../state/LessonProgressContext'
import { getLesson, LESSONS } from '../lessons/registry'

export default function CongratsPage() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const { bestStreak, stats, resetLesson } = useLessonProgress()

  const lesson = lessonId ? getLesson(lessonId) : undefined
  if (!lesson || !lessonId) return <Navigate to="/" replace />

  const s = stats(lessonId)
  const next = LESSONS.find((l) => l.index === lesson.index + 1)

  const restart = () => {
    if (window.confirm(`Restart "${lesson.title}"? This clears your progress for this lesson.`)) {
      resetLesson(lessonId)
      navigate(`/lesson/${lessonId}/1`)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-amber-soft text-brand-amber">
          <TrophyIcon className="h-11 w-11" />
        </span>
        <h1 className="mt-5 font-display text-4xl font-bold leading-tight">Lesson complete.</h1>
        <p className="mt-2 max-w-md text-ink-soft">
          You finished <strong className="font-bold text-ink">{lesson.title}</strong> — {lesson.subtitle}.
        </p>

        <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-4">
          <Card className="text-center">
            <p className="font-display text-3xl font-bold">
              {s.completedCount}/{s.total}
            </p>
            <p className="text-xs font-semibold text-muted">modules complete</p>
          </Card>
          <Card className="text-center">
            <p className="font-display text-3xl font-bold">{bestStreak}</p>
            <p className="text-xs font-semibold text-muted">best streak</p>
          </Card>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {next && (
            <Button onClick={() => navigate(`/lesson/${next.id}/1`)}>Next: {next.title}</Button>
          )}
          <Button variant="secondary" onClick={restart}>
            Restart lesson
          </Button>
          <Button variant={next ? 'ghost' : 'primary'} onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
        </div>
      </main>
    </div>
  )
}
