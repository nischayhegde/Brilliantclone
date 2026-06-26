import { describe, it, expect } from 'vitest'
import { extractNumberTokens, hasNumericClaim, numbersWithinWhitelist } from './copyLint'

describe('hasNumericClaim', () => {
  it('flags a single-digit percentage (MIN-1)', () => {
    expect(hasNumericClaim('Keep risk near 5% of the account.')).toBe(true)
    expect(hasNumericClaim('Trim to about 2.5% per trade.')).toBe(true)
  })
  it('flags a single-digit reward:risk ratio (MIN-1)', () => {
    expect(hasNumericClaim('Aim for a 5-to-1 payoff.')).toBe(true)
    expect(hasNumericClaim('Target a 5 to 1 reward.')).toBe(true)
    expect(hasNumericClaim('A clean 5:1 setup.')).toBe(true)
  })
  it('still flags $ amounts (incl. a single digit) and multi-digit numbers', () => {
    expect(hasNumericClaim('Buy above $182.50.')).toBe(true)
    expect(hasNumericClaim('It only costs $5.')).toBe(true)
    expect(hasNumericClaim('A move to 200.')).toBe(true)
  })
  it('does not over-block clean, number-free teaching prose', () => {
    expect(hasNumericClaim('Define your risk before you take the trade, or stand aside.')).toBe(false)
    expect(hasNumericClaim('Reward should outweigh the risk; keep one analogy max.')).toBe(false)
    expect(hasNumericClaim('Size the spread to the move and stay two-sided.')).toBe(false)
  })
})

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
