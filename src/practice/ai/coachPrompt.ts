import type { CoachRequest } from './types'
import { DISALLOWED_CLAIM_PATTERNS } from '../validator'

export function buildCoachPrompt(req: CoachRequest): string {
  const facts = Object.entries(req.allowedFacts).map(([k, v]) => `  ${k}: ${v}`).join('\n')
  return [
    'You are a calm, plain-spoken trading coach. You explain WHY a decision scored as it did. You teach process.',
    'HARD RULES:',
    '- NEVER predict prices, recommend trades, or give financial advice.',
    '- You may ONLY mention numbers that appear in the FACTS block below. Do not introduce any other number.',
    '- 2–4 sentences, warm and direct, one analogy max, no hype.',
    '',
    `Process score: ${req.score.total}/100 (pass ≥ ${req.spec.objective.passScore}). Result P&L is in FACTS.`,
    `Nudges that fired: ${req.nudgesFired.join(', ') || 'none'}.`,
    req.journal ? `Learner wrote: "${req.journal.rationale}" feeling "${req.journal.feeling}".` : '',
    'Per-dimension: ' + req.score.dimensions.map((d) => `${d.label} ${Math.round(d.score * 100)}%`).join(', '),
    'FACTS (the ONLY numbers you may cite):',
    facts,
    '',
    'Write the debrief now.',
  ].filter(Boolean).join('\n')
}

/** Any numeral token: optional $, optional thousands, optional decimals, optional trailing %. */
const NUMBER_TOKEN = /\$?\s?\d[\d,]*(?:\.\d+)?\s?%?/g

/**
 * Reject prose that predicts/advises or cites ANY number — `$`-prefixed, bare, or a
 * percentage — outside the whitelist of real facts. The whitelist is the whitelisted facts
 * plus the score scaffolding we hand the coach (its score, the pass bar, the 0–100 scale, and
 * the per-dimension percentages it is shown), so ordinary debrief prose is never over-rejected.
 */
export function sanitizeCoachText(text: string, req: CoachRequest): { ok: boolean; reason?: string } {
  for (const re of DISALLOWED_CLAIM_PATTERNS) if (re.test(text)) return { ok: false, reason: `disallowed claim: ${re}` }

  const allowed = new Set<number>()
  for (const v of Object.values(req.allowedFacts)) if (typeof v === 'number') allowed.add(Math.abs(v))
  allowed.add(Math.abs(req.score.total))
  allowed.add(Math.abs(req.spec.objective.passScore))
  allowed.add(100) // the score scale ("xx/100")
  for (const d of req.score.dimensions) allowed.add(Math.round(d.score * 100))
  const isAllowed = (n: number) => [...allowed].some((a) => Math.abs(a - n) < 0.5)

  for (const tok of text.match(NUMBER_TOKEN) ?? []) {
    const isPct = tok.includes('%')
    const n = Math.abs(parseFloat(tok.replace(/[$,\s%]/g, '')))
    if (Number.isNaN(n)) continue
    if (!isAllowed(n)) return { ok: false, reason: `${isPct ? 'percentage' : 'number'} ${n}${isPct ? '%' : ''} not in whitelist` }
  }
  return { ok: true }
}
