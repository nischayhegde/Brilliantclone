import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The transport is mocked end-to-end: `../lib/firebase` (auth.currentUser.getIdToken) and the
// global `fetch` are stubbed, so no real Firebase/network is touched. `vi.resetModules()` per
// test resets aiModel's internal `cached` singletons + re-reads the stubbed VITE_LLM_API_URL.
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const API = 'https://llm.example.com'
const catalog = { track: 'charts' as const, candlesKeys: ['k'], ohlcAssets: [], chainAssets: [], rubricIds: ['charts-v1'], nudgeIds: ['sizing'] }

function mockAuth(token: string | null = 'id-token') {
  vi.doMock('../lib/firebase', () => ({
    auth: { currentUser: token == null ? null : { getIdToken: vi.fn().mockResolvedValue(token) } },
  }))
}

function mockFetch(response: { ok: boolean; status?: number; json?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.json,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('getComposeFn / getGradeFn (Render LLM endpoint transports)', () => {
  it('POSTs the compose request with a bearer token and returns the parsed body', async () => {
    vi.stubEnv('VITE_LLM_API_URL', API)
    mockAuth('id-token')
    const fetchMock = mockFetch({ ok: true, json: { spec: { id: 's1', track: 'charts' } } })

    const { getComposeFn } = await import('./aiModel')
    const req = { track: 'charts' as const, tier: 1, accountBalance: 10000, catalog }
    const res = await getComposeFn()!(req)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API}/api/compose`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer id-token')
    expect(JSON.parse(init.body)).toEqual(req)
    expect(res).toEqual({ spec: { id: 's1', track: 'charts' } })
  })

  it('POSTs the grade request to /api/grade and returns its body', async () => {
    vi.stubEnv('VITE_LLM_API_URL', API)
    mockAuth('id-token')
    const fetchMock = mockFetch({ ok: true, json: { fallback: true } })

    const { getGradeFn } = await import('./aiModel')
    const res = await getGradeFn()!({ track: 'charts', passScore: 70 } as never)

    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/api/grade`)
    expect(res).toEqual({ fallback: true })
  })

  it('returns null gracefully when VITE_LLM_API_URL is unset', async () => {
    vi.stubEnv('VITE_LLM_API_URL', '')
    mockAuth('id-token')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { getComposeFn, getGradeFn } = await import('./aiModel')
    expect(getComposeFn()).toBeNull()
    expect(getGradeFn()).toBeNull()
    warn.mockRestore()
  })

  it('rejects from the compose fn on a non-2xx response (composer then falls back to curated)', async () => {
    vi.stubEnv('VITE_LLM_API_URL', API)
    mockAuth('id-token')
    mockFetch({ ok: false, status: 429, json: { error: 'rate-limited' } })

    const { getComposeFn } = await import('./aiModel')
    await expect(getComposeFn()!({ track: 'charts', tier: 1, accountBalance: 10000, catalog })).rejects.toThrow('429')
  })

  it('rejects when there is no signed-in user (no token to send)', async () => {
    vi.stubEnv('VITE_LLM_API_URL', API)
    mockAuth(null)
    mockFetch({ ok: true, json: { fallback: true } })

    const { getGradeFn } = await import('./aiModel')
    await expect(getGradeFn()!({ track: 'charts', passScore: 70 } as never)).rejects.toThrow('Not signed in')
  })
})
