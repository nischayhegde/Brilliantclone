import { describe, it, expect } from 'vitest'
import { INSTRUMENTS, instrumentInfo } from './instruments'

describe('instrumentInfo', () => {
  it('looks up by exact ticker', () => {
    expect(instrumentInfo('NVDA')).toEqual({ name: 'NVIDIA Corp.', sector: 'Technology' })
  })

  it('is case-insensitive', () => {
    expect(instrumentInfo('aapl')?.name).toBe('Apple Inc.')
  })

  it('tolerates the BRK.B ↔ BRK-B punctuation variants', () => {
    expect(instrumentInfo('BRK.B')?.name).toContain('Berkshire')
    expect(instrumentInfo('BRK-B')?.name).toContain('Berkshire')
  })

  it('returns undefined for unknown / empty tickers', () => {
    expect(instrumentInfo('ZZZZ')).toBeUndefined()
    expect(instrumentInfo(undefined)).toBeUndefined()
  })

  it('every entry carries a non-empty name and sector', () => {
    for (const [ticker, info] of Object.entries(INSTRUMENTS)) {
      expect(info.name, ticker).toBeTruthy()
      expect(info.sector, ticker).toBeTruthy()
    }
  })
})
