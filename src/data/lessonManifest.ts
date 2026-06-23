/**
 * Structural metadata ONLY for the single MVP lesson — NO chart data, annotation
 * levels, question text, or explanations (those are deferred to the content phase).
 * This is just enough to drive navigation, the progress bar, and placeholder quiz
 * grading. Source: LESSON_PLAN.md §6 index table (7 completes, 5 fakeouts).
 */

export type ModuleType = 'teach' | 'quiz'

export type PatternFamily =
  | 'bullish-continuation'
  | 'bearish-continuation'
  | 'bearish-reversal'
  | 'bullish-reversal'

export interface LessonModule {
  id: number // 1..24 (odd = teach, even = quiz)
  pairIndex: number // 1..12
  family: PatternFamily
  patternName: string
  ticker: string
  type: ModuleType
  /** Quizzes only: true = pattern "completes"/breaks as expected; false = fakeout. */
  correctAnswer?: boolean
}

export const LESSON_TITLE = 'Reading the Charts: 12 Technical Analysis Patterns'

interface PairSpec {
  pairIndex: number
  family: PatternFamily
  patternName: string
  teachTicker: string
  quizTicker: string
  quizCompletes: boolean
}

const PAIRS: PairSpec[] = [
  { pairIndex: 1, family: 'bullish-continuation', patternName: 'Bull Flag', teachTicker: 'NVDA', quizTicker: 'PLTR', quizCompletes: true },
  { pairIndex: 2, family: 'bullish-continuation', patternName: 'Cup with Handle', teachTicker: 'AMD', quizTicker: 'DIS', quizCompletes: false },
  { pairIndex: 3, family: 'bullish-continuation', patternName: 'Ascending Triangle', teachTicker: 'MSFT', quizTicker: 'AMD', quizCompletes: true },
  { pairIndex: 4, family: 'bearish-continuation', patternName: 'Bear Flag', teachTicker: 'NFLX', quizTicker: 'TSLA', quizCompletes: false },
  { pairIndex: 5, family: 'bearish-continuation', patternName: 'Inverted Cup with Handle', teachTicker: 'ROKU', quizTicker: 'PYPL', quizCompletes: true },
  { pairIndex: 6, family: 'bearish-continuation', patternName: 'Descending Triangle', teachTicker: 'TSLA', quizTicker: 'GE', quizCompletes: false },
  { pairIndex: 7, family: 'bearish-reversal', patternName: 'Double Top', teachTicker: 'TSLA', quizTicker: 'NFLX', quizCompletes: true },
  { pairIndex: 8, family: 'bearish-reversal', patternName: 'Head and Shoulders', teachTicker: 'DIS', quizTicker: 'META', quizCompletes: false },
  { pairIndex: 9, family: 'bearish-reversal', patternName: 'Triple Top', teachTicker: 'NFLX', quizTicker: 'BABA', quizCompletes: true },
  { pairIndex: 10, family: 'bullish-reversal', patternName: 'Double Bottom', teachTicker: 'NFLX', quizTicker: 'SNAP', quizCompletes: false },
  { pairIndex: 11, family: 'bullish-reversal', patternName: 'Inverted Head and Shoulders', teachTicker: 'META', quizTicker: 'NVDA', quizCompletes: true },
  { pairIndex: 12, family: 'bullish-reversal', patternName: 'Triple Bottom', teachTicker: 'BAC', quizTicker: 'DIS', quizCompletes: true },
]

export const lessonManifest: LessonModule[] = PAIRS.flatMap((p) => {
  const teach: LessonModule = {
    id: p.pairIndex * 2 - 1,
    pairIndex: p.pairIndex,
    family: p.family,
    patternName: p.patternName,
    ticker: p.teachTicker,
    type: 'teach',
  }
  const quiz: LessonModule = {
    id: p.pairIndex * 2,
    pairIndex: p.pairIndex,
    family: p.family,
    patternName: p.patternName,
    ticker: p.quizTicker,
    type: 'quiz',
    correctAnswer: p.quizCompletes,
  }
  return [teach, quiz]
})

export function getModule(id: number): LessonModule | undefined {
  return lessonManifest.find((m) => m.id === id)
}
