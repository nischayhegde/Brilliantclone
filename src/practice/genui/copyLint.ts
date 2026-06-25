/**
 * Copy-lint leaf module — the SINGLE SOURCE OF TRUTH for the numeric-claim and
 * disallowed-claim text checks shared by `validator.ts` (spec briefs/titles) and
 * `genui/schema.ts` (widget copy).
 *
 * PURE / ISOMORPHIC and a true LEAF: imports nothing. It lives here, inside the
 * genui core, so the Cloud Functions toolchain (which compiles only the genui core
 * + `practice/types.ts`) can import `validateLayout` without pulling in
 * `validator.ts` (and its CANDLES/RUBRICS/NUDGES dependencies).
 *
 * This module exists specifically to break the former `validator.ts ⇄ schema.ts`
 * import cycle: both modules now depend only on this leaf, never on each other for
 * the lints.
 */

/** Phrases an LLM brief/copy must NOT contain — predictions, advice, guarantees. */
export const DISALLOWED_CLAIM_PATTERNS: RegExp[] = [
  /\bwill (?:definitely |certainly )?(?:go|rise|fall|drop|moon|crash)\b/i,
  /\bguarantee(?:d|s)?\b/i,
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\b(?:financial )?advice\b/i,
  /\bsure thing\b/i,
  /\bcan'?t lose\b/i,
  /\brisk[- ]free\b/i,
]

/**
 * Price-like number in prose, e.g. "$182.50", "182.5", a bare "200" — LLM/widget copy
 * must avoid inventing specific numbers (the model never produces a traded number).
 */
export const NUMERIC_CLAIM_PATTERN = /\$\s?\d[\d,]*(\.\d+)?|\b\d{2,}(\.\d+)?\b/

export function hasDisallowedClaim(text: string): boolean {
  return DISALLOWED_CLAIM_PATTERNS.some((re) => re.test(text))
}

export function hasNumericClaim(text: string): boolean {
  return NUMERIC_CLAIM_PATTERN.test(text)
}
