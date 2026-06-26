import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LessonProgressProvider } from './state/LessonProgressContext'
import { PracticeProvider } from './state/PracticeContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { FullScreenSpinner } from './components/ui/Spinner'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LessonPage from './pages/LessonPage'
import CongratsPage from './pages/CongratsPage'
import PracticePage from './pages/PracticePage'
import ScenarioPlayerPage from './pages/ScenarioPlayerPage'

/**
 * DEV-ONLY visual-verification harness. Lazily imported behind a static
 * `import.meta.env.DEV` check so the production build evaluates this to `null`,
 * tree-shakes the dynamic import away, and never emits the preview chunk or registers
 * the `/preview` route. It must NEVER weaken the real auth-gated routes below.
 */
const PracticePreviewPage = import.meta.env.DEV
  ? lazy(() => import('./pages/PracticePreviewPage'))
  : null

const LessonPreviewPage = import.meta.env.DEV
  ? lazy(() => import('./pages/LessonPreviewPage'))
  : null

export default function App() {
  return (
    <LessonProgressProvider>
      <PracticeProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {import.meta.env.DEV && PracticePreviewPage && (
            <Route
              path="/preview"
              element={
                <Suspense fallback={<FullScreenSpinner />}>
                  <PracticePreviewPage />
                </Suspense>
              }
            />
          )}
          {import.meta.env.DEV && LessonPreviewPage && (
            <Route
              path="/preview-lesson"
              element={
                <Suspense fallback={<FullScreenSpinner />}>
                  <LessonPreviewPage />
                </Suspense>
              }
            />
          )}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/lesson/:lessonId/:moduleId" element={<LessonPage />} />
            <Route path="/congrats/:lessonId" element={<CongratsPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/practice/play/:specId" element={<ScenarioPlayerPage />} />
            <Route path="/practice/:track" element={<PracticePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PracticeProvider>
    </LessonProgressProvider>
  )
}
