import { describe, it, expect, vi } from 'vitest'

// Stub phaser exactly like src/lessons/registry.test.ts (canvas feature-detection needs a browser).
vi.mock('phaser', () => {
  const stub: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'Scene') return class {}
      return stub
    },
    construct: () => ({}),
    apply: () => stub,
  })
  return { default: stub }
})

const { PRACTICE_SCENES, resolvePracticeScene } = await import('./index')

describe('practice scene registry', () => {
  it('registers the chart-trade scene as a constructable class', () => {
    expect(typeof PRACTICE_SCENES['chart-trade']).toBe('function')
    expect(resolvePracticeScene('chart-trade')).toBeTruthy()
    expect(resolvePracticeScene('missing')).toBeUndefined()
  })

  it('registers the options-build scene', () => {
    expect(typeof PRACTICE_SCENES['options-build']).toBe('function')
  })
})
