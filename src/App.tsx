import { Routes, Route, Navigate } from 'react-router-dom'
import { LessonProgressProvider } from './state/LessonProgressContext'
import { PracticeProvider } from './state/PracticeContext'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LessonPage from './pages/LessonPage'
import CongratsPage from './pages/CongratsPage'
import PracticePage from './pages/PracticePage'
import ScenarioPlayerPage from './pages/ScenarioPlayerPage'

export default function App() {
  return (
    <LessonProgressProvider>
      <PracticeProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
