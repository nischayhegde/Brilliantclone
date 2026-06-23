import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { FullScreenSpinner } from '../components/ui/Spinner'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  // Wait for session restore before deciding — avoids a /login flash on refresh.
  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
