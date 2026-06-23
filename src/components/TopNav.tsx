import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLessonProgress } from '../state/LessonProgressContext'
import StreakBadge from './StreakBadge'
import { Logo } from './icons'

export default function TopNav() {
  const { user, signOutUser } = useAuth()
  const { bestStreak } = useLessonProgress()

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-xl font-extrabold tracking-tight">Brilliant</span>
        </Link>
        <div className="flex items-center gap-3">
          <StreakBadge count={bestStreak} />
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
          ) : null}
          <button
            onClick={() => void signOutUser()}
            className="text-sm font-semibold text-muted transition hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
