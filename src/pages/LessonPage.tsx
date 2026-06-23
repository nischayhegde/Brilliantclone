import { useNavigate, useParams, Navigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'
import ModuleRenderer from '../engine/modules/ModuleRenderer'
import Spinner from '../components/ui/Spinner'
import { useLessonProgress } from '../state/LessonProgressContext'
import { getLesson, getModule, resolveScene } from '../lessons/registry'

export default function LessonPage() {
  const { lessonId, moduleId } = useParams()
  const navigate = useNavigate()
  const { loading, stats, completeModule } = useLessonProgress()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const lesson = lessonId ? getLesson(lessonId) : undefined
  if (!lesson || !lessonId) return <Navigate to="/" replace />

  const total = lesson.modules.length
  const s = stats(lessonId)
  const requested = Number(moduleId)

  // A finished user landing past the last module goes to the congrats screen.
  if (s.isComplete && Number.isFinite(requested) && requested > total) {
    return <Navigate to={`/congrats/${lessonId}`} replace />
  }

  // Clamp to a valid, unlocked module (no skipping past the next one).
  const maxAllowed = Math.min(s.resumeModuleId, total)
  const parsed = Math.floor(requested)
  const id = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maxAllowed) : 1
  if (requested !== id) return <Navigate to={`/lesson/${lessonId}/${id}`} replace />

  const module = getModule(lessonId, id)
  if (!module) return <Navigate to="/" replace />
  const scene = resolveScene(lessonId, module.scene.kind)
  if (!scene) return <Navigate to="/" replace />

  const handleComplete = () => {
    completeModule(lessonId, id)
    if (id >= total) navigate(`/congrats/${lessonId}`)
    else navigate(`/lesson/${lessonId}/${id + 1}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b border-hairline px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <ProgressBar
            total={total}
            completedCount={s.completedCount}
            currentIndex={id}
            maxUnlocked={maxAllowed}
            onClose={() => navigate('/')}
            onBack={id > 1 ? () => navigate(`/lesson/${lessonId}/${id - 1}`) : undefined}
            onJump={(i) => navigate(`/lesson/${lessonId}/${i}`)}
          />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-8">
        <ModuleRenderer key={`${lessonId}:${id}`} module={module} scene={scene} onComplete={handleComplete} />
      </main>
    </div>
  )
}
