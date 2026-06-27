import type { ScenarioSpec, Track } from './types'
import type { ScenarioLayout } from './genui/types'
import { CANDLES } from '../data/candles'

/** Length of a bundled candles series (0 when the key is unknown). */
const K = (k: string): number => CANDLES[k]?.length ?? 0

/**
 * R:R floor used as the price-lines display hint, matching the tier's rubric target.
 * Eased for new traders: a beginner only needs reward to modestly beat risk (tier 1),
 * and even the top curated tier asks for a sane, achievable ratio rather than a demanding one.
 */
const rrFor = (tier: number): number => (tier >= 3 ? 2 : tier >= 2 ? 1.5 : 1.2)

// ── Curated layouts (the offline / cold-start / AI-off showcase) ──────────────
// Every curated spec ships a rich, validated layout so AI-off play, the composer
// cold-start, and every silent fallback render a well-composed interactive scene —
// not just the bare `defaultLayoutFor` shim. Each builder scales its composition by
// tier and binds widgets to the spec's REAL data via the WS-B providers (no widget
// carries its own dataRef, so nothing can drift from the catalog). All copy is
// number-free + claim-free so each layout passes `validateLayout`. The widget mixes
// here are the cold-start variety GPT-5.5 later expands on.

/**
 * Charts: `price-lines` draws its own chart, so we never add a standalone
 * `candle-chart` (WS-E drops it anyway to avoid a double chart). Tier scales the
 * composition: clean entry → add a structural read → add explicit discipline gates.
 */
function chartsLayout(tier: number): ScenarioLayout {
  const layout: ScenarioLayout = [
    {
      id: 'framing',
      kind: 'narrative',
      config: {
        heading: 'The setup',
        body: 'Here is real price action up to the moment you decide. Take your time. If the chart gives you a clear reason to trade, plan your risk first and go. If it does not, skipping is a perfectly good choice.',
      },
    },
  ]
  if (tier >= 2) {
    layout.push(
      {
        id: 'news',
        kind: 'news-headline',
        config: {
          headline: 'The market has been choppy lately',
          source: 'Market Wire',
          body: 'This is just background. It is a reason to be patient, not a reason to jump in.',
        },
      },
      {
        id: 'read',
        kind: 'multiple-choice',
        config: {
          prompt: 'What is the chart mostly doing right now?',
          options: [
            { id: 'trend', label: 'Heading in one direction' },
            { id: 'range', label: 'Going sideways' },
            { id: 'reversal', label: 'Maybe turning around' },
            { id: 'noread', label: 'Hard to tell' },
          ],
        },
      },
    )
  }
  layout.push(
    { id: 'direction', kind: 'direction-choice', config: { prompt: 'Take it or skip it?', allowed: ['long', 'short', 'skip'] } },
    { id: 'levels', kind: 'price-lines', config: { require: ['entry', 'stop', 'target'], minRR: rrFor(tier) } },
  )
  if (tier >= 3) {
    layout.push({ id: 'risk', kind: 'risk-slider', config: { minPct: 0.25, maxPct: 3, step: 0.25 } })
  }
  layout.push({ id: 'size', kind: 'size-slider', config: { min: 1, max: 10000, step: 1, unit: 'shares' } })
  if (tier >= 3) {
    layout.push({
      id: 'checks',
      kind: 'checklist',
      config: {
        items: [
          { id: 'risk-defined', label: 'I know where I will get out if I am wrong' },
          { id: 'reward', label: 'The reward is bigger than what I am risking' },
          { id: 'size-fits', label: 'My size is small enough to be comfortable' },
        ],
      },
    })
  }
  layout.push({ id: 'conf', kind: 'confidence', config: { prompt: 'How confident are you in this read?' } })
  return layout
}

/**
 * Options: framing + the real underlying chart + a defined-risk leg builder + its live
 * payoff preview. Tier adds an event headline, a thesis pick, a checklist, and a
 * confidence read. `payoff-graph.source` references the `option-leg-builder` widget id.
 */
