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
      'An option is like a refundable deposit: you pay a little for the RIGHT — never the obligation — to trade 100 shares at a fixed "strike" price by a deadline. Flip CALL/PUT and drag the deadline.',
    scene: { kind: 'card', params: { variant: 'coupon', K: 100, premium: 5, days: 30 } },
    caption:
      'An option gives you the right (never the obligation) to BUY (a call) or SELL (a put) 100 shares at a fixed strike price by a deadline. You pay a small premium for that right — like a deposit you can walk away from. (Premium shown is illustrative.)',
    cta: 'Got it',
  },

  // 2 — TEACH calls vs puts + ×100 -----------------------------------------
  {
    id: 2,
    type: 'teach',
    kicker: 'Teach · S ≈ $100',
    title: 'Calls vs Puts (and the ×100 Multiplier)',
    intro:
      'A CALL is a coupon to BUY 100 shares at the strike K; a PUT is a coupon to SELL 100 shares at K. One contract always covers 100 shares, so a per-share premium ×100 is the real dollar cost.',
    scene: { kind: 'card', params: { variant: 'compare', K: 100, premium: 3 } },
    caption:
      'Call = a coupon to BUY 100 shares cheap (you want the stock high). Put = a coupon to SELL 100 shares at a locked-in high price (you want the stock low). One contract is 100 shares, so a $3.00 premium really costs $300. (Premium illustrative; the ×100 rule is exact.)',
    cta: 'Got it',
  },

  // 3 — CHALLENGE right not obligation -------------------------------------
  {
    id: 3,
    type: 'challenge',
    kicker: 'Challenge · CALL K=100',
    title: 'Right, Not Obligation',
    intro:
      'You hold a CALL with strike 100 — think of it as a cancellable pre-order to buy at 100. At expiry the stock is only 95. You decide: exercise the right to buy at 100, or let the contract expire and walk away.',
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
      },
    },
    challenge: {
      prompt: 'The stock closed at 95 and you hold a 100-strike call. What do you do?',
      instructions: 'Tap EXERCISE or LET EXPIRE, then Submit to settle the contract.',
      submitLabel: 'Settle',
    },
  },

  // 4 — TEACH premium = intrinsic + time -----------------------------------
  {
    id: 4,
    type: 'teach',
    kicker: 'Teach · CALL K=100',
    title: 'Premium = Intrinsic + Time Value',
    intro:
      'A premium splits into two parts: intrinsic value + time (extrinsic) value. Intrinsic is the in-the-money part: call = max(S−K,0), put = max(K−S,0). Drag S across the strike and watch the split — and the moneyness — change.',
    scene: { kind: 'premium', params: { mode: 'interactive', type: 'call', K: 100, S: 100, premium: 3, sMin: 70, sMax: 130 } },
    caption:
      'Think of a concert ticket: its price is the face value (the real, "intrinsic" part) plus a scalper\'s hype markup ("time value"). For an option, intrinsic is the in-the-money part — call max(S−K,0), put max(K−S,0) — and the rest is time value. ITM = intrinsic above 0, OTM = intrinsic 0, ATM = right at the strike. (Time-value numbers illustrative; intrinsic math exact.)',
    cta: 'Got it',
  },

  // 5 — CHALLENGE split the premium ----------------------------------------
  {
    id: 5,
    type: 'challenge',
    kicker: 'Challenge · CALL K=100, S=107',
    title: 'How Much Is Real Value?',
    intro:
      'A CALL, strike 100, with the stock at 107, trades for a 9.00 premium. Picture it as cash-in-hand plus a lottery ticket that expires: drag the divider to split the premium into intrinsic (real) value and time value.',
    scene: {
      kind: 'premium',
      params: { mode: 'challenge', type: 'call', K: 100, S: 107, premium: 9 },
    },
    challenge: {
      prompt: 'Split the 9.00 premium: how much is intrinsic (real) value, and how much is time value?',
      instructions: 'Drag the divider — below it is intrinsic, above it is time value — then Submit.',
      submitLabel: 'Split it',
    },
  },

  // 6 — TEACH theta ---------------------------------------------------------
  {
    id: 6,
    type: 'teach',
    kicker: 'Teach · CALL K=100, S=105',
    title: 'Theta: Time Value Decays to Zero',
    intro:
      'An option’s time value melts like an ice cube — slowly far out, faster as the deadline nears. That melt is theta. Drag days-to-expiry from 60 to 0 and watch the time value melt down onto the intrinsic floor.',
    scene: { kind: 'theta', params: { K: 100, S: 105, tv0: 3, days: 60, money: 'ITM' } },
    caption:
      'An option’s "time value" melts like an ice cube — slowly at first, then faster as the deadline nears. That melt is called theta. At expiry the cube is gone and the option is worth exactly its intrinsic value (the real, in-the-money part): an OTM option becomes worthless, an ITM one is worth S−K (call) / K−S (put). (Decay curve illustrative; intrinsic-at-expiry exact.)',
    cta: 'Got it',
  },

  // 7 — TEACH American vs European -----------------------------------------
  {
    id: 7,
    type: 'teach',
    kicker: 'Teach · 90-day call',
    title: 'American vs European Style',
    intro:
      'American options can be exercised ANY day up to expiry; European ones only AT expiry. Drag the "exercise now" marker — exercising early usually throws away time value (with two special-case exceptions).',
    scene: { kind: 'timeline', params: { variant: 'timeline', intrinsicNow: 6, timeValueNow: 2 } },
    caption:
      'American = use it any day (like a gift card good until its expiry); European = only on the deadline date (like a dinner reservation good for one night). Equity options are usually American, but exercising early normally wastes time value — selling-to-close keeps it. Exceptions: a deep-ITM call just before a dividend, and a deep-ITM put (to earn interest on the strike cash now). (Time-value figures illustrative; the trade-off logic is exact.)',
    cta: 'Got it',
  },

  // 8 — CHALLENGE exercise/sell/expire ------------------------------------
  {
    id: 8,
    type: 'challenge',
    kicker: 'Challenge · ITM call worth 8.00',
    title: 'Exercise, Sell, or Let It Expire?',
    intro:
      'You hold an ITM call worth 8.00 (intrinsic 6.00, time value 2.00) with a week left, and you want out now. Like a concert ticket, you can resell the whole thing or redeem it early — pick a door, then Submit to open them and see what each keeps.',
    scene: { kind: 'timeline', params: { variant: 'doors', intrinsicNow: 6, timeValueNow: 2, challenge: true } },
    challenge: {
      prompt: 'You want out of an ITM call (intrinsic 6.00, time value 2.00). Which action keeps the most value?',
      instructions: 'Tap Exercise, Sell-to-close, or Let it expire — then Submit.',
      submitLabel: 'Open the doors',
    },
  },

  // 9 — TEACH long payoffs --------------------------------------------------
  {
    id: 9,
    type: 'teach',
    kicker: 'Teach · long call/put',
    title: 'Long Call & Long Put Payoffs (with Breakevens)',
    intro:
      'At expiry a long option is a hockey-stick shape. Long-call breakeven = K + premium; long-put breakeven = K − premium; the most you can lose either way is the premium. Drag the spot dot to read your P&L.',
    scene: {
      kind: 'payoff',
      params: { type: 'call', side: 'long', K: 100, premium: 5, sMin: 70, sMax: 130, mode: 'interactive', controls: true, spot0: 108 },
    },
    caption:
      'The flat part of the stick is your worst case — the most you can lose is the premium, your cost of entry. But clearing the strike isn’t enough to profit: first the move has to earn that premium back. The long call profits above K + premium (105); the long put profits below K − premium (95). The call’s upside is unlimited while the put’s max gain is K − premium (the stock can’t fall below 0). (Breakeven math exact; premium illustrative.)',
    cta: 'Got it',
  },

  // 10 — CHALLENGE breakeven -------------------------------------------------
  {
    id: 10,
    type: 'challenge',
    kicker: 'Challenge · CALL K=50, prem 2.50',
    title: 'Find the Breakeven',
    intro:
      'You buy a CALL, strike 50, for a 2.50 premium — so you start 2.50 in the hole. Drag the blue marker to the stock price where your gain has climbed back to $0. That price is your breakeven.',
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
    kicker: 'Teach · short call/put',
    title: "The Writer's Side: Short Call & Short Put",
    intro:
      'The writer (the seller) collects the premium and takes on the obligation — like an insurance company. Short = the mirror of long, flipped across the x-axis. A short call has unlimited risk; a short put’s loss is capped at (K − premium) × 100. Drag the spot dot.',
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
      'Writing an option is like being the insurance company: you pocket the premium up front, but you’re on the hook if things go against you. A short call must deliver shares no matter how high the stock climbs → unlimited risk. A short put must buy at K → the loss grows as the stock falls, capped at (K − premium) × 100 ($9,500 here) since the stock can’t go below 0. Short = the mirror of long. (Premium illustrative; risk math exact.)',
    cta: 'Got it',
  },

  // 12 — CHALLENGE unlimited risk ------------------------------------------
  {
    id: 12,
    type: 'challenge',
    kicker: 'Challenge · build a leg',
    title: 'Who Has Unlimited Risk?',
    intro:
      'Build a single-leg position by toggling CALL/PUT and LONG/SHORT (K=100, premium 5); the payoff redraws live. One of these is like betting against a balloon — it can inflate forever. Build the position whose loss is theoretically unbounded, then Submit.',
    scene: { kind: 'builder', params: { K: 100, premium: 5, sMin: 60, sMax: 140 } },
    challenge: {
      prompt: 'Build the single-leg position with theoretically UNLIMITED loss, then Submit.',
      instructions: 'Toggle CALL/PUT and LONG/SHORT — watch the max-loss readout — then Submit.',
      submitLabel: 'Check my position',
    },
  },

  // 13 — INTERACTIVE delta --------------------------------------------------
  {
    id: 13,
    type: 'interactive',
    kicker: 'Explore · CALL K=100',
    title: 'Value vs the Underlying (Delta)',
    intro:
      'Delta is how much the option’s price moves per $1 move in the stock — the slope of its price curve. Think of a gas pedal: drag S along the curve and the tangent tilts from barely-pressed (OTM) to ~45° (ATM, δ≈0.5) to floored (deep-ITM, δ→1).',
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
      'Delta is like a gas pedal’s sensitivity — the slope of the option’s price curve. Deep-ITM options ≈ pedal floored, tracking the shares 1:1 (δ near 1); ATM ≈ half-pressed (δ≈0.5); far-OTM ≈ barely touched (small δ). So one deep-ITM contract behaves like ~100 shares while a far-OTM one hardly budges. (Delta values illustrative; slope behavior exact.)',
    cta: 'Done exploring',
  },

  // 14 — TEACH leverage -----------------------------------------------------
  {
    id: 14,
    type: 'teach',
    kicker: 'Teach · $100 stock',
    title: 'Leverage: $1 Premium, 100 Shares',
    intro:
      'The same $500 buys 5 shares of a $100 stock — or one $5.00 call that controls 100 shares. A call is a magnifying glass: drag the % move and watch the call’s swing dwarf the stock’s — and hit −100% at or below the strike at expiry.',
    scene: { kind: 'leverage', params: { S0: 100, K: 100, premium: 5, budget: 500 } },
    caption:
      '$500 buys exactly 5 shares of a $100 stock — or one $5.00 call controlling 100 shares. A call works like a magnifying glass on the move: a +10% stock becomes the call’s +100%, but a flat or down move becomes −100% (the whole premium gone). Magnified both ways — that’s leverage, and it cuts in both directions. (Underlying anchor real; premium illustrative; returns computed exactly.)',
    cta: 'Got it',
  },

  // 15 — CAPSTONE -----------------------------------------------------------
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone · S ≈ $120',
    title: 'Build & Read an Option Position',
    intro:
      'Build a position (type, side, strike, premium) and read it live like a dashboard: breakeven, max loss, max gain, moneyness, delta. Challenge: build a bullish position with defined (capped) risk — then check its P&L at expiry.',
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
      'You built it and read every gauge: a long call, strike 120, premium $6 → breakeven 126, max loss $600, max gain unlimited, ATM with δ≈0.5. To profit, the stock must clear the breakeven (126), not just the strike — at 123 you’re still −$300. That one chart ties the whole lesson together. (Underlying anchor real; premium illustrative; all P&L math exact.)',
    quiz: {
      prompt: 'Your built long call (K=120, premium 6): if the stock is 130 at expiry, is it profitable — and by how much per contract?',
      options: [
        { id: 'a', label: 'A $600 loss' },
        { id: 'b', label: 'A $400 profit' },
        { id: 'c', label: 'A $1,000 profit' },
      ],
      correctId: 'b',
      explainRight:
        'Correct. P&L = (max(130−120,0) − 6) × 100 = (10 − 6) × 100 = +$400. You cleared the breakeven (126) by $4 a share. Above the strike but below 126, you’d still be in the red.',
      explainWrong:
        'It’s +$400. P&L = (max(S−K,0) − premium) × 100 = (10 − 6) × 100. The $1,000 answer forgets to subtract the $6 premium; the $600 loss is the max loss, which only happens at or below the strike (S ≤ 120).',
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
    builder: PositionBuilderScene,
    delta: DeltaCurveScene,
    timeline: ExerciseTimelineScene,
    leverage: LeverageScene,
    capstone: CapstoneScene,
  },
}

export default pkg
