// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Candle } from '../data/candles'
import type { ScenarioSpec } from './types'

// Keep the smoke test fully offline: stub navigation, the practice provider, and the
// grade transport (null → deterministic grade, no network / no firebase import).
const h = vi.hoisted(() => ({ navigate: vi.fn(), applyResult: vi.fn(), emit: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }))
vi.mock('../state/PracticeContext', () => ({
  usePractice: () => ({ applyResult: h.applyResult, analytics: { emit: h.emit } }),
}))
vi.mock('../services/aiModel', () => ({ getGradeFn: () => null }))

import ScenarioPlayer from './ScenarioPlayer'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const candles: Candle[] = Array.from({ length: 8 }, (_, i) => {
  const base = 100 + i
  return { t: i, o: base, h: base + 1, l: base - 1, c: base + (i % 2 ? -0.4 : 0.4) }
})

const spec: ScenarioSpec = {
  id: 'test-charts',
  track: 'charts',
  tier: 2,
  title: 'Breakout retest',
  brief: 'Price pulled back to the breakout level.',
  dataRef: { candlesKey: 'k', splitIndex: 4, revealToIndex: 8 },
  objective: { kind: 'process', passScore: 70 },
  constraints: { accountBalance: 10000, maxRiskPct: 2, requireStop: true, minRewardRisk: 2 },
  rubricId: 'charts-v1',
  nudges: [{ id: 'no-stop' }, { id: 'sizing' }],
  coachContextKeys: ['outcome'],
  source: 'llm',
  layout: [{ id: 'dir', kind: 'direction-choice', config: { allowed: ['long', 'short', 'skip'] } }],
}

describe('ScenarioPlayer (generative flow)', () => {
  it('renders the scenario framing and the composed layout', () => {
    render(<ScenarioPlayer spec={spec} data={candles} />)
    expect(screen.getByRole('heading', { name: /breakout retest/i })).toBeTruthy()
    expect(screen.getByText(/pulled back to the breakout/i)).toBeTruthy()
    expect(screen.getByRole('radio', { name: /skip/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /submit decision/i })).toBeTruthy()
  })

  it('gates on the journal, then resolves + grades into the redesigned debrief', async () => {
    render(<ScenarioPlayer spec={spec} data={candles} />)

    // 1) Make a decision — "skip" short-circuits the trade-entry widgets so the layout is complete.
    fireEvent.click(screen.getByRole('radio', { name: /skip/i }))
    const submit = screen.getByRole('button', { name: /submit decision/i }) as HTMLButtonElement
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)

    // 2) Mandatory journal gate.
    fireEvent.change(screen.getByLabelText(/why did you take/i), {
      target: { value: 'No edge here — staying out.' },
    })
    fireEvent.click(screen.getByRole('radio', { name: /calm/i }))
    fireEvent.click(screen.getByRole('button', { name: /log & see result/i }))

    // 3) Redesigned debrief: process score breakdown + display-only P&L.
    const continueBtn = await screen.findByRole('button', { name: /continue/i })
    expect(screen.getByText(/how you scored/i)).toBeTruthy()
    expect(screen.getByText(/process, not p&l/i)).toBeTruthy()

    // 4) Continue persists the run and returns to the practice hub.
    fireEvent.click(continueBtn)
    expect(h.applyResult).toHaveBeenCalledTimes(1)
    expect(h.navigate).toHaveBeenCalledWith('/practice')
  })
})
