// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// Thin DEV harness: stub navigation, the top nav (auth/streak deps), the practice provider,
// and the grade transport (null → deterministic grade) so it renders fully offline. The
// static scenario registry + engines are REAL — charts curated specs use bundled candles,
// so the player exercises real layout rendering without any network.
const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  nextScenario: vi.fn().mockResolvedValue({ id: 'llm-charts-abc' }),
  primeScenarios: vi.fn(),
  applyResult: vi.fn(),
  emit: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate, useParams: () => ({}) }))
vi.mock('../components/TopNav', () => ({ default: () => <nav data-testid="topnav" /> }))
vi.mock('../services/aiModel', () => ({ getGradeFn: () => null }))
vi.mock('../state/PracticeContext', () => ({
  usePractice: () => ({
    loading: false,
    account: {
      balance: 10000,
      tier: { charts: 1, options: 1, 'market-making': 1 },
      skill: { charts: 10, options: 20, 'market-making': 30 },
      ruinEvents: 0,
    },
    recentRuns: [],
    nextScenario: h.nextScenario,
    primeScenarios: h.primeScenarios,
    pendingRuin: false,
    applyResult: h.applyResult,
    analytics: { emit: h.emit },
  }),
}))

import PracticePreviewPage from './PracticePreviewPage'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PracticePreviewPage (DEV harness)', () => {
  it('renders the DEV switcher and the redesigned hub by default', () => {
    render(<PracticePreviewPage />)
    expect(screen.getByText(/dev preview/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /practice hub/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Charts' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Options' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Market making' })).toBeTruthy()
    // Hub view = the redesigned PracticePage.
    expect(screen.getByRole('heading', { name: 'Practice' })).toBeTruthy()
  })

  it('switches to a track and runs a curated spec through the real ScenarioPlayer', async () => {
    render(<PracticePreviewPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Charts' }))
    // The curated charts spec loads (bundled candles) and renders its layout + submit control.
    expect(await screen.findByRole('button', { name: /submit decision/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /take it or skip it/i })).toBeTruthy()
  })
})
