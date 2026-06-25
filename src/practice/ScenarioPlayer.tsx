import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhaserCanvas from '../engine/PhaserCanvas'
import { SceneBus } from '../engine/bus'
import Button from '../components/ui/Button'
import { resolvePracticeScene } from './scenes'
import { getEngine } from './engines'
import { getRubric } from './rubrics'
import { NUDGES } from './nudges'
import { curatedDebrief } from './debrief'
import { coachDebrief } from './ai/coach'
import { getModelClient } from '../services/aiModel'
import { usePractice } from '../state/PracticeContext'
import Journal from './Journal'
import type { Decision, Feeling, ProcessScore, ScenarioOutcome, ScenarioSpec } from './types'

type Phase = 'setup' | 'journal' | 'resolved'

export default function ScenarioPlayer({ spec, data }: { spec: ScenarioSpec; data: unknown }) {
  const navigate = useNavigate()
  const { applyResult } = usePractice()
  const busRef = useRef<SceneBus>()
  if (!busRef.current) busRef.current = new SceneBus()
  const bus = busRef.current

  const [phase, setPhase] = useState<Phase>('setup')
  const [firedNudges, setFiredNudges] = useState<string[]>([])
  const decisionRef = useRef<Decision | null>(null)
  const [result, setResult] = useState<{ outcome: ScenarioOutcome; score: ProcessScore } | null>(null)
  const [journal, setJournal] = useState<{ rationale: string; feeling: Feeling } | null>(null)
  const [debrief, setDebrief] = useState<string>('')

  // The engine makes the player track-agnostic: it decides which scene to mount, how to
  // shape its params from the loaded data, and how to resolve the decision into an outcome.
  const engine = getEngine(spec.track)
  const scene = resolvePracticeScene(engine.sceneKind)!
  const params = useMemo(() => engine.sceneParams(spec, data), [engine, spec, data])

  const canvas = useMemo(
    () => <PhaserCanvas scene={scene} bus={bus} params={params} />,
    [scene, bus, params],
  )

  // Collect live nudges + the structured decision from the scene.
  useEffect(() => {
    const off = bus.on((e) => {
      if (e.type === 'nudge') setFiredNudges((prev) => (prev.includes(e.id) ? prev : [...prev, e.id]))
      if (e.type === 'decision') {
        decisionRef.current = e.payload as unknown as Decision
        setPhase('journal')
      }
    })
    return off
  }, [bus])

  const onJournal = (entry: { rationale: string; feeling: Feeling }) => {
    setJournal(entry)
    const decision = decisionRef.current as Decision
    const outcome = engine.resolve(spec, data, decision)
    const score = getRubric(spec.rubricId)(spec, decision, outcome)
    setResult({ outcome, score })
    setPhase('resolved')
  }

  const finish = () => {
    if (!result || !journal) return
    const decision = decisionRef.current as Decision
    applyResult({
      specId: spec.id, track: spec.track, tier: spec.tier, decision,
      nudgesFired: firedNudges, score: result.score.total,
      breakdown: result.score.dimensions, pnl: result.score.pnl,
      journal, createdAt: Date.now(),
    })
    navigate('/practice')
  }

  // Debrief is LLM-authored (coach), constrained to whitelisted real facts, with a curated
  // fallback baked in. Falls straight back to curated prose when no model is configured.
  useEffect(() => {
    if (phase !== 'resolved' || !result) return
    const model = getModelClient()
    const allowedFacts = { pnl: result.outcome.pnl, ...result.outcome.facts }
    if (!model) {
      setDebrief(curatedDebrief(spec, decisionRef.current as Decision, result.outcome, result.score, journal ?? undefined))
      return
    }
    let active = true
    coachDebrief(
      {
        spec, decision: decisionRef.current as Decision, outcome: result.outcome, score: result.score,
        nudgesFired: firedNudges, journal: journal ?? undefined, allowedFacts,
      },
      model,
    ).then((r) => { if (active) setDebrief(r.text) })
    return () => { active = false }
  }, [phase, result, spec, firedNudges, journal])

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-4">
      <header className="text-center">
        <span className="rounded-full bg-brand-amber-soft px-3 py-1 text-xs font-bold text-brand-amber-dark">
          {spec.track} · Tier {spec.tier}
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold">{spec.title}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-ink-soft">{spec.brief}</p>
      </header>

      {canvas}

      {/* Live nudges */}
      {phase === 'setup' && firedNudges.length > 0 && (
        <div className="w-full max-w-xl space-y-2">
          {firedNudges.map((id) => (
            <p key={id} role="status" className="rounded-xl bg-brand-amber-soft px-4 py-2 text-sm font-semibold text-brand-amber-dark">
              {NUDGES[id]?.copy}
            </p>
          ))}
        </div>
      )}

      {phase === 'setup' && (
        <Button onClick={() => bus.emit({ type: 'submit' })}>Submit trade</Button>
      )}

      {phase === 'journal' && <Journal onSubmit={onJournal} />}

      {phase === 'resolved' && result && (
        <div className="flex w-full max-w-2xl flex-col items-center gap-3">
          <div className={`rounded-2xl px-5 py-3 text-lg font-bold ${result.score.total >= spec.objective.passScore ? 'bg-brand-green-soft text-brand-green-text' : 'bg-brand-red-soft text-brand-red'}`}>
            Process score {result.score.total}/100 · P&amp;L {result.outcome.pnl >= 0 ? '+' : '−'}${Math.abs(Math.round(result.outcome.pnl))}
          </div>
          {result.outcome.facts.modelEstimate === true && (
            <p className="text-xs font-semibold text-muted">
              Closed early — P&amp;L is a model estimate · IV real. A held-to-expiry P&amp;L is exact.
            </p>
          )}
          <ul className="w-full space-y-1">
            {result.score.dimensions.map((d) => (
              <li key={d.id} className="flex justify-between gap-3 text-sm">
                <span className="font-semibold">{d.label}</span>
                <span className="text-muted">{Math.round(d.score * 100)}% — {d.note}</span>
              </li>
            ))}
          </ul>
          <p className="text-center text-base leading-relaxed text-ink-soft">
            {debrief}
          </p>
          <Button onClick={finish}>Continue</Button>
        </div>
      )}
    </div>
  )
}
