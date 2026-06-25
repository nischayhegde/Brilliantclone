import type { ComposeRequest } from './types'

/** Max real-data refs offered to the model per call (bounds prompt size, diversifies content). */
export const SAMPLE_REFS = 40

/** Pick up to n refs using a partial Fisher–Yates with an injectable rng (default Math.random). */
export function sampleRefs(refs: string[], n: number, rng: () => number = Math.random): string[] {
  if (refs.length <= n) return refs.slice()
  const pool = refs.slice()
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
    out.push(pool[i])
  }
  return out
}

export function buildComposerPrompt(req: ComposeRequest, opts: { rng?: () => number } = {}): string {
  const c = req.catalog
  // Offer a FRESH random sample each call: bounded prompt + naturally endless variety.
  const all = req.track === 'options' ? c.chainAssets : [...c.candlesKeys, ...c.ohlcAssets]
  const refs = sampleRefs(all, SAMPLE_REFS, opts.rng)
  return [
    'You compose a single trading-practice SCENARIO as STRICT JSON. You are a curriculum designer, not a forecaster.',
    'HARD RULES — you NEVER break these:',
    '- NEVER predict a price, pick a stock as a recommendation, or give financial advice.',
    '- NEVER invent any market number (price, premium, Greek, P&L). You only REFERENCE real data by key.',
    '- The brief is teaching prose ONLY: a setup + an objective. It contains NO specific price/premium numbers.',
    '- Always teach the WHY; defer every traded number to the provided real data.',
    '',
    `Compose for track "${req.track}", tier ${req.tier}, account balance $${req.accountBalance}.`,
    'Reference ONLY ONE of these real data keys (pick the one that best fits the lesson you design):',
    refs.map((r) => `  - ${r}`).join('\n'),
    'Vary your choice and (for charts) the splitIndex/revealToIndex window so scenarios stay fresh.',
    `Use rubricId from: ${c.rubricIds.join(', ')}.`,
    `Use nudge ids from: ${c.nudgeIds.join(', ')}.`,
    '',
    'Return ONLY a JSON object with this shape (no markdown, no commentary):',
    '{',
    '  "id": "<unique-id>", "track": "' + req.track + '", "tier": ' + req.tier + ',',
    '  "title": "<short, neutral, no numbers>", "brief": "<2-3 sentences, no numbers>",',
    '  "dataRef": { ' + (req.track === 'options' ? '"chainAsset": "<one chain asset>", "decisionDate": "<its date>"' : '"candlesKey or ohlcAsset": "<one ref>", "splitIndex": <int>, "revealToIndex": <int>') + ' },',
    '  "objective": { "kind": "process", "passScore": 70 },',
    '  "constraints": { "accountBalance": ' + req.accountBalance + ', "maxRiskPct": ' + (req.track === 'options' ? 5 : 2) + (req.track === 'options' ? ', "requireDefinedRisk": true' : ', "requireStop": true, "minRewardRisk": 1.5') + ' },',
    `  "rubricId": "${req.track === 'options' ? 'options-v1' : 'charts-v1'}",`,
    '  "nudges": [ { "id": "<nudge>" } ], "coachContextKeys": ["outcome"], "source": "llm"',
    '}',
  ].join('\n')
}

/** Extract the first balanced JSON object from a model reply (tolerates fences/prose). */
export function parseComposerJson(text: string): unknown {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No JSON object in composer reply')
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1))
    }
  }
  throw new Error('Unbalanced JSON in composer reply')
}