function optionsLayout(tier: number): ScenarioLayout {
  const layout: ScenarioLayout = [
    {
      id: 'framing',
      kind: 'narrative',
      config: {
        heading: 'Build the position',
        body: 'Build a position where you know the most you can lose before you start. Pick a simple structure from the real options listed so your worst case stays small and capped.',
      },
    },
  ]
  if (tier >= 2) {
    layout.push({
      id: 'news',
      kind: 'news-headline',
      config: {
        headline: 'A big news event is coming up',
        source: 'Options Desk',
        body: 'Option prices tend to get more expensive around events like this. How you build the position matters more than guessing the direction.',
      },
    })
  }
  if (tier >= 3) {
    layout.push({
      id: 'thesis',
      kind: 'multiple-choice',
      config: {
        prompt: 'What is your main idea here?',
        options: [
          { id: 'directional', label: 'I lean gently one way' },
          { id: 'premium', label: 'I think it stays calm and rangebound' },
          { id: 'vol', label: 'I expect a big move either way' },
        ],
      },
    })
  }
  layout.push(
    { id: 'chart', kind: 'candle-chart', config: { showVolume: false } },
    { id: 'legs', kind: 'option-leg-builder', config: { maxLegs: tier >= 2 ? 4 : 2, requireDefinedRisk: true } },
    { id: 'payoff', kind: 'payoff-graph', config: { source: 'legs' } },
  )
  if (tier >= 2) {
    layout.push({
      id: 'checks',
      kind: 'checklist',
      config: {
        items: [
          { id: 'max-loss', label: 'I know the most I can lose' },
          { id: 'budget', label: 'This fits my risk budget' },
          { id: 'strikes', label: 'My strikes and timing match my idea' },
        ],
      },
    })
  }
  if (tier >= 3) {
    layout.push({ id: 'conf', kind: 'confidence', config: { prompt: 'How confident are you in this structure?' } })
  }
  return layout
}

/**
 * Market-making: framing + the real mid-path chart + a two-sided quote ladder. Tier
 * adds a regime pick, a discipline checklist, and (at the top tier) a one-way-flow
 * headline — the inventory/adverse-selection lesson. Confidence closes every session.
 */
function marketMakingLayout(tier: number): ScenarioLayout {
  const layout: ScenarioLayout = [
    {
      id: 'framing',
      kind: 'narrative',
      config: {
        heading: 'Make the market',
        body: 'Set a price to buy at and a price to sell at, and try to earn the small gap between them. Keep an eye on how much you end up holding as the price moves.',
      },
    },
  ]
  if (tier >= 3) {
    layout.push({
      id: 'news',
      kind: 'news-headline',
      config: {
        headline: 'Today the price keeps pushing one way',
        source: 'Trading Floor',
        body: 'When everyone trades in one direction, you can end up holding a lot against the move. Staying disciplined about how much you hold matters more than filling every order.',
      },
    })
  }
  layout.push(
    { id: 'chart', kind: 'candle-chart', config: { showVolume: false } },
    { id: 'quotes', kind: 'quote-ladder', config: { levels: tier >= 2 ? 2 : 1, maxInventoryHint: 500 } },
  )
  if (tier >= 2) {
    layout.push(
      {
        id: 'regime',
        kind: 'multiple-choice',
        config: {
          prompt: 'What kind of session does this look like?',
          options: [
            { id: 'quiet', label: 'Calm and quiet' },
            { id: 'choppy', label: 'Choppy, going both ways' },
            { id: 'trend', label: 'Pushing one direction' },
          ],
        },
      },
      {
        id: 'checks',
        kind: 'checklist',
        config: {
          items: [
            { id: 'spread', label: 'My buy/sell gap fits how much the price is moving' },
            { id: 'cap', label: 'I am not letting myself hold too much' },
            { id: 'both', label: 'I am quoting both a buy and a sell price' },
          ],
        },
      },
    )
  }
  layout.push({ id: 'conf', kind: 'confidence', config: { prompt: 'How comfortable are you with this quote?' } })
  return layout
}

/**
 * Build a curated charts scenario over a real bundled window. `splitIndex` sits at
 * ~60% so the learner decides on real price action and the hidden remainder resolves
 * the trade; `revealToIndex` runs to the end of the series. Tier scales the required
 * reward:risk (and, in M4, adaptive selection), never the P&L odds.
 */
