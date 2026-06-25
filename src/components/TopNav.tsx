import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLessonProgress } from '../state/LessonProgressContext'
import StreakBadge from './StreakBadge'
import { Logo } from './icons'

export default function TopNav() {
  const { user, signOutUser } = useAuth()
  const { bestStreak } = useLessonProgress()

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-xl font-bold tracking-tight">Trilliant</span>
          </Link>
          <Link to="/practice" className="text-sm font-semibold text-ink-soft transition hover:text-ink">
            Practice
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <StreakBadge count={bestStreak} />
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="h-8 w-8 rounded-full ring-2 ring-hairline"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <button
            onClick={() => void signOutUser()}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-muted transition hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
