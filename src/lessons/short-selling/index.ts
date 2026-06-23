import type { LessonPackage, ModuleSpec } from '../../engine/types'
import CandleChartScene from '../../engine/scenes/CandleChartScene'
import IntroFlipScene from './scenes/IntroFlipScene'
import BorrowFeeScene from './scenes/BorrowFeeScene'
import NetPnLQuizScene from './scenes/NetPnLQuizScene'
import PayoffScene from './scenes/PayoffScene'
import PayoffChallengeScene from './scenes/PayoffChallengeScene'
import MarginGaugeScene from './scenes/MarginGaugeScene'
import SqueezeLoopScene from './scenes/SqueezeLoopScene'
import SqueezeChoiceScene from './scenes/SqueezeChoiceScene'
import ManageShortScene from './scenes/ManageShortScene'
import CapstoneScene from './scenes/CapstoneScene'

/**
 * LESSON 3 — "Short Selling: Profiting When Stocks Fall" (planning/Lesson3Spec.md).
 *
 * 15 modules: INTRO · TEACH · INTERACTIVE · CHALLENGE · CAPSTONE. Real-chart modules
 * (2, 9, 11, 12, 13) reuse the frozen CandleChartScene via `candle` — module 13 in its
 * interactive `trade` mode (drag TP/SL for a short, simulate on submit). The four former
 * quizzes (4, 6, 10, 13) are now self-grading CHALLENGEs: the learner manipulates the
 * scene and onSubmit runs the sim/reveal and reports a tailored result. All P&L / fee /
 * payoff / days-to-cover math is exact; real-chart anchors are the verified values from
 * the spec; example rates/premiums are illustrative simulations.
 */
