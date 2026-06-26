import { describe, it, expect } from 'vitest'
import {
  clampMaxOutputTokens,
  validateComposeInput,
  validateGradeInput,
  RateLimiter,
  DEFAULT_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS,
  MIN_OUTPUT_TOKENS,
  MAX_CATALOG_ENTRIES,
  MAX_ID_LIST_ENTRIES,
  MAX_CATALOG_ENTRY_CHARS,
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

describe('validateComposeInput', () => {
  const catalog = { candlesKeys: ['AAPL__1d'], ohlcAssets: [], chainAssets: [], rubricIds: ['charts-v1'], nudgeIds: ['sizing'] }
  it('accepts a well-formed compose request', () => {
    const r = validateComposeInput({ track: 'charts', tier: 1, accountBalance: 10000, catalog })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.catalog.candlesKeys).toEqual(['AAPL__1d'])
  })
  it('rejects an unknown track, bad tier, or non-positive balance', () => {
    expect(validateComposeInput({ track: 'crypto', tier: 1, accountBalance: 1, catalog }).ok).toBe(false)
    expect(validateComposeInput({ track: 'charts', tier: 0, accountBalance: 1, catalog }).ok).toBe(false)
    expect(validateComposeInput({ track: 'charts', tier: 1, accountBalance: 0, catalog }).ok).toBe(false)
  })
  it('rejects a malformed catalog (non-string-array fields)', () => {
    expect(validateComposeInput({ track: 'charts', tier: 1, accountBalance: 1, catalog: { ...catalog, candlesKeys: [1, 2] } }).ok).toBe(false)
    expect(validateComposeInput({ track: 'charts', tier: 1, accountBalance: 1, catalog: 'nope' }).ok).toBe(false)
  })
  it('rejects an over-large catalog allow-list', () => {
    const huge = { ...catalog, ohlcAssets: Array.from({ length: MAX_CATALOG_ENTRIES + 1 }, (_, i) => `a${i}`) }
    expect(validateComposeInput({ track: 'charts', tier: 1, accountBalance: 1, catalog: huge }).ok).toBe(false)
  })
  it('rejects an over-long rubricIds/nudgeIds list (interpolated in full → tighter cap)', () => {
    const manyRubrics = { ...catalog, rubricIds: Array.from({ length: MAX_ID_LIST_ENTRIES + 1 }, (_, i) => `r${i}`) }
    expect(validateComposeInput({ track: 'charts', tier: 1, accountBalance: 1, catalog: manyRubrics }).ok).toBe(false)
    const manyNudges = { ...catalog, nudgeIds: Array.from({ length: MAX_ID_LIST_ENTRIES + 1 }, (_, i) => `n${i}`) }
    expect(validateComposeInput({ track: 'charts', tier: 1, accountBalance: 1, catalog: manyNudges }).ok).toBe(false)
  })
  it('rejects an over-long catalog entry (per-string char cap)', () => {
    const longEntry = { ...catalog, nudgeIds: ['x'.repeat(MAX_CATALOG_ENTRY_CHARS + 1)] }
    expect(validateComposeInput({ track: 'charts', tier: 1, accountBalance: 1, catalog: longEntry }).ok).toBe(false)
  })
  it('rejects a catalog whose total size blows the input-char ceiling', () => {
    // 5000 entries × 64 chars = 320k chars > the 200k total ceiling (each entry stays in-bounds).
    const big = { ...catalog, ohlcAssets: Array.from({ length: MAX_CATALOG_ENTRIES }, () => 'a'.repeat(MAX_CATALOG_ENTRY_CHARS)) }
    expect(validateComposeInput({ track: 'charts', tier: 1, accountBalance: 1, catalog: big }).ok).toBe(false)
  })
})

describe('validateGradeInput', () => {
  const base = {
    track: 'charts', passScore: 70,
    decision: { took: true }, outcomeFacts: { pnl: -100 },
    candleSummary: { bars: 40, startClose: 100, endClose: 92, high: 108, low: 90, netChange: -8, pctChange: -8 },
    signals: {}, rubricDims: [{ id: 'read', label: 'Correct read', weight: 2, deterministic: 0.8 }],
  }
  it('accepts a well-formed grade request', () => {
    const r = validateGradeInput(base)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.rubricDims[0].id).toBe('read')
  })
  it('rejects a candleSummary missing numeric fields', () => {
    expect(validateGradeInput({ ...base, candleSummary: { bars: 40 } }).ok).toBe(false)
  })
  it('rejects a non-finite pnl / outcome fact (MIN-4)', () => {
    expect(validateGradeInput({ ...base, outcomeFacts: { pnl: Number.POSITIVE_INFINITY } }).ok).toBe(false)
    expect(validateGradeInput({ ...base, outcomeFacts: { pnl: Number.NaN } }).ok).toBe(false)
    expect(validateGradeInput({ ...base, outcomeFacts: { pnl: -100, netMove: Number.NaN } }).ok).toBe(false)
    // A string pnl would coerce to NaN downstream — reject it too.
    expect(validateGradeInput({ ...base, outcomeFacts: { pnl: 'lots' } }).ok).toBe(false)
  })
  it('rejects empty or malformed rubricDims', () => {
    expect(validateGradeInput({ ...base, rubricDims: [] }).ok).toBe(false)
    expect(validateGradeInput({ ...base, rubricDims: [{ id: 'x' }] }).ok).toBe(false)
  })
  it('rejects an unknown track', () => {
    expect(validateGradeInput({ ...base, track: 'nope' }).ok).toBe(false)
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
