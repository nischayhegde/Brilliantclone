import { useEffect, useMemo, useRef, useState } from 'react'
import { SceneBus } from '../bus'
import PhaserCanvas from '../PhaserCanvas'
import ModuleShell from './ModuleShell'
import Button from '../../components/ui/Button'
import { CheckIcon, CrossIcon } from '../../components/icons'
import type { ModuleSpec, SceneCtor } from '../types'

interface ModuleRendererProps {
  module: ModuleSpec
  scene: SceneCtor
  onComplete: () => void
}

const DEFAULT_CTA: Record<ModuleSpec['type'], string> = {
  intro: 'Got it',
  teach: 'Got it',
  interactive: 'Continue',
  quiz: 'Continue',
  challenge: 'Continue',
  capstone: 'Finish',
}

/**
 * The single seam between lesson flow and a module body. Mounts the module's Phaser
 * scene and renders the right footer for its type:
 *  - quiz       → MCQ answer → reveal → grade → explain
 *  - challenge  → interactive setup → submit → scene-simulated result → explain
 *  - others     → a plain advance button
 */
export default function ModuleRenderer({ module, scene, onComplete }: ModuleRendererProps) {
  const busRef = useRef<SceneBus>()
  if (!busRef.current) busRef.current = new SceneBus()
  const bus = busRef.current

  const canvas = useMemo(
    () => <PhaserCanvas scene={scene} params={module.scene.params} bus={bus} />,
    [scene, module.scene.params, bus],
  )

  const hasQuiz = !!module.quiz && (module.type === 'quiz' || module.type === 'capstone')
  const isChallenge = module.type === 'challenge' && !!module.challenge

  let footer
  if (isChallenge) footer = <ChallengeFooter module={module} bus={bus} onComplete={onComplete} />
  else if (hasQuiz) footer = <QuizFooter module={module} bus={bus} onComplete={onComplete} />
  else footer = <Button onClick={onComplete}>{module.cta ?? DEFAULT_CTA[module.type]}</Button>

  return (
    <ModuleShell
      kicker={module.kicker}
      title={module.title}
      intro={module.intro}
      caption={module.caption}
      canvas={canvas}
      footer={footer}
    />
  )
}

