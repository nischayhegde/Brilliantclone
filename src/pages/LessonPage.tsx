import { useNavigate, useParams, Navigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'
import ModuleRenderer from '../components/module/ModuleRenderer'
import Spinner from '../components/ui/Spinner'
import { useLessonProgress } from '../state/LessonProgressContext'
import { getModule } from '../data/lessonManifest'
import { TOTAL_MODULES } from '../domain/progress'

export default function LessonPage() {
  const { moduleId } = useParams()
  const navigate = useNavigate()
  const { loading, completedCount, resumeModuleId, isComplete, completeModule } =
    useLessonProgress()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const requested = Number(moduleId)

  // A finished user landing on an out-of-range module (e.g. the resume sentinel 25)
  // goes to the congrats screen, matching the dashboard's behaviour.
  if (isComplete && Number.isFinite(requested) && requested > TOTAL_MODULES) {
    return <Navigate to="/congrats" replace />
  }

  // Clamp to a valid, unlocked module: 1..24 and no skipping past the next one.
  // Floor first so a plausible fractional URL (/lesson/3.5) lands on module 3, not 1.
  const maxAllowed = Math.min(resumeModuleId, TOTAL_MODULES)
  const parsed = Math.floor(requested)
  const id = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maxAllowed) : 1

  // Keep the URL honest if it pointed somewhere invalid / locked.
  if (requested !== id) return <Navigate to={`/lesson/${id}`} replace />

  const module = getModule(id)
  if (!module) return <Navigate to="/" replace />

  const handleComplete = () => {
    completeModule(id)
    if (id >= TOTAL_MODULES) navigate('/congrats')
    else navigate(`/lesson/${id + 1}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b border-hairline px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <ProgressBar
            total={TOTAL_MODULES}
            completedCount={completedCount}
            currentIndex={id}
            onClose={() => navigate('/')}
          />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-10">
        <ModuleRenderer key={id} module={module} onComplete={handleComplete} />
      </main>
    </div>
  )
}
