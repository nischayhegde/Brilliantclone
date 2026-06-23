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
    <div className="min-h-screen bg-white">
      <TopNav />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
        <TrophyIcon className="text-brand-green" />
        <h1 className="mt-4 text-3xl font-extrabold">Congratulations!</h1>
        <p className="mt-2 max-w-md text-muted">
          You finished <strong>{lesson.title}</strong> — {lesson.subtitle}.
        </p>

        <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-4">
          <Card className="text-center">
            <p className="text-3xl font-extrabold">
              {s.completedCount}/{s.total}
            </p>
            <p className="text-xs font-semibold text-muted">modules complete</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-extrabold">{bestStreak}</p>
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
