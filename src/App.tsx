import { Routes, Route, Navigate } from 'react-router-dom'
import { LessonProgressProvider } from './state/LessonProgressContext'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LessonPage from './pages/LessonPage'
import CongratsPage from './pages/CongratsPage'
import DevSandbox from './pages/DevSandbox'

export default function App() {
  return (
    <LessonProgressProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dev/:lessonId/:moduleId" element={<DevSandbox />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/lesson/:lessonId/:moduleId" element={<LessonPage />} />
          <Route path="/congrats/:lessonId" element={<CongratsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LessonProgressProvider>
  )
}
