import type { LessonPackage, ModuleSpec } from '../../engine/types'
import ContractCardScene from './scenes/ContractCardScene'
import PremiumBarScene from './scenes/PremiumBarScene'
import ThetaDecayScene from './scenes/ThetaDecayScene'
import PayoffScene from './scenes/PayoffScene'
import PositionBuilderScene from './scenes/PositionBuilderScene'
import DeltaCurveScene from './scenes/DeltaCurveScene'
import ExerciseTimelineScene from './scenes/ExerciseTimelineScene'
import LeverageScene from './scenes/LeverageScene'
import CapstoneScene from './scenes/CapstoneScene'

/**
 * LESSON 4 — "Option Contracts: American Calls & Puts" (planning/Lesson4Spec.md).
 *
 * 15 modules: the right (not obligation) on 100 shares → calls vs puts → premium =
 * intrinsic + time → theta → exercise style & the exercise/sell/expire decision → the
 * four hockey-stick payoffs & breakevens → the writer's side → delta & leverage → a
 * build-and-read capstone. Premium anatomy (intrinsic/time, theta) comes BEFORE the
 * exercise modules so "early exercise forfeits time value" already has its terms.
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
      'An option is a coupon on a stock: for a small fee, you get the right — never the obligation — to trade 100 shares at a set price before a deadline.',
    scene: { kind: 'card', params: { variant: 'coupon', K: 100, premium: 5, days: 30 } },
    caption:
      'A call is the right to BUY; a put is the right to SELL. You can always walk away — the most you lose is the small fee you paid (the premium).',
    cta: 'Got it',
  },

  // 2 — TEACH calls vs puts + ×100 -----------------------------------------
  {
    id: 2,
    type: 'teach',
    kicker: 'Teach · calls vs puts',
    title: 'Calls, Puts, and the ×100 Rule',
    intro:
      'A call lets you buy; a put lets you sell. One contract always covers 100 shares — so a $3 premium really costs $300.',
    scene: { kind: 'card', params: { variant: 'compare', K: 100, premium: 3 } },
    caption:
      'Buy a call when you think the stock will rise; buy a put when you think it will fall. Always multiply the premium by 100 to see the real cost.',
    cta: 'Got it',
  },

  // 3 — CHALLENGE right not obligation -------------------------------------
  {
    id: 3,
    type: 'challenge',
    kicker: 'Challenge · right, not obligation',
    title: 'Right, Not Obligation',
    intro:
      'Your call lets you buy the stock at $100 — but the stock is only worth $95. Would you really pay $100 for it?',
    scene: {
      kind: 'payoff',
      params: {
        type: 'call',
        side: 'long',
        K: 100,
        premium: 4,
        sMin: 80,
        sMax: 120,
        mode: 'challenge',
        challenge: 'exercise',
        expiryS: 95,
        hideBreakeven: true,
        hideRiskBadge: true,
      },
    },
    challenge: {
      prompt: 'The stock is $95 and your call lets you buy at $100. What do you do?',
      instructions: 'Tap EXERCISE or LET EXPIRE, then Submit.',
      submitLabel: 'Settle',
    },
  },

  // 4 — TEACH premium = intrinsic + time -----------------------------------
  {
    id: 4,
    type: 'teach',
    kicker: 'Teach · what makes the price',
    title: 'Price = Real Value + Time Value',
    intro:
      "An option's price has two parts: real value (what it's worth right now) plus time value (extra you pay for the chance it grows). Drag the stock price and watch the split.",
    scene: { kind: 'premium', params: { mode: 'interactive', type: 'call', K: 100, S: 100, premium: 3, sMin: 70, sMax: 130 } },
    caption:
      "Like a concert ticket: part of the price is face value (real worth) and part is the scalper's markup (the hope you pay for). When the stock is below the strike, a call has no real value yet — it's all time value.",
    cta: 'Got it',
  },

  // 5 — CHALLENGE split the premium ----------------------------------------
  {
    id: 5,
    type: 'challenge',
    kicker: 'Challenge · real vs time value',
    title: 'How Much Is Real Value?',
    intro:
      'A call to buy at $100 costs $9, and the stock is already $107. How much of that $9 is real value you could cash in today?',
    scene: {
      kind: 'premium',
      params: { mode: 'challenge', type: 'call', K: 100, S: 107, premium: 9 },
    },
    challenge: {
      prompt: 'Split the $9: how much is real value, and how much is time value?',
      instructions: 'Drag the divider — below it is real value, above it is time value — then Submit.',
      submitLabel: 'Split it',
    },
  },

  // 6 — TEACH theta ---------------------------------------------------------
  {
    id: 6,
    type: 'teach',
    kicker: 'Teach · time decay',
    title: 'Time Value Melts Away (Theta)',
    intro:
      'Time value melts like an ice cube — slowly at first, then faster as the deadline nears. Drag the days left and watch it melt.',
    scene: { kind: 'theta', params: { K: 100, S: 105, tv0: 3, days: 60, money: 'ITM' } },
    caption:
      "This slow leak is called theta. By the deadline the time value is gone, and the option is worth only its real value — or nothing, if it's out of the money. Holding too long just bleeds away what you paid.",
    cta: 'Got it',
  },

  // 7 — TEACH American vs European -----------------------------------------
  {
    id: 7,
    type: 'teach',
    kicker: 'Teach · 90-day call',
    title: 'American vs European Style',
    intro:
      'American options can be used any day before the deadline; European ones only on the deadline. Drag the marker to try using yours early.',
    scene: { kind: 'timeline', params: { variant: 'timeline', intrinsicNow: 6, timeValueNow: 2 } },
    caption:
      'Most stock options are American — usable any day. But using one early throws away its leftover time value. Selling the option instead lets you keep that value, so early exercise is usually a mistake.',
    cta: 'Got it',
  },

  // 8 — CHALLENGE exercise/sell/expire ------------------------------------
  {
    id: 8,
    type: 'challenge',
    kicker: 'Challenge · cash out a call',
    title: 'Exercise, Sell, or Let It Expire?',
    intro:
      "Your call is worth $8 — $6 of real value plus $2 of time value still left — and you want out. Sell it, use it, or let it expire?",
    scene: { kind: 'timeline', params: { variant: 'doors', intrinsicNow: 6, timeValueNow: 2, challenge: true } },
    challenge: {
      prompt: 'You want out of a call worth $8 ($6 real + $2 time value). Which choice keeps the most?',
      instructions: 'Tap Exercise, Sell-to-close, or Let it expire — then Submit.',
      submitLabel: 'Open the doors',
    },
  },

  // 9 — TEACH long payoffs --------------------------------------------------
  {
    id: 9,
    type: 'teach',
    kicker: 'Teach · buyer payoffs',
    title: 'Long Call & Put Payoffs',
    intro:
      'This chart shows your profit at any final stock price. The flat part is your worst case: you can only lose the premium. Drag the dot to read it.',
    scene: {
      kind: 'payoff',
      params: { type: 'call', side: 'long', K: 100, premium: 5, sMin: 70, sMax: 130, mode: 'interactive', controls: true, spot0: 108 },
    },
    caption:
      "Clearing the strike isn't enough to make money — first the move has to earn back the premium you paid. That tipping point is the breakeven (the blue line). Past it, a call's profit can keep climbing.",
    cta: 'Got it',
  },

  // 10 — CHALLENGE breakeven -------------------------------------------------
  {
    id: 10,
    type: 'challenge',
    kicker: 'Challenge · find break-even',
    title: 'Find the Breakeven',
    intro:
      'You paid $2.50 for a call to buy at $50, so you start $2.50 down. Drag the marker to the price where you finally get back to $0.',
    scene: {
      kind: 'payoff',
      params: {
        type: 'call',
        side: 'long',
        K: 50,
        premium: 2.5,
        sMin: 40,
        sMax: 62,
        mode: 'challenge',
        challenge: 'breakeven',
        hideBreakeven: true,
      },
    },
    challenge: {
      prompt: 'Drag the marker to the stock price where this long call breaks even.',
      instructions: 'The marker starts at the strike — slide it to where the line crosses $0, then Submit.',
      submitLabel: 'Lock in',
    },
  },

  // 11 — TEACH writer's side -----------------------------------------------
  {
    id: 11,
    type: 'teach',
    kicker: "Teach · the seller's side",
    title: "The Seller's Side: Short Options",
    intro:
      "Sell an option and you're the insurer: you pocket the premium but take on the risk. Selling a call is the dangerous one — its loss has no ceiling. Drag the dot.",
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
      "The seller keeps the premium up front but must deliver if the trade goes against them. A short call can lose without limit, because a stock can rise forever. A short put's loss is big but capped — the stock can only fall to $0.",
    cta: 'Got it',
  },

  // 12 — CHALLENGE unlimited risk ------------------------------------------
  {
    id: 12,
    type: 'challenge',
    kicker: 'Challenge · unlimited risk',
    title: 'Who Has Unlimited Risk?',
    intro:
      'Four positions — only one can lose without any limit. Flip the switches to build it, watching the max-loss readout, then submit.',
    scene: { kind: 'builder', params: { K: 100, premium: 5, sMin: 60, sMax: 140 } },
    challenge: {
      prompt: 'Build the position whose loss has no limit, then Submit.',
      instructions: 'Flip CALL/PUT and LONG/SHORT and watch the Max loss readout.',
      submitLabel: 'Check my position',
    },
  },

  // 13 — INTERACTIVE delta --------------------------------------------------
  {
    id: 13,
    type: 'interactive',
    kicker: 'Explore · delta',
    title: 'Value vs the Underlying (Delta)',
    intro:
      'Delta tells you how much the option moves when the stock moves $1. Drag the dot: deep in the money it nearly matches the stock; far out, it barely reacts.',
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
      'A delta near 1 means the option moves almost dollar-for-dollar with the stock — like owning the shares. A delta near 0 means it barely moves. At the strike it sits around 0.5.',
    cta: 'Done exploring',
  },

  // 14 — TEACH leverage -----------------------------------------------------
  {
    id: 14,
    type: 'teach',
    kicker: 'Teach · $100 stock',
    title: 'Leverage: $1 Premium, 100 Shares',
    intro:
      'The same $500 buys 5 shares — or one call that controls 100. The call acts like a magnifying glass: drag the move and watch its swing dwarf the stock.',
    scene: { kind: 'leverage', params: { S0: 100, K: 100, premium: 5, budget: 500 } },
    caption:
      "A +10% stock move can turn into a +100% gain on the call — but a flat or down move can wipe out the whole premium (−100%). Leverage magnifies the move in both directions.",
    cta: 'Got it',
  },

  // 15 — CAPSTONE -----------------------------------------------------------
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone · put it all together',
    title: 'Build & Read an Option Position',
    intro:
      'Put it all together: build your own option and read it like a dashboard — breakeven, max loss, max gain. Your goal: a bullish position with limited risk.',
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
      "You built a long call: strike 120, premium $6, breakeven 126, max loss $600, upside unlimited. To profit, the stock must clear 126 — not just the strike. That one chart ties the whole lesson together.",
    quiz: {
      prompt: 'Your built long call (K=120, premium 6): if the stock is 130 at expiry, is it profitable — and by how much per contract?',
      options: [
        { id: 'a', label: 'A $600 loss' },
        { id: 'b', label: 'A $400 profit' },
        { id: 'c', label: 'A $1,000 profit' },
      ],
      correctId: 'b',
      explainRight:
        "Correct. At $130 the call is worth $10 a share; minus the $6 you paid, that's $4 × 100 = +$400. You cleared the breakeven (126) by $4.",
      explainWrong:
        "It's +$400. The call is worth $10 a share at $130, minus the $6 premium = $4 × 100. The $1,000 answer forgets the premium; the $600 loss only happens at or below the strike.",
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
      'What calls and puts really are, what sets their price, when to use them, and how leverage cuts both ways — then build one yourself.',
    modules,
  },
  scenes: {
    card: ContractCardScene,
    premium: PremiumBarScene,
    theta: ThetaDecayScene,
    payoff: PayoffScene,
    builder: PositionBuilderScene,
    delta: DeltaCurveScene,
    timeline: ExerciseTimelineScene,
    leverage: LeverageScene,
    capstone: CapstoneScene,
  },
}

export default pkg
