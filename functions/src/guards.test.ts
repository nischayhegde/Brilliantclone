import { describe, it, expect } from 'vitest'
import {
  clampMaxOutputTokens,
  clampTemperature,
  validateAiRespondInput,
  RateLimiter,
  DEFAULT_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS,
  MIN_OUTPUT_TOKENS,
  MAX_INPUT_CHARS,
} from './guards'

describe('clampMaxOutputTokens', () => {
  it('defaults when missing or non-finite', () => {
    expect(clampMaxOutputTokens()).toBe(DEFAULT_OUTPUT_TOKENS)
    expect(clampMaxOutputTokens(Number.NaN)).toBe(DEFAULT_OUTPUT_TOKENS)
  })
  it('clamps above the ceiling and below the floor', () => {
    expect(clampMaxOutputTokens(999_999)).toBe(MAX_OUTPUT_TOKENS)
    expect(clampMaxOutputTokens(1)).toBe(MIN_OUTPUT_TOKENS)
  })
  it('passes through and floors valid values', () => {
    expect(clampMaxOutputTokens(500)).toBe(500)
    expect(clampMaxOutputTokens(500.9)).toBe(500)
  })
})

describe('clampTemperature', () => {
  it('returns undefined when not provided (so the request omits it)', () => {
    expect(clampTemperature()).toBeUndefined()
    expect(clampTemperature(Number.NaN)).toBeUndefined()
  })
  it('clamps into [0, 2]', () => {
    expect(clampTemperature(-1)).toBe(0)
    expect(clampTemperature(5)).toBe(2)
    expect(clampTemperature(0.7)).toBe(0.7)
  })
})

describe('validateAiRespondInput', () => {
  it('accepts a minimal valid body', () => {
    const r = validateAiRespondInput({ input: 'hello' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ input: 'hello' })
  })

  it('accepts a full valid body and only forwards known fields', () => {
    const r = validateAiRespondInput({
      input: 'hello',
      instructions: 'sys',
      temperature: 0.5,
      maxOutputTokens: 200,
      jsonSchema: { name: 'Layout', schema: { type: 'object' }, strict: true },
      bogus: 'ignored',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.instructions).toBe('sys')
      expect(r.value.jsonSchema).toEqual({ name: 'Layout', schema: { type: 'object' }, strict: true })
      expect((r.value as Record<string, unknown>).bogus).toBeUndefined()
    }
  })

  it('rejects a missing or empty input', () => {
    expect(validateAiRespondInput({}).ok).toBe(false)
    expect(validateAiRespondInput({ input: '   ' }).ok).toBe(false)
    expect(validateAiRespondInput(null).ok).toBe(false)
  })

  it('rejects an over-long input', () => {
    const r = validateAiRespondInput({ input: 'x'.repeat(MAX_INPUT_CHARS + 1) })
    expect(r.ok).toBe(false)
  })

  it('rejects a malformed jsonSchema', () => {
    expect(validateAiRespondInput({ input: 'x', jsonSchema: { name: 'bad name!', schema: {} } }).ok).toBe(false)
    expect(validateAiRespondInput({ input: 'x', jsonSchema: { name: 'ok', schema: 'nope' } }).ok).toBe(false)
  })

  it('rejects non-numeric temperature / maxOutputTokens', () => {
    expect(validateAiRespondInput({ input: 'x', temperature: 'hot' }).ok).toBe(false)
    expect(validateAiRespondInput({ input: 'x', maxOutputTokens: 'lots' }).ok).toBe(false)
  })
})

describe('RateLimiter', () => {
  it('allows up to the limit then blocks within the window', () => {
    const rl = new RateLimiter({ limit: 3, windowMs: 60_000 })
    const t = 1_000_000
    expect(rl.check('u', t).allowed).toBe(true)
    expect(rl.check('u', t + 1).allowed).toBe(true)
    expect(rl.check('u', t + 2).allowed).toBe(true)
    const blocked = rl.check('u', t + 3)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('frees up after the window slides past the oldest hit', () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 1_000 })
    const t = 5_000
    rl.check('u', t)
    rl.check('u', t + 100)
    expect(rl.check('u', t + 200).allowed).toBe(false)
    // After the window elapses, earlier hits expire and requests are allowed again.
    expect(rl.check('u', t + 1_200).allowed).toBe(true)
  })

  it('tracks uids independently', () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 60_000 })
    expect(rl.check('a', 0).allowed).toBe(true)
    expect(rl.check('a', 1).allowed).toBe(false)
    expect(rl.check('b', 1).allowed).toBe(true)
  })
})
