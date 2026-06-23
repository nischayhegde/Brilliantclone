import { useMemo, useRef, useState } from 'react'
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
  capstone: 'Finish',
}

/**
 * The single seam between lesson flow and a module body. Mounts the module's Phaser
 * scene and renders the right footer for its type. Quiz/capstone run the
 * answer -> reveal -> grade -> explain flow, driving the scene via the bus.
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

  return (
    <ModuleShell
      kicker={module.kicker}
      title={module.title}
      intro={module.intro}
      caption={module.caption}
      canvas={canvas}
      footer={
        hasQuiz ? (
          <QuizFooter module={module} bus={bus} onComplete={onComplete} />
        ) : (
          <Button onClick={onComplete}>{module.cta ?? DEFAULT_CTA[module.type]}</Button>
        )
      }
    />
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

  const isRight = selected === quiz.correctId

  const onCheck = () => {
    if (selected === null) return
    bus.emit({ type: 'reveal' })
    setRevealed(true)
  }

  if (!revealed) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <p className="max-w-xl text-center font-semibold">{quiz.prompt}</p>
        <div role="group" aria-label="Your answer" className="flex flex-wrap justify-center gap-2">
          {quiz.options.map((o) => (
            <button
              key={o.id}
              aria-pressed={selected === o.id}
              onClick={() => setSelected(o.id)}
              className={`min-w-28 rounded-2xl border-2 px-5 py-3 text-sm font-bold transition ${
                selected === o.id
                  ? 'border-brand-blue bg-brand-blue-soft text-brand-blue'
                  : 'border-hairline bg-white text-ink hover:border-brand-blue/40'
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
    <div className="flex w-full flex-col items-center gap-3">
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 rounded-2xl px-4 py-3 font-bold ${
          isRight ? 'bg-brand-green-soft text-brand-green' : 'bg-red-50 text-brand-red'
        }`}
      >
        {isRight ? <CheckIcon /> : <CrossIcon />}
        {isRight ? 'Correct!' : 'Not quite.'}
      </div>
      <p className="max-w-xl text-center text-sm text-muted">
        {isRight ? quiz.explainRight : quiz.explainWrong}
      </p>
      <Button onClick={onComplete}>{module.type === 'capstone' ? 'Finish' : 'Continue'}</Button>
    </div>
  )
}
