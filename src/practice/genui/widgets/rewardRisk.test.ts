import { describe, it, expect } from 'vitest'
import { rewardRisk } from './rewardRisk'

describe('rewardRisk', () => {
  it('computes reward:risk for a long setup', () => {
    // entry 100, stop 95 (risk 5), target 115 (reward 15) -> 3
    expect(rewardRisk('long', 100, 95, 115)).toBeCloseTo(3, 5)
  })

  it('computes reward:risk for a short setup (absolute distances)', () => {
    // entry 100, stop 105 (risk 5), target 90 (reward 10) -> 2
    expect(rewardRisk('short', 100, 105, 90)).toBeCloseTo(2, 5)
  })

  it('returns null when a line is missing', () => {
    expect(rewardRisk('long', 100, undefined, 115)).toBeNull()
  })

  it('returns null when risk is zero', () => {
    expect(rewardRisk('long', 100, 100, 115)).toBeNull()
  })
})
