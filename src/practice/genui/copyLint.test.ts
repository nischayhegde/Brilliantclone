import { describe, it, expect } from 'vitest'
import { extractNumberTokens, numbersWithinWhitelist } from './copyLint'

describe('extractNumberTokens', () => {
  it('extracts dollar, bare, and percent numerals as absolute values', () => {
    const toks = extractNumberTokens('Risked $240 (about 2%) for a 1.5 R move.')
    expect(toks.map((t) => t.value)).toEqual(expect.arrayContaining([240, 2, 1.5]))
    expect(toks.find((t) => t.value === 2)?.isPct).toBe(true)
  })
  it('returns nothing for number-free prose', () => {
    expect(extractNumberTokens('A calm, disciplined plan.')).toEqual([])
  })
})

describe('numbersWithinWhitelist', () => {
  it('passes when every numeral is in the whitelist (within eps)', () => {
    expect(numbersWithinWhitelist('Lost $240 on a clean plan.', [240, 70, 100])).toBe(true)
  })
  it('fails when prose cites a number we never handed it', () => {
    expect(numbersWithinWhitelist('You left $9,999 on the table.', [240])).toBe(false)
  })
  it('treats sign as irrelevant (abs comparison)', () => {
    expect(numbersWithinWhitelist('A −240 dollar result.', [240])).toBe(true)
  })
})
