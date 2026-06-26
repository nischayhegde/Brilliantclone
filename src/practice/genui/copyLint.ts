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
 * Specific number in prose the LLM/widget copy must never invent (the model never produces
 * a traded number). Catches:
 *   - a `$` amount, incl. a single digit — "$182.50", "$5";
 *   - a bare multi-digit number — "182.5", "200";
 *   - a single-digit percentage — "risk 5%", "2.5%";
 *   - a ratio like "5-to-1", "5 to 1", or "5:1" (reward:risk shorthand).
 * Bare single digits on their own (e.g. "one analogy max") are deliberately NOT flagged so
 * ordinary teaching prose is not over-blocked.
 */
export const NUMERIC_CLAIM_PATTERN =
  /\$\s?\d[\d,]*(\.\d+)?|\b\d{2,}(\.\d+)?\b|\b\d+(?:\.\d+)?\s?%|\b\d+\s*(?:[-\s]*to[-\s]*|:)\s*\d+\b/

export function hasDisallowedClaim(text: string): boolean {
  return DISALLOWED_CLAIM_PATTERNS.some((re) => re.test(text))
}

export function hasNumericClaim(text: string): boolean {
  return NUMERIC_CLAIM_PATTERN.test(text)
}

/**
 * Any numeral token in prose: optional `$`, optional thousands, optional decimals,
 * optional trailing `%`. Used to whitelist-check generated prose (the hybrid grader's
 * feedback) so a model can ONLY cite numbers we handed it — never invent a traded one.
 * The leaf owns this so the client coach and the (mirrored) grade guard agree.
 */
export const NUMBER_TOKEN_PATTERN = /\$?\s?\d[\d,]*(?:\.\d+)?\s?%?/g

export interface NumberToken {
  /** The absolute numeric value of the token. */
  value: number
  /** Whether the token carried a trailing `%`. */
  isPct: boolean
}

/** Extract every numeral token from prose as `{ value, isPct }` (abs value). */
export function extractNumberTokens(text: string): NumberToken[] {
  const out: NumberToken[] = []
  for (const tok of text.match(NUMBER_TOKEN_PATTERN) ?? []) {
    const isPct = tok.includes('%')
    const value = Math.abs(parseFloat(tok.replace(/[$,\s%]/g, '')))
    if (!Number.isNaN(value)) out.push({ value, isPct })
  }
  return out
}

/**
 * True when EVERY numeral in `text` is within `eps` of some allowed value. The
 * canonical "the model may only cite whitelisted numbers" check, shared by the
 * grade-feedback sanitizer. Disallowed claims are checked separately.
 */
export function numbersWithinWhitelist(text: string, allowed: Iterable<number>, eps = 0.5): boolean {
  const allow = [...allowed].map((n) => Math.abs(n))
  for (const { value } of extractNumberTokens(text)) {
    if (!allow.some((a) => Math.abs(a - value) < eps)) return false
  }
  return true
}
