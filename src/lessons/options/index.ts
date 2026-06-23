import type { LessonPackage, ModuleSpec } from '../../engine/types'
import ContractCardScene from './scenes/ContractCardScene'
import PremiumBarScene from './scenes/PremiumBarScene'
import ThetaDecayScene from './scenes/ThetaDecayScene'
import PayoffScene from './scenes/PayoffScene'
import PayoffQuadScene from './scenes/PayoffQuadScene'
import DeltaCurveScene from './scenes/DeltaCurveScene'
import ExerciseTimelineScene from './scenes/ExerciseTimelineScene'
import LeverageScene from './scenes/LeverageScene'
import CapstoneScene from './scenes/CapstoneScene'

/**
 * LESSON 4 — "Option Contracts: American Calls & Puts" (planning/Lesson4Spec.md).
 *
 * 15 modules: the right (not obligation) on 100 shares → calls vs puts → premium =
 * intrinsic + time → theta → the four hockey-stick payoffs & breakevens → the
 * writer's side → delta & leverage → exercise/assignment → a build-and-read capstone.
 *
 * INTEGRITY: underlying anchors are real plausible levels; every premium / IV / theta
 * / delta is an ILLUSTRATIVE deterministic example (labelled in-scene). All payoff,
 * breakeven, P&L and leverage MATH is exact (one source of truth: scenes/optionMath.ts).
 */
