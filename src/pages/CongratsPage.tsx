import { useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { TrophyIcon } from '../components/icons'
import { useLessonProgress } from '../state/LessonProgressContext'
import { TOTAL_MODULES } from '../domain/progress'

export default function CongratsPage() {
  const navigate = useNavigate()
  const { completedCount, bestStreak } = useLessonProgress()

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
        <TrophyIcon className="text-brand-green" />
        <h1 className="mt-4 text-3xl font-extrabold">Congratulations!</h1>
        <p className="mt-2 max-w-md text-muted">
          You finished <strong>Reading the Charts</strong> — all 12 technical-analysis patterns.
        </p>

        <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-4">
          <Card className="text-center">
            <p className="text-3xl font-extrabold">
              {completedCount}/{TOTAL_MODULES}
            </p>
            <p className="text-xs font-semibold text-muted">modules complete</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-extrabold">{bestStreak}</p>
            <p className="text-xs font-semibold text-muted">best streak</p>
          </Card>
        </div>

        <Button className="mt-8" onClick={() => navigate('/')}>
          Back to dashboard
        </Button>
      </main>
    </div>
  )
}
