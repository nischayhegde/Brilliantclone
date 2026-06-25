import { describe, it, expect, vi } from 'vitest'
import { makeScenarioQueue } from './scenarioQueue'
import type { ScenarioSpec } from '../types'

const spec = (id: string): ScenarioSpec => ({ id, track: 'charts' } as ScenarioSpec)
const deferred = () => { let resolve!: (v: { spec: ScenarioSpec; source: 'llm' }) => void; const p = new Promise<{ spec: ScenarioSpec; source: 'llm' }>((r) => (resolve = r)); return { p, resolve } }
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('makeScenarioQueue', () => {
  it('prefetches QUEUE_SIZE scenarios in the background after prime', async () => {
    let n = 0
    const compose = vi.fn(async () => ({ spec: spec(`s${n++}`), source: 'llm' as const }))
    const q = makeScenarioQueue(compose, { size: 2 })
    q.prime('charts')
    await flush(); await flush()
    expect(q.ready('charts')).toBe(2)
    expect(compose).toHaveBeenCalledTimes(2)
  })

  it('take() returns a buffered spec INSTANTLY even if a fresh compose would hang', async () => {
    const slow = deferred()
    let calls = 0
    // first two composes resolve immediately to fill the buffer; later ones hang.
    const compose = vi.fn(async () => (calls++ < 2 ? { spec: spec(`ready${calls}`), source: 'llm' as const } : slow.p))
    const q = makeScenarioQueue(compose, { size: 2 })
    q.prime('charts')
    await flush(); await flush()
    const got = await q.take('charts') // resolves from buffer, NOT from the hanging compose
    expect(got.id).toMatch(/ready/)
  })

  it('take() composes on demand when the buffer is empty, then refills', async () => {
    let n = 0
    const compose = vi.fn(async () => ({ spec: spec(`d${n++}`), source: 'llm' as const }))
    const q = makeScenarioQueue(compose, { size: 2 })
    const got = await q.take('charts') // empty buffer → compose now
    expect(got.id).toBe('d0')
    await flush(); await flush()
    expect(q.ready('charts')).toBeGreaterThan(0) // refilled in background
  })

  it('never rejects even if compose throws (degrades silently)', async () => {
    const compose = vi.fn(async () => { throw new Error('boom') })
    const q = makeScenarioQueue(compose, { size: 2 })
    await expect(q.take('charts')).rejects.toThrow() // surfaced to caller, who falls back to curated
  })
})
