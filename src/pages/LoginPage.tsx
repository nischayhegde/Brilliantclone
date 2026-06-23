import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Card from '../components/ui/Card'
import { GoogleIcon, Logo } from '../components/icons'
import { LESSON_TITLE } from '../data/lessonManifest'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const handleSignIn = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Google sign-in isn’t enabled yet. Enable it in the Firebase console: Authentication → Sign-in method → Google.',
        )
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError(null)
      } else {
        setError('Could not sign in. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="mb-8 flex items-center gap-2">
        <Logo className="h-9 w-9" />
        <span className="text-2xl font-extrabold tracking-tight">Brilliant</span>
      </div>
      <Card className="w-full max-w-sm text-center">
        <h1 className="text-xl font-extrabold">Learn to read the charts</h1>
        <p className="mt-2 text-sm text-muted">{LESSON_TITLE}</p>
        <button
          onClick={() => void handleSignIn()}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-hairline bg-white px-5 py-3 font-semibold text-ink transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GoogleIcon /> Continue with Google
        </button>
        {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}
      </Card>
      <p className="mt-6 max-w-xs text-center text-xs text-muted">
        Sign in to save your progress and pick up where you left off.
      </p>
    </div>
  )
}
