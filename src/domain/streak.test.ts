import { describe, it, expect } from 'vitest'
import { SESSION_GAP_MS, nextSitting, computeBestStreak, isNewSitting } from './streak'

describe('nextSitting', () => {
  it('increments by one (first completion of a fresh sitting → 1)', () => {
    expect(nextSitting(0)).toBe(1)
    expect(nextSitting(4)).toBe(5)
  })
})

describe('computeBestStreak', () => {
  it('takes the max and never lowers the persisted best', () => {
    expect(computeBestStreak(5, 3)).toBe(5) // shorter new sitting keeps old best
    expect(computeBestStreak(2, 4)).toBe(4) // longer new sitting raises it
    expect(computeBestStreak(0, 0)).toBe(0)
  })
})

describe('isNewSitting', () => {
  const now = 1_000_000_000_000
  it('is a new sitting when there is no prior activity', () => {
    expect(isNewSitting(null, now)).toBe(true)
  })
  it('is the same sitting within the gap threshold', () => {
    expect(isNewSitting(now - 10 * 60 * 1000, now)).toBe(false)
  })
  it('is a new sitting once the gap is exceeded', () => {
    expect(isNewSitting(now - (SESSION_GAP_MS + 1), now)).toBe(true)
  })
})