const modules: ModuleSpec[] = [
  // 1 — INTRO / INTERACTIVE
  {
    id: 1,
    type: 'intro',
    kicker: 'Short selling',
    title: 'Betting Against a Stock',
    intro:
      'You can profit when a stock FALLS — by selling shares first and buying them back cheaper later. Flip your instinct, then drag the future price and watch the meter.',
    scene: { kind: 'introFlip', params: { entry: 50, min: 0, max: 100 } },
    caption:
      "A short's profit per share is sell price − future price. Drag the price down and you win; drag it up and — notice — the loss just keeps going.",
    cta: 'Continue',
  },

  // 2 — TEACH · REAL chart (LCID lifecycle)
  {
    id: 2,
    type: 'teach',
    kicker: 'Learn · LCID',
    title: 'The Short Lifecycle: Borrow, Sell, Cover, Return',
    intro:
      'Borrow (locate) → sell now at a high price → later BUY TO COVER lower → return the borrowed shares. Profit = sell − cover per share. Real Lucid (LCID) decline.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'short_lifecycle_LCID',
        mode: 'teach',
        markers: [
          { date: '2021-11-17', price: 57.75, kind: 'sell', label: 'SELL 57.75' },
          { date: '2022-03-14', price: 21.31, kind: 'buy', label: 'COVER 21.31' },
        ],
      },
    },
    caption:
      'Borrow → sell high ($57.75) → wait as it falls → buy to cover low ($21.31) → return the shares. You keep the difference: $36.44/share × 100 = $3,644 (before borrow costs — those come next).',
  },

  // 3 — INTERACTIVE · borrow fee & margin
  {
    id: 3,
    type: 'interactive',
    kicker: 'Cost of carry',
    title: 'Borrow Fee & the Margin Account',
    intro:
      'Shorting needs a margin account: your sale cash plus extra margin is held as collateral, a daily borrow fee accrues, and you owe the lender any dividends. Tune the rate, days, and dividend.',
    scene: { kind: 'borrowFee', params: { shares: 100, sell: 50, gross: 600, divPerShare: 0.2 } },
    caption:
      'Your sale cash isn\'t free money — the broker holds it plus extra margin as collateral, charges a daily borrow fee (tiny for easy names, brutal for hard-to-borrow), and bills you for any dividends. These come out of your gross profit.',
    cta: 'Continue',
  },

  // 4 — CHALLENGE · net P&L
  {
    id: 4,
    type: 'challenge',
    kicker: 'Challenge · Net P&L',
    title: 'Did the Short Make Money?',
    intro:
      'You shorted 100 shares at $50. Drag the BUY-TO-COVER price down the axis and set the holding period — a borrow fee accrues every day and you owe $0.20/share in dividends. Watch the ledger and find a NET-profitable exit.',
    scene: {
      kind: 'netPnl',
      params: { shares: 100, sell: 50, cover: 44, borrowPerShareDay: 0.02, divPerShare: 0.2, days: 30 },
    },
    challenge: {
      prompt: 'Set a buy-to-cover and holding period that ends NET profitable.',
      instructions: 'Drag the green COVER line down the price axis; drag the days slider. The bar shows gross minus borrow fee minus dividends = your NET.',
      submitLabel: 'Close the short',
    },
    caption:
      'A short can be right on direction and still lose — borrow fees and owed dividends erode the gross. Cover far enough below entry, fast enough, that the net stays green. Always trade the net.',
  },

  // 5 — TEACH / INTERACTIVE · asymmetry
  {
    id: 5,
    type: 'teach',
    kicker: 'Learn · Asymmetry',
    title: 'The Asymmetry: Capped Gain, Unlimited Loss',
    intro:
      "A short's max gain is capped (the stock can only fall to $0 = +100%) while its max loss is theoretically unlimited (price can rise without bound). The long is the mirror. Drag the future price.",
    scene: { kind: 'payoff', params: { entry: 30, priceMax: 120, shares: 100, mode: 'teach' } },
    caption:
      'This is THE reason shorting is dangerous: the best case is the stock going to zero (+100%, and that\'s all), but the worst case has no limit — a stock can double, triple, 10×, and your loss grows right with it.',
  },

  // 6 — CHALLENGE · long vs short risk
  {
    id: 6,
    type: 'challenge',
    kicker: 'Challenge · Risk shape',
    title: 'Long vs Short: Which Risk Is Worse?',
    intro:
      'Same stock, two mirror positions opened at $30 × 100 shares: one LONG, one SHORT. Drag the future price upward and watch each P&L. The long can only lose its $3,000 stake — see how far the short can fall.',
    scene: { kind: 'payoffChallenge', params: { entry: 30, priceMax: 150, shares: 100, startPrice: 30 } },
    challenge: {
      prompt: "Push the price high enough to make the short's loss exceed the long's worst case.",
      instructions: "Drag the cursor right (price up). The long's loss is floored at −$3,000; keep going until the short blows past it.",
      submitLabel: 'Lock it in',
    },
    caption:
      "A long's worst case is −100% (you lose what you put in). A short's worst case is −∞ (price can rise forever). Same stock, opposite risk shapes — that asymmetry is why shorts demand a stop.",
  },

  // 7 — TEACH / INTERACTIVE · margin calls
  {
    id: 7,
    type: 'teach',
    kicker: 'Learn · Margin',
    title: 'Margin Calls & Forced Buy-In',
    intro:
      'Maintenance margin must hold. As price rises against a short, equity erodes toward the maintenance line; breach it and the broker issues a MARGIN CALL, then a forced BUY-IN. A lender RECALL can also force a cover. Run the path and choose.',
    scene: { kind: 'marginGauge', params: { shares: 100, entry: 30, startEquity: 1500, maintFrac: 0.3, peakPrice: 48 } },
    caption:
      'Rising price drains your equity toward the maintenance line. Cross it and the broker calls you; ignore the call and it buys you in at the market — usually the worst price. And a recall can force you out even when margin is fine.',
  },

  // 8 — TEACH / INTERACTIVE · squeeze anatomy
  {
    id: 8,
    type: 'teach',
    kicker: 'Learn · Squeeze',
    title: 'Anatomy of a Short Squeeze',
    intro:
      'A rising price forces shorts to buy to cover, which pushes price higher, forcing more covering — a reflexive spike. High short interest and days-to-cover are the fuel. Set the levers and nudge price up.',
    scene: { kind: 'squeezeLoop', params: { floatM: 50, avgVolM: 8, shortPct: 90 } },
    caption:
      'A squeeze is a feedback loop: shorts MUST buy to cover, and their buying is the very thing driving price higher, forcing still more covering. High short interest + low float + high days-to-cover = a loaded spring.',
  },

  // 9 — TEACH · REAL chart (GME)
  {
    id: 9,
    type: 'teach',
    kicker: 'Learn · GME',
    title: 'Case Study — GameStop, January 2021',
    intro:
      'A real squeeze: GME, heavily shorted (short interest reportedly over 100% of the float), spiked toward ~$483 intraday on 2021-01-28 as shorts were forced to cover.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'gme_squeeze_2021',
        mode: 'teach',
        zones: [{ fromDate: '2020-11-02', toDate: '2020-12-31', col: 'blue', label: 'Heavily shorted base' }],
        markers: [
          { date: '2021-01-13', price: 31.4, kind: 'dot', label: 'Ignition' },
          { date: '2021-01-28', price: 483.0, kind: 'sell', label: '~$483 intraday' },
        ],
      },
    },
    caption:
      'GME was the spring from Module 8 fully loaded — short interest reportedly over 100% of the float. When it ignited, shorts had to cover into a stock that barely existed to buy, and it ran to $483.00 intraday. A short near the base didn\'t lose 100% — it lost multiples of the stake.',
  },

  // 10 — CHALLENGE · squeeze or settle (read the dials, choose)
  {
    id: 10,
    type: 'challenge',
    kicker: 'Challenge · GME',
    title: 'Squeeze or Settle? Read the Setup',
    intro:
      "You're short this name. Read the dials — short interest, days-to-cover, free float — and the catalyst flag. Decide whether the spring is loaded enough to crush you, then choose SHORT IT or STEP ASIDE.",
    scene: {
      kind: 'squeezeChoice',
      params: { shortPct: 140, daysToCover: 6, floatM: 50, catalyst: true, stepAsideIsRight: true },
    },
    challenge: {
      prompt: 'Read the squeeze fuel, then choose SHORT IT or STEP ASIDE.',
      instructions: 'Tap a choice button in the scene; the dials show the fuel. Submit to reveal what the setup did.',
      submitLabel: 'Reveal the squeeze',
    },
    caption:
      'When more shares are sold short than exist to buy back, the exit door is too small for the crowd. That setup is when a smart short steps aside — being "right" on value won\'t save you from the squeeze.',
  },

  // 11 — TEACH · REAL chart (VW)
  {
    id: 11,
    type: 'teach',
    kicker: 'Learn · VW',
    title: 'Case Study — Volkswagen, October 2008',
    intro:
      'A real LOSING short: a corner/squeeze briefly made VW the world\'s most valuable company. Porsche\'s stake + options left almost no free float; the scramble to cover destroyed professional shorts.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'vw_squeeze_2008',
        mode: 'teach',
        markers: [
          { date: '2008-08-04', price: 192.3, kind: 'dot', label: 'Base €192' },
          { date: '2008-10-27', price: 635.0, kind: 'sell', label: 'Daily peak €635' },
          { date: '2009-01-14', price: 238.1, kind: 'buy', label: 'Unwound €238' },
        ],
      },
    },
    caption:
      'VW is GME thirteen years earlier: a heavily-shorted stock with almost no free float, a forced scramble to cover, and a spike so extreme it briefly made VW the most valuable company in the world (daily peak €635; documented intraday ~€1,005 on 2008-10-28). The squeeze signature is the same across eras.',
  },

  // 12 — TEACH · REAL chart (PTON winning short)
  {
    id: 12,
    type: 'teach',
    kicker: 'Learn · PTON',
    title: 'A Short That Worked',
    intro:
      'The other side of the ledger — a stock that truly fell rewards a disciplined short. Peloton (PTON) slid from the low-$90s to a $6.66 low. Sell high, cover low, pocket the decline net of borrow.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'short_winner_PTON',
        mode: 'teach',
        markers: [
          { date: '2021-11-01', price: 92.95, kind: 'dot', label: 'High 92.95' },
          { date: '2021-11-15', price: 50.0, kind: 'sell', label: 'SELL ~50' },
          { date: '2022-10-03', price: 6.66, kind: 'buy', label: 'COVER 6.66' },
        ],
      },
    },
    caption:
      'When the thesis is right and price keeps falling, a short pays — short the breakdown near $50, cover near $8, keep the decline minus borrow. The skill isn\'t just getting short; it\'s choosing the exit: too early leaves profit behind, too late lets a bounce take it back.',
  },

  // 13 — CHALLENGE · REAL chart (HOOD, masked at split; set TP/SL for the short)
  {
    id: 13,
    type: 'challenge',
    kicker: 'Challenge · HOOD',
    title: 'Will This Short Pay Off?',
    intro:
      'HOOD blew off the top — an $85 IPO-week spike on a call-option frenzy — and is rolling over, back to ~$55 by 2021-08-06. You can short here. Set a take-profit BELOW and a stop-loss ABOVE (or stay out), then watch the real candles play out. The right half is hidden.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'short_quiz_HOOD',
        mode: 'quiz',
        splitDate: '2021-08-06',
        trade: { direction: 'short', entry: 55, completes: true },
      },
    },
    challenge: {
      prompt: 'If you take the short, drag your take-profit (below) and stop-loss (above). Or stay out.',
      instructions: 'Drag the green TP line down and the red SL line up; toggle Take trade / Stay out. Submit to reveal HOOD and simulate your exit.',
      submitLabel: 'Run the short',
    },
    caption:
      'Reading a fresh chart is the whole game. A failed blow-off often keeps falling — HOOD did, $55 → ~$17 — but a short that reverses has no loss limit, so even a "winning" setup demands a stop above the spike. Your TP/SL decides what you actually keep.',
  },

  // 14 — INTERACTIVE · manage a live short
  {
    id: 14,
    type: 'interactive',
    kicker: 'Sandbox',
    title: 'Manage a Live Short',
    intro:
      'Put it together. Drag a STOP (buy-to-cover) above entry and a TARGET below, pick a path, and Run. Borrow fees nibble every day; the adverse path can margin-call or recall you. Survive with a plan.',
    scene: {
      kind: 'manageShort',
      params: { candlesKey: 'short_winner_PTON', adverseKey: 'gme_squeeze_2021', shares: 100, rate: 0.3 },
    },
    caption:
      'Now you run it: size it, set a stop above and a target below, and survive the path. Borrow fees nibble every day; an adverse path can margin-call you or get you recalled. The traders who last have a plan before the candle prints.',
    cta: 'Continue',
  },

  // 15 — CAPSTONE · scorecard
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone',
    title: "Capstone & Recap: The Short Seller's Scorecard",
    intro:
      'Recap the whole lesson — lifecycle, costs, the capped-gain / unlimited-loss asymmetry, margin/recall, and the squeeze. Then make a final SHORT / PASS call and reveal whether the short was worth taking.',
    scene: {
      kind: 'capstone',
      params: {
        candlesKey: 'short_quiz_HOOD',
        splitFrac: 0.4,
        shortInterest: 35,
        daysToCover: 1.5,
        worthShorting: true,
      },
    },
    quiz: {
      prompt: 'Was this a short worth taking?',
      options: [
        { id: 'yes', label: 'Yes — low short-interest, deteriorating name with a stop above.' },
        { id: 'no', label: 'No — this is squeeze fuel; step aside.' },
      ],
      correctId: 'yes',
      explainRight:
        'Right. Low short interest (35%) and low days-to-cover (1.5) mean little squeeze fuel; a genuinely deteriorating name with a stop above is the M12 winning-short profile. The chart followed through lower.',
      explainWrong:
        'This name has LOW squeeze fuel (35% short interest, 1.5 days-to-cover) and is genuinely deteriorating — with a stop above, a disciplined short fits. The squeeze trap (M9/M10) is high short-interest + low float + a catalyst, which this isn\'t.',
    },
    caption:
      "The short seller's edge isn't being bearish — it's discipline against an asymmetric, squeeze-prone bet: borrow and net out the carry, always keep a stop above (the downside has no floor), and step aside when the spring is loaded.",
    cta: 'Finish lesson',
  },
]

const pkg: LessonPackage = {
  lesson: {
    id: 'short-selling',
    index: 3,
    title: 'Short Selling',
    subtitle: 'Profiting When Stocks Fall',
    level: 3,
    blurb:
      'Borrow high, sell, buy back lower. Learn the mechanics, the unlimited-loss asymmetry, and the short squeeze — on real charts (GME, VW, Lucid, Peloton, Robinhood).',
    modules,
  },
  scenes: {
    candle: CandleChartScene,
    introFlip: IntroFlipScene,
    borrowFee: BorrowFeeScene,
    netPnl: NetPnLQuizScene,
    payoff: PayoffScene,
    payoffChallenge: PayoffChallengeScene,
    marginGauge: MarginGaugeScene,
    squeezeLoop: SqueezeLoopScene,
    squeezeChoice: SqueezeChoiceScene,
    manageShort: ManageShortScene,
    capstone: CapstoneScene,
  },
}

export default pkg