function ResultBanner({ correct, title }: { correct: boolean; title: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-2xl px-4 py-3 font-bold ${
        correct ? 'bg-brand-green-soft text-brand-green-text' : 'bg-brand-red-soft text-brand-red'
      }`}
    >
      {correct ? <CheckIcon /> : <CrossIcon />}
      {title}
    </div>
  )
}

function ChallengeFooter({
  module,
  bus,
  onComplete,
}: {
  module: ModuleSpec
  bus: SceneBus
  onComplete: () => void
}) {
  const challenge = module.challenge!
  const [phase, setPhase] = useState<'setup' | 'awaiting' | 'done'>('setup')
  const [result, setResult] = useState<{ correct: boolean; title: string; detail: string } | null>(
    null,
  )
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const doneRef = useRef<HTMLDivElement>(null)

  // Submit is ALWAYS reachable. A challenge must never trap the learner behind a
  // disabled button — every submit leads to a verdict + explanation + Continue,
  // whether they were right or wrong. Scenes may still emit `canSubmit` as a hint,
  // but it no longer gates the button (some scenes never re-enable it).
  useEffect(() => {
    const off = bus.on((e) => {
      if (e.type === 'result') {
        if (timer.current) clearTimeout(timer.current)
        setResult({ correct: e.correct, title: e.title, detail: e.detail })
        setPhase('done')
      }
    })
    return () => {
      off()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [bus])

  // When the verdict resolves, the verdict + Continue render below a tall chart and
  // can land off-screen. Pull them into view so the learner always sees that they
  // pass (whether right or wrong) and can advance.
  useEffect(() => {
    if (phase === 'done') doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [phase])

  const submit = () => {
    // Move to "awaiting" and arm the safety net BEFORE emitting, so even if the scene's
    // submit handler throws, the learner still reaches a Continue button (challenges must
    // always be passable). The bus already isolates handler errors, but this is belt-and-braces.
    setPhase('awaiting')
    // Safety net: the learner must ALWAYS reach a Continue button, even if a scene
    // finishes its animation without reporting a result.
    timer.current = setTimeout(() => setPhase('done'), 5000)
    try {
      bus.emit({ type: 'submit' })
    } catch {
      if (timer.current) clearTimeout(timer.current)
      setPhase('done')
    }
  }

  // Resolved: show an unambiguous green/red verdict + the scene's outcome, and a
  // Continue button that is always present.
  if (phase === 'done') {
    return (
      <div ref={doneRef} className="flex w-full scroll-mt-6 flex-col items-center gap-3">
        {result ? (
          <>
            <ResultBanner correct={result.correct} title={result.correct ? 'Correct' : 'Not quite'} />
            {result.title && <p className="max-w-xl text-center text-lg font-bold text-ink">{result.title}</p>}
            <p className="max-w-2xl text-center text-base leading-relaxed text-ink-soft">{result.detail}</p>
          </>
        ) : (
          <p className="max-w-2xl text-center text-base leading-relaxed text-ink-soft">
            See how it resolved on the chart above, then continue.
          </p>
        )}
        {result && !result.correct && (
          <p className="max-w-xl text-center text-sm font-semibold text-muted">
            No worries — review the explanation, then continue.
          </p>
        )}
        <Button onClick={onComplete}>Continue</Button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="max-w-xl text-center text-lg font-semibold">{challenge.prompt}</p>
      {challenge.instructions && (
        <p className="max-w-2xl text-center text-base leading-relaxed text-ink-soft">{challenge.instructions}</p>
      )}
      <Button disabled={phase === 'awaiting'} onClick={submit}>
        {phase === 'awaiting' ? 'Revealing…' : (challenge.submitLabel ?? 'Submit')}
      </Button>
    </div>
  )
}

function QuizFooter({
  module,
  bus,
  onComplete,
}: {
  module: ModuleSpec
  bus: SceneBus
  onComplete: () => void
}) {
  const quiz = module.quiz!
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const doneRef = useRef<HTMLDivElement>(null)

  const isRight = selected === quiz.correctId

  const onCheck = () => {
    if (selected === null) return
    bus.emit({ type: 'reveal' })
    setRevealed(true)
  }

  useEffect(() => {
    if (revealed) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [revealed])

  if (!revealed) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <p className="max-w-xl text-center text-lg font-semibold">{quiz.prompt}</p>
        <div role="group" aria-label="Your answer" className="flex flex-wrap justify-center gap-2">
          {quiz.options.map((o) => (
            <button
              key={o.id}
              aria-pressed={selected === o.id}
              onClick={() => setSelected(o.id)}
              className={`min-w-28 rounded-xl border-2 px-5 py-3 text-sm font-bold transition duration-150 ${
                selected === o.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-hairline bg-paper text-ink hover:border-ink/40 hover:bg-surface'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Button disabled={selected === null} onClick={onCheck}>
          {module.cta ?? 'Check'}
        </Button>
      </div>
    )
  }

  return (
    <div ref={doneRef} className="flex w-full scroll-mt-6 flex-col items-center gap-3">
      <ResultBanner correct={isRight} title={isRight ? 'Correct!' : 'Not quite.'} />
      <p className="max-w-2xl text-center text-base leading-relaxed text-ink-soft">
        {isRight ? quiz.explainRight : quiz.explainWrong}
      </p>
      {!isRight && (
        <p className="max-w-xl text-center text-sm font-semibold text-muted">
          No worries — review the explanation, then continue.
        </p>
      )}
      <Button onClick={onComplete}>{module.type === 'capstone' ? 'Finish' : 'Continue'}</Button>
    </div>
  )
}