function chartsSpec(
  id: string,
  tier: number,
  candlesKey: string,
  over: Partial<ScenarioSpec> = {},
): ScenarioSpec {
  const len = K(candlesKey)
  return {
    id,
    track: 'charts',
    tier,
    title: 'Take it or skip it?',
    brief:
      'Here is real price action leading up to a decision point. If the setup looks sound, plan your trade — your size, a stop in case you are wrong, and a target. If it does not, staying out is a perfectly good choice.',
    dataRef: { candlesKey, splitIndex: Math.max(1, Math.floor(len * 0.6)), revealToIndex: len },
    objective: { kind: 'process', passScore: 60 },
    constraints: {
      accountBalance: 10000,
      maxRiskPct: 2,
      requireStop: true,
      // Complexity scales with tier (rubric R:R target), never the market odds. Targets are
      // kept gentle so a beginner who manages risk sensibly is not failed on the ratio alone.
      minRewardRisk: tier >= 3 ? 2 : tier >= 2 ? 1.5 : 1.2,
    },
    rubricId: 'charts-v1',
    nudges: [{ id: 'sizing' }, { id: 'no-stop' }],
    coachContextKeys: ['outcome', 'exit', 'netMove'],
    source: 'curated',
    layout: chartsLayout(tier),
    ...over,
  }
}

/**
 * Build a curated options scenario over a REAL chain snapshot. The learner builds a
 * (multi-leg) defined-risk position from the snapshot's real premiums/IV/greeks; time
 * advances over the real underlying and P&L resolves with exact expiry math. `chainAsset`
 * must exist under public/data/options and its date must appear in options-manifest.json.
 * Tier scales structural complexity (single-leg → spreads → tighter management), never odds.
 */
function optionsSpec(id: string, tier: number, chainAsset: string, decisionDate: string, brief: string): ScenarioSpec {
  return {
    id,
    track: 'options',
    tier,
    title: 'Build a defined-risk position',
    brief,
    dataRef: { chainAsset, decisionDate },
    objective: { kind: 'process', passScore: 60 },
    constraints: { accountBalance: 10000, maxRiskPct: 5, requireDefinedRisk: true },
    rubricId: 'options-v1',
    nudges: [{ id: 'undefined-risk' }, { id: 'sizing' }],
    coachContextKeys: ['sExpiry', 'modelEstimate'],
    illustrativeFlags: ['plToday'],
    source: 'curated',
    layout: optionsLayout(tier),
  }
}

/**
 * Curated catalog. M1 ships the first fully-playable track (charts) with ≥10 scenarios
 * across tiers 1–3, each referencing a real bundled OHLC window. M2 (options) and M5
 * (market-making) extend this array. Every entry MUST pass validateSpec — enforced by
 * scenarioRegistry.test.ts.
 */
export const SCENARIOS: ScenarioSpec[] = [
  // Tier 1 — clean, single-setup windows.
  chartsSpec('charts-t1-01', 1, 'asctri_quiz_AMD'),
  chartsSpec('charts-t1-02', 1, 'bearflag_quiz_TSLA'),
  chartsSpec('charts-t1-03', 1, 'pltr_2024'),
  chartsSpec('charts-t1-04', 1, 'nvda_2023'),
  // Tier 2 — longer, more ambiguous structures.
  chartsSpec('charts-t2-01', 2, 'cupHandle_quiz_DIS'),
  chartsSpec('charts-t2-02', 2, 'db_quiz_SNAP'),
  chartsSpec('charts-t2-03', 2, 'hs_quiz_META'),
  chartsSpec('charts-t2-04', 2, 'gme_squeeze_2021'),
  // Tier 3 — reversals + volatile regimes.
  chartsSpec('charts-t3-01', 3, 'dt_quiz_NFLX'),
  chartsSpec('charts-t3-02', 3, 'ihs_quiz_NVDA'),
  chartsSpec('charts-t3-03', 3, 'triple_bottom_quiz_DIS'),
  chartsSpec('charts-t3-04', 3, 'vw_squeeze_2008'),
].filter((s) => (s.dataRef.candlesKey ? K(s.dataRef.candlesKey) > 5 : true))

