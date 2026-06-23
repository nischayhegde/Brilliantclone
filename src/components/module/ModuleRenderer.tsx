import type { LessonModule } from '../../data/lessonManifest'
import TeachPlaceholder from './TeachPlaceholder'
import QuizPlaceholder from './QuizPlaceholder'

interface ModuleRendererProps {
  module: LessonModule
  onComplete: () => void
}

/**
 * SEAM between the lesson flow and a module's body. Today it renders teach/quiz
 * placeholders; in Phase 2 the real Phaser candlestick engine drops in here using
 * the same `onComplete` contract — no routing/progress/Firestore changes needed.
 */
export default function ModuleRenderer({ module, onComplete }: ModuleRendererProps) {
  switch (module.type) {
    case 'teach':
      return <TeachPlaceholder module={module} onComplete={onComplete} />
    case 'quiz':
      return <QuizPlaceholder module={module} onComplete={onComplete} />
    default:
      return null
  }
}
