import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Card from '../components/ui/Card'
import { GoogleIcon, Logo } from '../components/icons'

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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface px-4">
      <div className="mb-8 flex items-center gap-2.5">
        <Logo className="h-9 w-9" />
        <span className="font-display text-2xl font-bold tracking-tight">Trilliant</span>
      </div>
      <Card className="w-full max-w-sm text-center">
        <h1 className="font-display text-2xl font-bold leading-tight">
          Learn to read the markets.
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Charts, the order book, shorting, and options — five hands-on lessons.
        </p>
        <button
          onClick={() => void handleSignIn()}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-hairline bg-paper px-5 py-3 font-semibold text-ink shadow-sm transition duration-200 ease-out hover:-translate-y-px hover:border-ink/20 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GoogleIcon /> Continue with Google
        </button>
        {error ? <p className="mt-4 text-sm font-medium text-brand-red">{error}</p> : null}
      </Card>
      <p className="mt-6 max-w-xs text-center text-xs text-muted">
        Sign in to save your progress and pick up where you left off.
      </p>
    </div>
  )
}
