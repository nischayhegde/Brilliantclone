import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Spinner from '../components/ui/Spinner'
import ScenarioPlayer from '../practice/ScenarioPlayer'
import { getScenario } from '../practice/scenarioRegistry'
import { loadCandles } from '../practice/corpus'
import type { Candle } from '../data/candles'

export default function ScenarioPlayerPage() {
  const { specId } = useParams<{ specId: string }>()
  const navigate = useNavigate()
  const spec = specId ? getScenario(specId) : undefined
  const [candles, setCandles] = useState<Candle[] | null>(null)

  useEffect(() => {
    if (!spec) {
      navigate('/practice', { replace: true })
      return
    }
    let active = true
    loadCandles(spec.dataRef)
      .then((c) => active && setCandles(c))
      .catch((e) => {
        console.error('Failed to load scenario data', e)
        if (active) navigate('/practice', { replace: true })
      })
    return () => {
      active = false
    }
  }, [spec, navigate])

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="mx-auto flex max-w-5xl justify-center px-4 py-10">
        {!spec || !candles ? <Spinner className="h-8 w-8" /> : <ScenarioPlayer spec={spec} candles={candles} />}
      </main>
    </div>
  )
}
