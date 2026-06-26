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
          <Link
            to="/practice"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-amber-soft px-3.5 py-1.5 text-sm font-bold text-brand-amber-ink transition duration-200 ease-out hover:bg-brand-amber-dark hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber/40"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
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