const modules: ModuleSpec[] = [
  // 1 — INTRO ---------------------------------------------------------------
  {
    id: 1,
    type: 'intro',
    kicker: 'Options · XYZ @ $100',
    title: 'A Coupon on a Stock',
    intro:
      'An option is a coupon on a stock: the RIGHT — never the obligation — to trade 100 shares at a fixed strike by a deadline. Flip CALL/PUT and drag the deadline.',
    scene: { kind: 'card', params: { variant: 'coupon', K: 100, premium: 5, days: 30 } },
    caption:
      'An option is the right (never the obligation) to BUY (call) or SELL (put) 100 shares at a fixed strike by a deadline. You pay a small premium for that right. (Premium shown is illustrative.)',
    cta: 'Got it',
  },

  // 2 — TEACH calls vs puts + ×100 -----------------------------------------
  {
    id: 2,
    type: 'teach',
    kicker: 'Teach · S ≈ $100',
    title: 'Calls vs Puts (and the ×100 Multiplier)',
    intro:
      'A CALL is the right to BUY 100 shares at K; a PUT is the right to SELL 100 shares at K. One contract = 100 shares, so a per-share premium ×100 is the dollar cost.',
    scene: { kind: 'card', params: { variant: 'compare', K: 100, premium: 3 } },
    caption:
      'Call = the right to BUY 100 shares cheap (good when the stock is high). Put = the right to SELL 100 shares dear (good when the stock is low). One contract is 100 shares, so a $3.00 premium costs $300. (Premium illustrative; the ×100 rule is exact.)',
    cta: 'Got it',
  },

  // 3 — QUIZ right not obligation ------------------------------------------
  {
    id: 3,
    type: 'quiz',
    kicker: 'Quiz · CALL K=100',
    title: 'Right, Not Obligation',
    intro:
      'You hold a CALL with strike 100. At expiry the stock is 95. The exercise fork is hidden — you decide first.',
    scene: {
      kind: 'payoff',
      params: {
        type: 'call',
        side: 'long',
        K: 100,
        premium: 4,
        sMin: 80,
        sMax: 120,
        mode: 'quiz',
        hideBreakeven: true,
        revealDots: [
          { S: 95, label: 'expire: lose premium only (−4)', good: true },
          { S: 100, label: 'exercise at 100 into 95 = overpay', good: false },
        ],
      },
    },
    quiz: {
      prompt: 'You hold a CALL, strike 100. At expiry the stock is 95. Should you exercise (buy at 100)?',
      options: [
        { id: 'yes', label: 'Yes — exercise' },
        { id: 'no', label: 'No — let it expire' },
      ],
      correctId: 'no',
      explainRight:
        'Right. Exercising would mean buying at 100 when the market is 95 — overpaying $5/share. You let it expire and lose only the premium you already paid. An option is a right, not an obligation.',
      explainWrong:
        'You should let it expire. Exercising buys at 100 into a 95 market — an instant $5/share loss on top of the premium. The cap on a long option’s loss (= the premium) exists precisely because you can decline to exercise.',
    },
    cta: 'Check',
  },

  // 4 — TEACH American vs European -----------------------------------------
  {
    id: 4,
    type: 'teach',
    kicker: 'Teach · 90-day call',
    title: 'American vs European Style',
    intro:
      'American options exercise ANYTIME to expiry; European only AT expiry. Drag the "exercise now" marker — early exercise usually forfeits time value (with two special-case exceptions).',
    scene: { kind: 'timeline', params: { variant: 'timeline', intrinsicNow: 6, timeValueNow: 2 } },
    caption:
      'American = exercise anytime; European = only at expiry. Equity options are usually American, but early exercise normally wastes time value — selling-to-close keeps it. Exceptions: a deep-ITM call before a dividend, and a deep-ITM put (to earn interest on the strike cash now). (Time-value figures illustrative; the trade-off logic is exact.)',
    cta: 'Got it',
  },

  // 5 — TEACH premium = intrinsic + time -----------------------------------
  {
    id: 5,
    type: 'teach',
    kicker: 'Teach · CALL K=100',
    title: 'Premium = Intrinsic + Time Value',
    intro:
      'Premium splits into intrinsic value + time (extrinsic) value. Call intrinsic = max(S−K,0); put intrinsic = max(K−S,0). Drag S across the strike and watch the split and moneyness.',
    scene: { kind: 'premium', params: { mode: 'interactive', type: 'call', K: 100, S: 100, premium: 3, sMin: 70, sMax: 130 } },
    caption:
      'Premium = intrinsic + time value. Intrinsic is the in-the-money part (call: max(S−K,0), put: max(K−S,0)); the rest is time value. ITM = intrinsic > 0, OTM = intrinsic 0, ATM = right at the strike. (Time-value numbers illustrative; intrinsic math exact.)',
    cta: 'Got it',
  },

  // 6 — QUIZ split the premium ---------------------------------------------
  {
    id: 6,
    type: 'quiz',
    kicker: 'Quiz · CALL K=100, S=107',
    title: 'How Much Is Real Value?',
    intro:
      'A CALL, strike 100, with the stock at 107, trades for a 9.00 premium. The split is hidden — call it before the bar splits.',
    scene: {
      kind: 'premium',
      params: { mode: 'quiz', type: 'call', K: 100, S: 107, premium: 9, quizIntrinsic: 7, quizTimeValue: 2 },
    },
    quiz: {
      prompt: 'CALL, strike 100, stock at 107, premium 9.00. What is its intrinsic value (and therefore time value)?',
      options: [
        { id: 'a', label: 'Intrinsic 9.00 (time 0.00)' },
        { id: 'b', label: 'Intrinsic 7.00 (time 2.00)' },
        { id: 'c', label: 'Intrinsic 0.00 (time 9.00)' },
      ],
      correctId: 'b',
      explainRight:
        'Correct. Call intrinsic = max(S−K,0) = max(107−100,0) = 7. The remaining 9 − 7 = 2 is time/extrinsic value — what you pay for the chance the stock climbs further before expiry.',
      explainWrong:
        'It splits 7 + 2. Intrinsic = max(107−100,0) = 7; the rest (9 − 7 = 2) is time value, which decays to zero by expiry. The whole 9 isn’t "real" value, and an ITM call isn’t all time value either.',
    },
    cta: 'Check',
  },

  // 7 — TEACH theta ---------------------------------------------------------
  {
    id: 7,
    type: 'teach',
    kicker: 'Teach · CALL K=100, S=105',
    title: 'Theta: Time Value Decays to Zero',
    intro:
      'Time value bleeds to zero by expiry — that is theta, and it speeds up near the end. Drag days-to-expiry from 60 to 0 and watch the time-value melt onto the intrinsic floor.',
    scene: { kind: 'theta', params: { K: 100, S: 105, tv0: 3, days: 60, money: 'ITM' } },
    caption:
      'Time value bleeds to zero by expiry — that’s theta, and it speeds up near the end. At expiry the option is worth exactly its intrinsic value: an OTM option becomes worthless, an ITM one is worth S−K (call) / K−S (put). (Decay curve illustrative; intrinsic-at-expiry exact.)',
    cta: 'Got it',
  },

  // 8 — TEACH long payoffs --------------------------------------------------
  {
    id: 8,
    type: 'teach',
    kicker: 'Teach · long call/put',
    title: 'Long Call & Long Put Payoffs (with Breakevens)',
    intro:
      'At expiry a long option is a hockey stick. Long-call breakeven = K + premium; long-put breakeven = K − premium; max loss either way = the premium. Drag the spot dot to read the P&L.',
    scene: {
      kind: 'payoff',
      params: { type: 'call', side: 'long', K: 100, premium: 5, sMin: 70, sMax: 130, mode: 'interactive', controls: true, spot0: 108 },
    },
    caption:
      'A long option’s most you can lose is the premium — the flat leg. The long call profits above K + premium (105); the long put profits below K − premium (95). The call’s upside is unlimited while the put’s max gain is K − premium (the stock can’t fall below 0). (Breakeven math exact; premium illustrative.)',
    cta: 'Got it',
  },

  // 9 — QUIZ breakeven ------------------------------------------------------
  {
    id: 9,
    type: 'quiz',
    kicker: 'Quiz · CALL K=50, prem 2.50',
    title: 'Find the Breakeven',
    intro:
      'You buy a CALL, strike 50, for a 2.50 premium. The breakeven marker is hidden (a "?" floats on the rising leg). Where does the stock have to be at expiry to break even?',
    scene: {
      kind: 'payoff',
      params: {
        type: 'call',
        side: 'long',
        K: 50,
        premium: 2.5,
        sMin: 40,
        sMax: 62,
        mode: 'quiz',
        hideBreakeven: true,
        revealDots: [
          { S: 50, label: 'at strike: still −2.50', good: false },
          { S: 52.5, label: 'breakeven 52.50', good: true },
        ],
      },
    },
    quiz: {
      prompt: 'You buy a CALL, strike 50, for a 2.50 premium. What stock price at expiry is your breakeven?',
      options: [
        { id: 'a', label: '47.50' },
        { id: 'b', label: '50.00' },
        { id: 'c', label: '52.50' },
      ],
      correctId: 'c',
      explainRight:
        'Correct. BE = K + premium = 50 + 2.50 = 52.50. The call is worth max(S−50,0) at expiry; you only recoup the 2.50 you paid once S − 50 = 2.50, i.e. S = 52.50.',
      explainWrong:
        'It’s 52.50 = K + premium. At 50 (the strike) intrinsic is exactly 0, so you’re still down the full 2.50 — "above the strike" is not profit. 47.50 is K − premium, the long-PUT breakeven; a call needs the stock to go up past 52.50.',
    },
    cta: 'Check',
  },

  // 10 — TEACH writer's side -----------------------------------------------
  {
    id: 10,
    type: 'teach',
    kicker: 'Teach · short call/put',
    title: "The Writer's Side: Short Call & Short Put",
    intro:
      'The writer receives the premium and takes the obligation. Short = the mirror of long across the x-axis. A short call has unlimited risk; a short put’s loss is capped at (K − premium) × 100. Drag the spot dot.',
    scene: {
      kind: 'payoff',
      params: {
        type: 'call',
        side: 'short',
        K: 100,
        premium: 5,
        sMin: 70,
        sMax: 130,
        mode: 'teach',
        showMirror: true,
        controls: true,
        spot0: 112,
      },
    },
    caption:
      'The writer collects the premium and is obligated. A short call must deliver shares no matter how high the stock climbs → unlimited risk. A short put must buy at K → loss grows as the stock falls, capped at (K − premium) × 100 ($9,500 here) since the stock can’t go below 0. Short = the mirror of long. (Premium illustrative; risk math exact.)',
    cta: 'Got it',
  },

  // 11 — QUIZ unlimited risk -----------------------------------------------
  {
    id: 11,
    type: 'quiz',
    kicker: 'Quiz · all four legs',
    title: 'Who Has Unlimited Risk?',
    intro:
      'Four single-leg positions (long/short × call/put), each at K=100, premium 5, with their loss tails fogged. Pick the one whose loss is theoretically unbounded before the fog lifts.',
    scene: { kind: 'quad', params: { K: 100, premium: 5, sMin: 60, sMax: 140 } },
    quiz: {
      prompt: 'Which single-leg option position has theoretically UNLIMITED loss?',
      options: [
        { id: 'a', label: 'Long call' },
        { id: 'b', label: 'Long put' },
        { id: 'c', label: 'Short call' },
        { id: 'd', label: 'Short put' },
      ],
      correctId: 'c',
      explainRight:
        'Correct. A naked short call is obligated to deliver 100 shares at K however high S goes; to deliver, the writer buys at an arbitrarily high market price, so loss grows without bound. There is no ceiling on a stock price.',
      explainWrong:
        'It’s the short call. A short put feels symmetric but the stock can’t fall below 0, so its worst case is bounded: (K − premium) × 100 = $9,500. Long options are capped at the premium you paid. Only the naked short call is unbounded.',
    },
    cta: 'Check',
  },

  // 12 — INTERACTIVE delta --------------------------------------------------
  {
    id: 12,
    type: 'interactive',
    kicker: 'Explore · CALL K=100',
    title: 'Value vs the Underlying (Delta)',
    intro:
      'Delta is how much the option moves per $1 in the stock — the slope of its price curve. Drag S along the curve: the tangent tilts from near-flat (OTM) to ~45° (ATM, δ≈0.5) to steep (deep-ITM, δ→1).',
    scene: {
      kind: 'delta',
      params: {
        type: 'call',
        side: 'long',
        K: 100,
        premium: 5,
        sMin: 70,
        sMax: 135,
        mode: 'interactive',
        controls: true,
        legToggles: false,
        spot0: 100,
        deltaAnchors: [
          { S: 85, delta: 0.12 },
          { S: 100, delta: 0.5 },
          { S: 110, delta: 0.75 },
          { S: 120, delta: 0.9 },
          { S: 135, delta: 0.97 },
        ],
      },
    },
    caption:
      'Delta is the slope of the option’s price curve. Deep-ITM options ≈ track the shares (δ near 1), ATM ≈ 0.5, OTM ≈ small δ — so one deep-ITM contract behaves like ~100 shares while a far-OTM one barely budges. (Delta values illustrative; slope behavior exact.)',
    cta: 'Done exploring',
  },

  // 13 — TEACH leverage -----------------------------------------------------
  {
    id: 13,
    type: 'teach',
    kicker: 'Teach · $100 stock',
    title: 'Leverage: $1 Premium, 100 Shares',
    intro:
      'The same $500 buys 5 shares of a $100 stock — or one $5.00 call controlling 100 shares. Drag the % move: the call’s % swing dwarfs the stock’s, and at/below the strike at expiry it hits −100%.',
    scene: { kind: 'leverage', params: { S0: 100, K: 100, premium: 5, budget: 500 } },
    caption:
      '$500 buys exactly 5 shares of a $100 stock — or one $5.00 call controlling 100 shares. A +10% move turns the stock’s +10% into the call’s +100%; but 0% or down turns into −100% (the whole premium). Magnified both ways — that’s leverage. (Underlying anchor real; premium illustrative; returns computed exactly.)',
    cta: 'Got it',
  },

  // 14 — QUIZ exercise/sell/expire -----------------------------------------
  {
    id: 14,
    type: 'quiz',
    kicker: 'Quiz · ITM call worth 8.00',
    title: 'Exercise, Sell, or Let It Expire?',
    intro:
      'You hold an ITM call worth 8.00 (intrinsic 6.00, time value 2.00) with a week left, and you want out now. Three action doors are closed — pick before they open.',
    scene: { kind: 'timeline', params: { variant: 'doors', intrinsicNow: 6, timeValueNow: 2 } },
    quiz: {
      prompt: 'You hold an ITM call worth 8.00 (intrinsic 6.00, time value 2.00) with a week left and want out now. Exercise or sell-to-close?',
      options: [
        { id: 'a', label: 'Exercise' },
        { id: 'b', label: 'Sell-to-close' },
        { id: 'c', label: 'Let it expire' },
      ],
      correctId: 'b',
      explainRight:
        'Correct. Selling-to-close captures the full 8.00 — including the 2.00 of time value. Exercising realizes only the 6.00 intrinsic and throws away the 2.00. Early exercise of an American option is usually suboptimal (the exception is special cases like capturing a dividend).',
      explainWrong:
        'Sell-to-close is better here. Exercising forfeits the 2.00 time value (and ties up K×100 in capital); letting it expire would waste all 8.00. Selling hands the contract to a buyer who pays for intrinsic AND the remaining time value. (At expiry an ITM option auto-exercises, an OTM one expires worthless, and shorts get assigned.)',
    },
    cta: 'Check',
  },

  // 15 — CAPSTONE -----------------------------------------------------------
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone · S ≈ $120',
    title: 'Build & Read an Option Position',
    intro:
      'Build a position (type, side, strike, premium) and read it live: breakeven, max loss, max gain, moneyness, delta. Challenge: build a bullish position with defined (capped) risk — then check the P&L at expiry.',
    scene: {
      kind: 'capstone',
      params: {
        type: 'call',
        side: 'long',
        K: 120,
        premium: 6,
        sMin: 95,
        sMax: 150,
        anchorS: 120,
        delta: 0.5,
        checkS: 130,
        spot0: 126,
      },
    },
    caption:
      'You built it and read it: a long call, strike 120, premium $6 → breakeven 126, max loss $600, max gain unlimited, ATM with δ≈0.5. Profit needs the stock above breakeven (126), not just above the strike — at 123 you’re still −$300. That one chart ties together the whole lesson. (Underlying anchor real; premium illustrative; all P&L math exact.)',
    quiz: {
      prompt: 'Your built long call (K=120, premium 6): if the stock is 130 at expiry, is it profitable, and by how much per contract?',
      options: [
        { id: 'a', label: 'Loss of $600' },
        { id: 'b', label: 'Profit of $400' },
        { id: 'c', label: 'Profit of $1,000' },
      ],
      correctId: 'b',
      explainRight:
        'Correct. P&L = (max(130−120,0) − 6) × 100 = (10 − 6) × 100 = +$400. You cleared the breakeven (126) by $4/share. Above the strike but below breakeven you’d still be down.',
      explainWrong:
        'It’s +$400. P&L = (max(S−K,0) − premium) × 100 = (10 − 6) × 100. $1,000 forgets to subtract the $6 premium; a $600 loss is the max loss, which only happens at/below the strike (S ≤ 120).',
    },
    cta: 'Check',
  },
]

const pkg: LessonPackage = {
  lesson: {
    id: 'options',
    index: 4,
    title: 'Option Contracts',
    subtitle: 'American Calls & Puts',
    level: 4,
    blurb:
      'Calls, puts, premium = intrinsic + time, the hockey-stick payoffs and exact breakevens, delta & leverage — then build and read a position yourself.',
    modules,
  },
  scenes: {
    card: ContractCardScene,
    premium: PremiumBarScene,
    theta: ThetaDecayScene,
    payoff: PayoffScene,
    quad: PayoffQuadScene,
    delta: DeltaCurveScene,
    timeline: ExerciseTimelineScene,
    leverage: LeverageScene,
    capstone: CapstoneScene,
  },
}

export default pkg