// --- Track C (options) curated catalog — ≥8 specs over real chain snapshots ---------
SCENARIOS.push(
  // Tier 1 — single-leg / simple verticals on liquid names.
  optionsSpec('opt-t1-01', 1, 'data/options/DIS__2021-02-17.json', '2021-02-17',
    'You think DIS holds up or drifts higher into spring. Build a position where the most you can lose is small and known from the very start.'),
  optionsSpec('opt-t1-02', 1, 'data/options/AAPL__2021-04-16.json', '2021-04-16',
    'You think AAPL drifts higher, but you want to limit your downside. Build a position whose largest possible loss is fixed before you begin.'),
  optionsSpec('opt-t1-03', 1, 'data/options/MSFT__2023-02-17.json', '2023-02-17',
    'You think MSFT stays calm and in a range. Build a steady position that can earn a little, with a loss that stays capped and inside your budget.'),
  // Tier 2 — spreads with strike/expiry tradeoffs.
  optionsSpec('opt-t2-01', 2, 'data/options/JPM__2021-06-16.json', '2021-06-16',
    'You think JPM stays above support. Sell premium with a vertical spread: pick a sane short delta and define the loss with a long wing.'),
  optionsSpec('opt-t2-02', 2, 'data/options/BAC__2020-08-17.json', '2020-08-17',
    'BAC has been choppy. Build a two-leg spread that profits from a modest move while capping the downside — mind the breakevens.'),
  optionsSpec('opt-t2-03', 2, 'data/options/NVDA__2023-08-16.json', '2023-08-16',
    'NVDA carries rich IV. Take a defined-risk view on direction and choose strikes/expiry that respect the premium you pay or collect.'),
  // Tier 3 — higher-vol names, tighter management.
  optionsSpec('opt-t3-01', 3, 'data/options/AMZN__2023-02-17.json', '2023-02-17',
    'AMZN is volatile here. Build a defined-risk spread, then decide how to manage it — holding to expiry is exact; closing early is a model estimate.'),
  optionsSpec('opt-t3-02', 3, 'data/options/TSLA__2022-09-16.json', '2022-09-16',
    'TSLA can swing hard. Size a capped-loss structure conservatively and plan your management before the move happens.'),
  optionsSpec('opt-t3-03', 3, 'data/options/NFLX__2022-11-16.json', '2022-11-16',
    'NFLX premiums are fat. Express a thesis with a spread whose reward-to-risk is sane, and keep the position within your risk budget.'),
)

/**
 * Build a curated market-making scenario over a REAL bundled window. The mid path is the
 * series' close prices (honest); the order flow is a deterministic, labelled illustrative
 * simulation calibrated to that path's realized volatility (`illustrativeFlags: ['orderFlow']`).
 * Tier scales the lesson — quiet range → choppier vol → a trend where inventory/adverse
 * selection bites — never the P&L odds. Every entry must pass validateSpec.
 */
function marketMakingSpec(
  id: string,
  tier: number,
  candlesKey: string,
  title: string,
  brief: string,
  over: Partial<ScenarioSpec> = {},
): ScenarioSpec {
  return {
    id,
    track: 'market-making',
    tier,
    title,
    brief,
    dataRef: { candlesKey },
    objective: { kind: 'process', passScore: 60 },
    constraints: { accountBalance: 10000, maxRiskPct: 5 },
    rubricId: 'market-making-v1',
    nudges: [{ id: 'spread-too-tight' }, { id: 'inventory-runaway' }],
    coachContextKeys: ['spreadCaptured', 'adverseSelection', 'finalInventory', 'sigma'],
    illustrativeFlags: ['orderFlow'],
    source: 'curated',
    layout: marketMakingLayout(tier),
    ...over,
  }
}

