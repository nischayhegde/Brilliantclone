import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import Spinner from '../components/ui/Spinner'
import ScenarioPlayer from '../practice/ScenarioPlayer'
import { getScenario } from '../practice/scenarioRegistry'
import { getEngine } from '../practice/engines'
import { usePractice } from '../state/PracticeContext'

export default function ScenarioPlayerPage() {
  const { specId } = useParams<{ specId: string }>()
  const navigate = useNavigate()
  const { getComposedScenario } = usePractice()
  // LLM-composed specs live in the provider (not the static registry); fall back to the
  // registry so curated deep-links / refreshes still resolve.
  const spec = specId ? getComposedScenario(specId) ?? getScenario(specId) : undefined
  const [data, setData] = useState<unknown>(null)

  useEffect(() => {
    if (!spec) {
      navigate('/practice', { replace: true })
      return
    }
    let active = true
    getEngine(spec.track)
      .loadData(spec)
      .then((d) => active && setData(d))
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
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {!spec || data === null ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <ScenarioPlayer spec={spec} data={data} />
        )}
      </main>
    </div>
  )
}
