import type { CP } from '../chain'

/** Abramowitz–Stegun 7.1.26 approximation of the standard normal CDF. */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp(-0.5 * x * x)
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

/**
 * Black–Scholes European price. Inputs are REAL (S from the underlying path, sigma =
 * the snapshot IV); the OUTPUT is a model estimate, labelled as such wherever shown.
 */
export function bsPrice(cp: CP, S: number, K: number, tYears: number, sigma: number, r = 0.01): number {
  if (tYears <= 0 || sigma <= 0) {
    return cp === 'C' ? Math.max(S - K, 0) : Math.max(K - S, 0)
  }
  const sqrtT = Math.sqrt(tYears)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * tYears) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  if (cp === 'C') return S * normCdf(d1) - K * Math.exp(-r * tYears) * normCdf(d2)
  return K * Math.exp(-r * tYears) * normCdf(-d2) - S * normCdf(-d1)
}
