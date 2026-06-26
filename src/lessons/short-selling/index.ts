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
      'Normally you buy low, then sell high. A short flips it: you sell first, then buy back later — and keep the drop. Drag the future price and watch your profit.',
    scene: { kind: 'introFlip', params: { entry: 50, min: 0, max: 100 } },
    caption:
      'You win when the price falls. Drag it down and you profit — but drag it up and the loss just keeps growing.',
    cta: 'Continue',
  },

  // 2 — TEACH · REAL chart (LCID lifecycle)
  {
    id: 2,
    type: 'teach',
    kicker: 'Learn · LCID',
    title: 'The Short Lifecycle: Borrow, Sell, Cover, Return',
    intro:
      'A short has four steps: borrow the shares, sell them high, later buy them back lower (this is called covering), and return them. You keep the gap. Here is a real Lucid (LCID) slide.',
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
      'Sold at $57.75, bought back at $21.31. That $36.44 gap × 100 shares = $3,644 — before borrow costs, which come next.',
  },

  // 3 — INTERACTIVE · borrow fee & margin
  {
    id: 3,
    type: 'interactive',
    kicker: 'Cost of carry',
    title: 'Borrow Fee & the Margin Account',
    intro:
      'Shorting is not free. The broker locks up your cash as a deposit, then charges a small daily fee to rent the shares — plus any dividend they owe. Move the dials and watch your profit shrink.',
    scene: { kind: 'borrowFee', params: { shares: 100, sell: 50, gross: 600, divPerShare: 0.2 } },
    caption:
      'The fee is tiny for easy-to-borrow stocks but brutal for hard-to-borrow ones. Every day you hold, borrow fees and owed dividends eat into your profit.',
    cta: 'Continue',
  },

  // 4 — CHALLENGE · net P&L
  {
    id: 4,
    type: 'challenge',
    kicker: 'Challenge · Net P&L',
    title: 'Did the Short Make Money?',
    intro:
      'You shorted 100 shares at $50. Pick where you buy back and how long you hold. Fees add up every day — find an exit that still profits after costs.',
    scene: {
      kind: 'netPnl',
      params: { shares: 100, sell: 50, cover: 44, borrowPerShareDay: 0.02, divPerShare: 0.2, days: 30 },
    },
    challenge: {
      prompt: 'Find a buy-back price and holding time that still profits after costs.',
      instructions: 'Drag the green COVER line down, and slide the days left or right. The bar shows your profit after fees.',
      submitLabel: 'Close the short',
    },
    caption:
      'A short can be right about the drop and still lose money — fees eat the profit. Cover low enough, and fast enough, to stay green.',
  },

  // 5 — TEACH / INTERACTIVE · asymmetry
  {
    id: 5,
    type: 'teach',
    kicker: 'Learn · Asymmetry',
    title: 'The Asymmetry: Capped Gain, Unlimited Loss',
    intro:
      'A short can only win so much — a stock can fall to $0 and no further. But its loss has no limit, because the price can keep rising. Drag the price to feel the difference.',
    scene: { kind: 'payoff', params: { entry: 30, priceMax: 120, shares: 100, mode: 'teach' } },
    caption:
      'Best case, the stock hits zero (a capped +100%). Worst case, it climbs with no limit — and your loss climbs with it. That one-sided risk is what makes shorting dangerous.',
  },

  // 6 — CHALLENGE · long vs short risk
  {
    id: 6,
    type: 'challenge',
    kicker: 'Challenge · Risk shape',
    title: 'Long vs Short: Which Risk Is Worse?',
    intro:
      'Same stock, two bets at $30 × 100 shares: one long, one short. Drag the price up and watch each loss. The long can only lose its $3,000 — see how far the short can sink.',
    scene: { kind: 'payoffChallenge', params: { entry: 30, priceMax: 150, shares: 100, startPrice: 30 } },
    challenge: {
      prompt: 'Push the price high enough that the short loses more than the long ever could.',
      instructions: "Drag right to push the price up. The long's loss stops at −$3,000; keep going until the short blows past it.",
      submitLabel: 'Lock it in',
    },
    caption:
      'A long can only lose what you put in. A short can lose far more, because the price can keep rising. That is why every short needs a stop.',
  },

  // 7 — TEACH / INTERACTIVE · margin calls
  {
    id: 7,
    type: 'teach',
    kicker: 'Learn · Margin',
    title: 'Margin Calls & Forced Buy-In',
    intro:
      'Your account must keep a minimum cushion. As the price rises against you, that cushion shrinks. Cross the line and the broker issues a MARGIN CALL: add cash, or get bought back in. Run the path and choose.',
    scene: { kind: 'marginGauge', params: { shares: 100, entry: 30, startEquity: 1500, maintFrac: 0.3, peakPrice: 48 } },
    caption:
      'Ignore a margin call and the broker buys you back in — usually at the worst price. A lender can also recall the shares at any time, forcing you out.',
  },

  // 8 — TEACH / INTERACTIVE · squeeze anatomy
  {
    id: 8,
    type: 'teach',
    kicker: 'Learn · Squeeze',
    title: 'Anatomy of a Short Squeeze',
    intro:
      'When the price rises, shorts must buy back to limit losses — and that buying pushes the price even higher, forcing more buying. Move the sliders and nudge the price up to set it off.',
    scene: { kind: 'squeezeLoop', params: { floatM: 50, avgVolM: 8, shortPct: 90 } },
    caption:
      'A squeeze feeds itself: covering pushes the price up, which forces more covering. The more shares sold short, and the fewer left to buy, the worse it gets.',
  },

  // 9 — TEACH · REAL chart (GME)
  {
    id: 9,
    type: 'teach',
    kicker: 'Learn · GME',
    title: 'Case Study — GameStop, January 2021',
    intro:
      'A real squeeze. So many traders were short GME — more than 100% of its shares — that when it turned up, they were forced to buy back, spiking it toward ~$483 on 2021-01-28.',
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
      'More shares were short than existed to buy. When it ignited, shorts had to chase a stock that barely traded — straight to $483. A short near the bottom lost several times their stake.',
  },

  // 10 — CHALLENGE · squeeze or settle (read the dials, choose)
  {
    id: 10,
    type: 'challenge',
    kicker: 'Challenge · GME',
    title: 'Squeeze or Settle? Read the Setup',
    intro:
      "You're short this stock. Check the three dials — short interest, days-to-cover, and float — plus the catalyst. Then choose: SHORT IT or STEP ASIDE.",
    scene: {
      kind: 'squeezeChoice',
      params: { shortPct: 140, daysToCover: 6, floatM: 50, catalyst: true, stepAsideIsRight: true },
    },
    challenge: {
      prompt: 'Read the dials, then choose SHORT IT or STEP ASIDE.',
      instructions: 'Tap a choice in the scene, then Submit to see what happened.',
      submitLabel: 'Reveal the squeeze',
    },
    caption:
      "When more shares are short than there are to buy back, the exit is too small for the crowd. Being right on value won't save you — a smart short steps aside.",
  },

  // 11 — TEACH · REAL chart (VW)
  {
    id: 11,
    type: 'teach',
    kicker: 'Learn · VW',
    title: 'Case Study — Volkswagen, October 2008',
    intro:
      'Another real squeeze. Porsche had quietly bought up most of VW, leaving almost no shares to trade. When shorts scrambled to buy back, even the pros got crushed.',
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
      'Same story as GME, 13 years earlier: heavy shorting, almost no shares to buy, and a spike so wild VW briefly became the world\u2019s most valuable company (daily peak €635, intraday ~€1,005).',
  },

  // 12 — TEACH · REAL chart (PTON winning short)
  {
    id: 12,
    type: 'teach',
    kicker: 'Learn · PTON',
    title: 'A Short That Worked',
    intro:
      'Shorts win when a stock really falls. Peloton (PTON) slid from the low $90s to under $7. Sell high, buy back low, keep the drop.',
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
      "Sell near $50, buy back near $8, keep the difference. The hard part isn't getting short — it's picking the exit: too early leaves profit behind, too late gives it back.",
  },

  // 13 — CHALLENGE · REAL chart (HOOD, masked at split; set TP/SL for the short)
  {
    id: 13,
    type: 'challenge',
    kicker: 'Challenge · HOOD',
    title: 'Will This Short Pay Off?',
    intro:
      'HOOD spiked to $85 in its first week, then started rolling over (~$55 now). You can short here. Set a take-profit below and a stop-loss above — or stay out. Then watch it play out.',
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
      prompt: 'Set your take-profit (below) and stop-loss (above) — or stay out.',
      instructions: 'Drag the green take-profit line down and the red stop-loss line up. Submit to reveal what HOOD did.',
      submitLabel: 'Run the short',
    },
    caption:
      'A failed spike often keeps falling — HOOD did, $55 → ~$17. But a short can turn against you with no limit, so always keep a stop above.',
  },

  // 14 — INTERACTIVE · manage a live short
  {
    id: 14,
    type: 'interactive',
    kicker: 'Sandbox',
    title: 'Manage a Live Short',
    intro:
      'Put it all together. Set a stop above your entry and a target below, pick a path, and run it. Fees tick every day, and a bad path can margin-call or recall you.',
    scene: {
      kind: 'manageShort',
      params: { candlesKey: 'short_winner_PTON', adverseKey: 'gme_squeeze_2021', shares: 100, rate: 0.3 },
    },
    caption:
      'Set a stop and a target, then survive the path. The traders who last always have a plan before the candle prints.',
    cta: 'Continue',
  },

  // 15 — CAPSTONE · scorecard
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone',
    title: "Capstone & Recap: The Short Seller's Scorecard",
    intro:
      'A quick recap: borrow-sell-cover-return, the costs, the capped-gain / unlimited-loss shape, margin and recall, and the squeeze. Then make one last call — SHORT or PASS.',
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
        { id: 'yes', label: 'Yes — low short interest, a fading company, and a stop set above.' },
        { id: 'no', label: 'No — this is squeeze fuel; step aside.' },
      ],
      correctId: 'yes',
      explainRight:
        'Right. Low short interest (35%) and low days-to-cover (1.5) mean little squeeze risk. A fading company, shorted with a stop above, is a clean setup — and it did keep falling.',
      explainWrong:
        "Not quite. With low short interest (35%) and low days-to-cover (1.5), there's little squeeze risk here, and the company is fading — a stop above makes this a fair short. The squeeze trap needs high short interest, a thin float, and a catalyst, which this setup doesn't have.",
    },
    caption:
      "A short seller's edge isn't being bearish — it's discipline: subtract the fees, always keep a stop above, and step aside when too many shorts crowd the exit.",
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