// --- Track B (market-making) curated catalog — tiers 1–3 over real bundled windows ---
SCENARIOS.push(
  // Tier 1 — calm, range-bound: earn the spread, keep inventory near flat.
  marketMakingSpec('mm-t1-01', 1, 'asctri_quiz_AMD', 'Make a market in a quiet session',
    'A calm, quiet name. Set a buy price and a sell price, earn the small gap between them, and try not to end up holding much in either direction.'),
  marketMakingSpec('mm-t1-02', 1, 'pltr_2024', 'Quote both sides in a quiet tape',
    'Price is drifting gently. Choose how far below and above the middle to set your buy and sell prices, pick how much to trade, and cap how much you are willing to hold.'),
  // Tier 2 — choppier vol: spread sizing matters more.
  marketMakingSpec('mm-t2-01', 2, 'cupHandle_quiz_DIS', 'Size your spread to the volatility',
    'Things are choppier here. If your buy/sell gap is too small you will get run over; too wide and you will barely trade. Match the gap to how much the price is moving, and keep quoting both sides.'),
  marketMakingSpec('mm-t2-02', 2, 'hs_quiz_META', 'Earn the spread without overstaying',
    'Moderate volatility with swings both ways. Quote both sides, size to the move, and keep your inventory cap sane relative to your account.'),
  // Tier 3 — a trending session: inventory + adverse-selection management is the lesson.
  marketMakingSpec('mm-t3-01', 3, 'gme_squeeze_2021', 'Manage inventory through a trend',
    'A strong one-way run. Steady one-direction trading can leave you holding a lot against the move — manage how much you hold so it does not wipe out the gap you earned.'),
  marketMakingSpec('mm-t3-02', 3, 'vw_squeeze_2008', 'Survive a violent move',
    'A violent, trending regime. Keep quoting both sides but respect your inventory cap — the lesson here is discipline, not printing green.'),
)

export const allTracks: Track[] = ['charts', 'options', 'market-making']

// ── Procedural variety (charts + market-making) ──────────────────────────────
// The offline / cold-start / LLM-fallback engine of NEAR-INFINITE scenarios: a random
// real instrument × a random sub-window × tier framing. Because every series can be
// sliced into many distinct windows (and there are dozens of series), the learner never
// runs out — even with the LLM cold or disabled. Options stays on its curated chain pool
// (variety there needs more snapshots / the LLM, which picks across the full corpus).

/** A window needs enough bars to carve a readable setup + a resolution tail. */
const PROC_MIN_BARS = 30
/** Bundled series long enough to window. Computed once. */
const PROC_KEYS: string[] = Object.keys(CANDLES).filter((k) => K(k) >= PROC_MIN_BARS)

const pick = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)]
const rid = (rng: () => number): string => Math.floor(rng() * 1e9).toString(36)

/** Choose a random in-bounds sub-window [start, start+windowLen) of a `len`-bar series. */
function pickWindow(len: number, rng: () => number): { start: number; windowLen: number } {
  const maxW = Math.min(len, 160)
  const minW = Math.min(len, 60)
  const windowLen = maxW <= minW ? maxW : minW + Math.floor(rng() * (maxW - minW + 1))
  const start = len <= windowLen ? 0 : Math.floor(rng() * (len - windowLen + 1))
  return { start, windowLen }
}

const MM_TITLES = ['Make the market', 'Quote both sides', 'Earn the spread', 'Hold a two-sided market']
const MM_BRIEF =
  'Set a price to buy at and a price to sell at over a real session. Try to earn the small gap between them while keeping an eye on how much you end up holding as the price moves.'

/**
 * Build a fresh procedural scenario for charts / market-making over a random real window.
 * Deterministic given `rng` (seedable for tests); defaults to `Math.random` for live play.
 */
export function proceduralSpec(
  track: 'charts' | 'market-making',
  tier: number,
  rng: () => number = Math.random,
): ScenarioSpec {
  if (!PROC_KEYS.length) {
    // Degenerate corpus (shouldn't happen): fall back to a curated spec for the track.
    const pool = scenariosFor(track, tier).length ? scenariosFor(track, tier) : scenariosFor(track)
    return pool[0]
  }
  const candlesKey = pick(PROC_KEYS, rng)
  const len = K(candlesKey)
  const { start, windowLen } = pickWindow(len, rng)

  if (track === 'market-making') {
    return marketMakingSpec(`proc-mm-t${tier}-${rid(rng)}`, tier, candlesKey, pick(MM_TITLES, rng), MM_BRIEF, {
      dataRef: { candlesKey, startIndex: start, revealToIndex: windowLen },
    })
  }

  const split = Math.min(windowLen - 2, Math.max(2, Math.floor(windowLen * (0.55 + rng() * 0.12))))
  return chartsSpec(`proc-charts-t${tier}-${rid(rng)}`, tier, candlesKey, {
    dataRef: { candlesKey, startIndex: start, splitIndex: split, revealToIndex: windowLen },
  })
}

export function getScenario(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export function scenariosFor(track: Track, tier?: number): ScenarioSpec[] {
  return SCENARIOS.filter((s) => s.track === track && (tier === undefined || s.tier === tier))
}
