import { describe, it, expect } from 'vitest'
import { DISCLAIMER, TRACK_BLURB, illustrativeLabel } from './copy'
import type { ScenarioSpec } from './types'

describe('practice copy', () => {
  it('disclaimer makes the educational, not-advice framing explicit', () => {
    expect(DISCLAIMER.toLowerCase()).toContain('not financial advice')
    expect(DISCLAIMER.toLowerCase()).toContain('paper')
  })
  it('has a blurb for every track', () => {
    expect(TRACK_BLURB.charts).toBeTruthy()
    expect(TRACK_BLURB.options).toBeTruthy()
    expect(TRACK_BLURB['market-making']).toBeTruthy()
  })
  it('builds an illustrative label only when flags exist', () => {
    const base = { illustrativeFlags: undefined } as unknown as ScenarioSpec
    expect(illustrativeLabel(base)).toBeNull()
    const withFlags = { illustrativeFlags: ['orderFlow'] } as unknown as ScenarioSpec
    expect(illustrativeLabel(withFlags)!.toLowerCase()).toContain('illustrative')
    expect(illustrativeLabel(withFlags)!.toLowerCase()).toContain('exact')
  })
})
