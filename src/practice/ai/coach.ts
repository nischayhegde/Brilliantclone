import type { CoachRequest, ModelClient } from './types'
import { buildCoachPrompt, sanitizeCoachText } from './coachPrompt'
import { curatedDebrief } from '../debrief'
import type { Feeling } from '../types'

export async function coachDebrief(
  req: CoachRequest,
  model: ModelClient,
): Promise<{ text: string; source: 'llm' | 'curated' }> {
  try {
    const text = (await model.generate(buildCoachPrompt(req), { temperature: 0.5 })).trim()
    if (text && sanitizeCoachText(text, req).ok) return { text, source: 'llm' }
  } catch {
    // fall through
  }
  const journal = req.journal ? { rationale: req.journal.rationale, feeling: req.journal.feeling as Feeling } : undefined
  return { text: curatedDebrief(req.spec, req.decision, req.outcome, req.score, journal), source: 'curated' }
}
