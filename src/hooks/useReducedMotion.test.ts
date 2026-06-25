// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('useReducedMotion', () => {
  beforeEach(() => vi.unstubAllGlobals())
  it('returns true when the user prefers reduced motion', () => {
    mockMatchMedia(true)
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true)
  })
  it('returns false otherwise', () => {
    mockMatchMedia(false)
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false)
  })
})
