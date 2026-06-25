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

/** Reject prose that predicts/advises or cites a number outside the whitelist. */
export function sanitizeCoachText(text: string, req: CoachRequest): { ok: boolean; reason?: string } {
  for (const re of DISALLOWED_CLAIM_PATTERNS) if (re.test(text)) return { ok: false, reason: `disallowed claim: ${re}` }
  const allowed = new Set(
    Object.values(req.allowedFacts).filter((v) => typeof v === 'number').map((v) => Math.abs(v as number)),
  )
  const nums = text.match(/\$\s?\d[\d,]*(\.\d+)?/g) ?? []
  for (const tok of nums) {
    const n = Math.abs(parseFloat(tok.replace(/[$,\s]/g, '')))
    if (![...allowed].some((a) => Math.abs(a - n) < 0.5)) return { ok: false, reason: `number $${n} not in whitelist` }
  }
  return { ok: true }
}
