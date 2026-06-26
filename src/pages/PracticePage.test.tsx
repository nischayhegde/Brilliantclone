// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// Stub navigation, the top nav (auth/streak deps), and the practice provider so the page
// renders offline. The static scenario registry is real (curated specs make tracks playable).
const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  nextScenario: vi.fn().mockResolvedValue({ id: 'llm-charts-abc' }),
  primeScenarios: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate, useParams: () => ({}) }))
vi.mock('../components/TopNav', () => ({ default: () => <nav data-testid="topnav" /> }))
vi.mock('../state/PracticeContext', () => ({
  usePractice: () => ({
    loading: false,
    account: {
      balance: 10000,
      tier: { charts: 2, options: 1, 'market-making': 1 },
      skill: { charts: 25, options: 5, 'market-making': 40 },
      ruinEvents: 0,
    },
    recentRuns: [],
    nextScenario: h.nextScenario,
    primeScenarios: h.primeScenarios,
    pendingRuin: false,
  }),
}))

import PracticePage from './PracticePage'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PracticePage', () => {
  it('renders the track list with balance + skill state and a recommendation', () => {
    render(<PracticePage />)
    expect(screen.getByRole('heading', { name: 'Practice' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Chart patterns' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Options' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Market making' })).toBeTruthy()
    expect(screen.getByText('$10,000')).toBeTruthy()
    // The lowest-skill playable track (options here) is flagged "Start here".
    expect(screen.getByText(/start here/i)).toBeTruthy()
  })

  it('starts a scenario and routes to the player', async () => {
    render(<PracticePage />)
    const startButtons = screen.getAllByRole('button', { name: /start scenario/i })
    expect(startButtons.length).toBeGreaterThan(0)
    fireEvent.click(startButtons[0])
    expect(h.nextScenario).toHaveBeenCalled()
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/practice/play/llm-charts-abc'))
  })
})
