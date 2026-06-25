import { describe, it, expect, vi, beforeEach } from 'vitest'

// The transport is mocked end-to-end: `firebase/functions` (httpsCallable) and the
// firebase app module are stubbed, so no real Firebase/Functions/network is touched.
// `vi.resetModules()` per test resets aiModel's internal `cached` singleton.
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('getModelClient (callable transport)', () => {
  it('maps generate(prompt, opts) onto the aiRespond callable and returns its text', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { text: 'coached reply' } })
    const httpsCallable = vi.fn().mockReturnValue(callable)
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: { __tag: 'functions' } }))

    const { getModelClient } = await import('./aiModel')
    const client = getModelClient()
    expect(client).not.toBeNull()

    const out = await client!.generate('the prompt', { temperature: 0.8, maxTokens: 500 })
    expect(out).toBe('coached reply')
    expect(httpsCallable).toHaveBeenCalledWith({ __tag: 'functions' }, 'aiRespond')
    expect(callable).toHaveBeenCalledWith({ input: 'the prompt', temperature: 0.8, maxOutputTokens: 500 })
  })

  it('omits temperature/maxOutputTokens when no opts are passed', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { text: 'ok' } })
    const httpsCallable = vi.fn().mockReturnValue(callable)
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: {} }))

    const { getModelClient } = await import('./aiModel')
    await getModelClient()!.generate('p')
    expect(callable).toHaveBeenCalledWith({ input: 'p', temperature: undefined, maxOutputTokens: undefined })
  })

  it('caches the client across calls (one httpsCallable wiring)', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { text: 'x' } })
    const httpsCallable = vi.fn().mockReturnValue(callable)
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: {} }))

    const { getModelClient } = await import('./aiModel')
    getModelClient()
    getModelClient()
    expect(httpsCallable).toHaveBeenCalledTimes(1)
  })

  it('returns null gracefully when the callable cannot be wired (curated-only mode)', async () => {
    const httpsCallable = vi.fn(() => {
      throw new Error('functions unavailable')
    })
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: {} }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { getModelClient } = await import('./aiModel')
    expect(getModelClient()).toBeNull()
    warn.mockRestore()
  })

  it('rejects from generate when the call fails (composer/coach then fall back)', async () => {
    const callable = vi.fn().mockRejectedValue(new Error('unauthenticated'))
    const httpsCallable = vi.fn().mockReturnValue(callable)
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: {} }))

    const { getModelClient } = await import('./aiModel')
    await expect(getModelClient()!.generate('p')).rejects.toThrow('unauthenticated')
  })
})
