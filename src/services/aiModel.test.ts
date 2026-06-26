import { describe, it, expect, vi, beforeEach } from 'vitest'

// The transport is mocked end-to-end: `firebase/functions` (httpsCallable) and the
// firebase app module are stubbed, so no real Firebase/Functions/network is touched.
// `vi.resetModules()` per test resets aiModel's internal `cached` singleton.
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('getComposeFn / getGradeFn (dedicated WS-D callables)', () => {
  const catalog = { track: 'charts' as const, candlesKeys: ['k'], ohlcAssets: [], chainAssets: [], rubricIds: ['charts-v1'], nudgeIds: ['sizing'] }

  it('forwards the compose request to the composeScenario callable and returns its data', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { spec: { id: 's1', track: 'charts' } } })
    const httpsCallable = vi.fn().mockReturnValue(callable)
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: { __tag: 'fn' } }))

    const { getComposeFn } = await import('./aiModel')
    const fn = getComposeFn()
    const req = { track: 'charts' as const, tier: 1, accountBalance: 10000, catalog }
    const res = await fn!(req)
    expect(httpsCallable).toHaveBeenCalledWith({ __tag: 'fn' }, 'composeScenario')
    expect(callable).toHaveBeenCalledWith(req)
    expect(res).toEqual({ spec: { id: 's1', track: 'charts' } })
  })

  it('forwards the grade request to the gradeRun callable and returns its data', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { fallback: true } })
    const httpsCallable = vi.fn().mockReturnValue(callable)
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: {} }))

    const { getGradeFn } = await import('./aiModel')
    const res = await getGradeFn()!({ track: 'charts', passScore: 70 } as never)
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'gradeRun')
    expect(res).toEqual({ fallback: true })
  })

  it('returns null gracefully when a dedicated callable cannot be wired', async () => {
    const httpsCallable = vi.fn(() => { throw new Error('no functions') })
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: {} }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { getComposeFn, getGradeFn } = await import('./aiModel')
    expect(getComposeFn()).toBeNull()
    expect(getGradeFn()).toBeNull()
    warn.mockRestore()
  })

  it('rejects from the compose fn when the call fails (composer then falls back to curated)', async () => {
    const callable = vi.fn().mockRejectedValue(new Error('rate-limited'))
    const httpsCallable = vi.fn().mockReturnValue(callable)
    vi.doMock('firebase/functions', () => ({ httpsCallable }))
    vi.doMock('../lib/firebase', () => ({ functions: {} }))

    const { getComposeFn } = await import('./aiModel')
    await expect(getComposeFn()!({ track: 'charts', tier: 1, accountBalance: 10000, catalog })).rejects.toThrow('rate-limited')
  })
})
