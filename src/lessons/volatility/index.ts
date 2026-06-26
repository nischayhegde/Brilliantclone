import type { LessonPackage, ModuleSpec } from '../../engine/types'
import IntroVibeScene from './scenes/IntroVibeScene'
import PayoffScene from './scenes/PayoffScene'
import IVCrushScene from './scenes/IVCrushScene'
import EventCandleScene from './scenes/EventCandleScene'
import VolLabScene from './scenes/VolLabScene'
import CapstoneScene from './scenes/CapstoneScene'

/**
 * LESSON 5 — Straddles & Strangles: Trading Volatility (planning/Lesson5Spec.md).
 *
 * 15 modules: 1 intro · 8 teach · 4 challenge · 1 interactive · 1 capstone. Builds on
 * Lesson 4's single options. Every premium / IV / breakeven / P&L figure is an
 * ILLUSTRATIVE simulation computed by exact option math (scenes/payoffMath.ts) — the
 * math is exactly correct; the round numbers are chosen to read clearly. Clean $100
 * anchor: straddle K=100 (call 4 + put 3 = 7 → BE 93/107); strangle Kp=95/Kc=105
 * (total 3 → BE 92/108). The IV-crush case: S=104 is INSIDE 93–107 ⇒ a LOSS even
 * though the stock moved (|104−100|−7 = −3).
 */
const modules: ModuleSpec[] = [
  // 1 — INTRO
  {
    id: 1,
    type: 'intro',
    kicker: 'Volatility',
    title: 'Bet on a Big Move — Either Way',
    intro:
      'Some trades win when a stock makes a BIG move — up or down. They only lose if it sits still. Drag the slider and watch the profit meter.',
    scene: { kind: 'intro', params: {} },
    caption:
      'This bet cares how FAR the price moves, not which way. Next, we build the real trade behind this meter.',
    cta: 'Got it',
  },

  // 2 — TEACH · stacking two Lesson-4 payoffs
  {
    id: 2,
    type: 'teach',
    kicker: 'Recap',
    title: 'A Straddle = a Call + a Put',
    intro:
      'A straddle is two bets bought together: a call (wins if the price goes up) and a put (wins if it goes down). Add them up and you get a V.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        showLegMerge: true,
        title: 'buy a call + buy a put  →  one V',
      },
    },
    caption: 'The V dips to −7 at the strike (what you paid) and rises on both sides. Example numbers.',
    cta: 'Got it',
  },

  // 3 — TEACH · the long straddle
  {
    id: 3,
    type: 'teach',
    kicker: 'Long Straddle',
    title: 'The Long Straddle',
    intro:
      'Buy a call and a put at the same price (the strike). Now you win on a big move either way, and lose the most if the stock barely moves. Drag the dot and sliders to feel it.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        showLegMerge: true,
        draggableDot: true,
        dotStart: 110,
        sliders: [
          { key: 'K', label: 'strike', min: 90, max: 110, step: 1 },
          { key: 'callPremium', label: 'call price', min: 1, max: 8, step: 0.5 },
          { key: 'putPremium', label: 'put price', min: 1, max: 8, step: 0.5 },
        ],
        title: 'Long straddle — a V that bottoms at the strike',
      },
    },
    caption:
      'You pay 7 up front. Worst case: the stock sits at 100 and you lose all 7. Past the arms of the V, you profit. Example numbers.',
    cta: 'Got it',
  },

  // 4 — TEACH · straddle breakevens
  {
    id: 4,
    type: 'teach',
    kicker: 'Breakevens',
    title: 'Straddle Breakevens',
    intro:
      'Breakevens are where you stop losing and start winning: strike + total cost (up) and strike − total cost (down). Here that is 107 and 93.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        showBreakevens: true,
        draggableDot: true,
        dotStart: 107,
        sliders: [{ key: 'total', label: 'total cost', min: 2, max: 14, step: 0.5 }],
        title: 'Breakevens = strike ± total cost',
      },
    },
    caption:
      'The stock has to move past 93 or 107 just to break even — and further to win. Green = profit, red = loss. Example numbers.',
    cta: 'Got it',
  },

  // 5 — CHALLENGE · drag the straddle breakevens onto where the V crosses zero
  {
    id: 5,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Find the Straddle Breakevens',
    intro:
      'This straddle: strike 100, total cost 7. Drag the two blue lines to where the V crosses zero — those are your breakevens.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        challenge: 'breakevens',
        title: 'Drag both lines to where the V hits zero',
      },
    },
    challenge: {
      prompt: 'Place the two breakevens where the V crosses zero.',
      instructions: 'Breakevens = strike ± total cost (7) — use both prices, not one. The bottom of the V is your worst case.',
      submitLabel: 'Check',
    },
    cta: 'Continue',
  },

  // 6 — TEACH · the long strangle
  {
    id: 6,
    type: 'teach',
    kicker: 'Long Strangle',
    title: 'The Long Strangle',
    intro:
      'A strangle is the cheaper cousin: buy a call and a put, but both further from today’s price. It costs less, but the stock has to move more to pay off.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'strangle',
        Kp: 95,
        Kc: 105,
        putPremiumStrangle: 1.25,
        callPremiumStrangle: 1.75,
        showLegMerge: true,
        ghostStraddle: true,
        draggableDot: true,
        dotStart: 110,
        sliders: [{ key: 'spread', label: 'strike spread ±', min: 3, max: 12, step: 1 }],
        title: 'Long strangle — a flat-bottomed valley',
      },
    },
    caption:
      'Cheaper (3 vs 7), but the loss zone is a wide flat valley from 95 to 105. The stock must travel farther to escape it. Example numbers.',
    cta: 'Got it',
  },

  // 7 — TEACH · strangle breakevens
  {
    id: 7,
    type: 'teach',
    kicker: 'Breakevens',
    title: 'Strangle Breakevens',
    intro:
      'Breakevens sit outside the strikes: upper strike + cost (up) and lower strike − cost (down). Here that is 108 and 92. Between the strikes, you just lose what you paid.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'strangle',
        Kp: 95,
        Kc: 105,
        putPremiumStrangle: 1.25,
        callPremiumStrangle: 1.75,
        showBreakevens: true,
        draggableDot: true,
        dotStart: 108,
        sliders: [
          { key: 'Kp', label: 'lower strike', min: 85, max: 99, step: 1 },
          { key: 'Kc', label: 'upper strike', min: 101, max: 115, step: 1 },
          { key: 'total', label: 'total cost', min: 1, max: 10, step: 0.5 },
        ],
        title: 'Breakevens = strikes ± total cost',
      },
    },
    caption:
      'Breakevens push out to 108 and 92. Anywhere from 95 to 105, you lose the same flat 3. Example numbers.',
    cta: 'Got it',
  },

  // 8 — CHALLENGE · pick the structure that profits at a given move
  {
    id: 8,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Straddle vs Strangle',
    intro:
      'The straddle costs 7; the cheaper strangle costs 3. But cheaper needs a bigger move. The stock lands on the dashed line — pick the one that profits there.',
    scene: {
      kind: 'payoff',
      params: {
        compareBoth: true,
        challenge: 'compareMove',
        expectedMove: 7.5, // S = 107.5: clears straddle BE 107 but NOT strangle BE 108
        title: 'Which one profits at this move?',
      },
    },
    challenge: {
      prompt: 'The stock lands on the dashed line. Which one profits?',
      instructions: 'Cheaper isn’t always better — the strangle needs a bigger move. Pick one, then run it.',
      submitLabel: 'Run it',
    },
    cta: 'Continue',
  },

  // 9 — TEACH · when you'd use them
  {
    id: 9,
    type: 'teach',
    kicker: 'When to Use',
    title: 'When to Use These: Earnings',
    intro:
      'You buy these before big scheduled news — like an earnings report — when you expect a large move but don’t know which way. Pick a structure and trigger the move.',
    scene: {
      kind: 'event',
      params: {
        interactive: true,
        title: 'Earnings: you win on a big move either way',
      },
    },
    caption: 'You’re not betting on direction — you’re betting it moves far enough. A small move still loses (next up: IV crush).',
    cta: 'Got it',
  },

  // 10 — TEACH · the IV-crush trap
  {
    id: 10,
    type: 'teach',
    kicker: 'The Trap',
    title: 'The IV-Crush Trap',
    intro:
      'Before big news, options are expensive — everyone expects a move. Right after, they get cheap fast. That’s IV crush. The catch: you can still lose even when the stock moves, if it doesn’t move enough. Try the sliders.',
    scene: {
      kind: 'ivcrush',
      params: {
        K: 100,
        premium: 7,
        move: 0.04,
        interactive: true,
        title: 'Before: expensive. After: cheap. A small move still loses.',
      },
    },
    caption:
      'You paid 7. The stock moved to 104 — but that’s inside 93–107, so you lose 3. You have to clear a breakeven, not just move. Example numbers.',
    cta: 'Got it',
  },

  // 11 — CHALLENGE · drag the landing price; submit applies IV crush, reveals P&L
  {
    id: 11,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'The Stock Moved — Did You Win?',
    intro:
      'You own a straddle: cost 7, breakevens 93 and 107. The dot starts at 104 — a move that looks like a win but isn’t. Drag it to a price that actually profits.',
    scene: {
      kind: 'ivcrush',
      params: {
        K: 100,
        premium: 7,
        move: 0.04,
        challenge: true,
        title: 'Drag where the stock lands, then run it',
      },
    },
    challenge: {
      prompt: 'Drag the dot to a price where this straddle profits.',
      instructions: 'Moving isn’t enough — you have to clear a breakeven (below 93 or above 107).',
      submitLabel: 'Run it',
    },
    cta: 'Continue',
  },

  // 12 — TEACH · the short mirror
  {
    id: 12,
    type: 'teach',
    kicker: 'The Other Side',
    title: 'The Other Side: Selling',
    intro:
      'Flip it: instead of buying, you SELL both options and collect the cash. Now you win if the stock stays quiet — but a big move can cost you a lot.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        side: 'short',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        showBreakevens: true,
        draggableDot: true,
        dotStart: 100,
        title: 'Short straddle — you keep the cash if it stays near 100',
      },
    },
    caption:
      'Sell instead of buy and the bet flips: quiet wins, a big move hurts (and the upside risk has no cap). Same breakevens, reversed. Example numbers.',
    cta: 'Got it',
  },

  // 13 — CHALLENGE · pick long vol vs short vol for a pin scenario
  {
    id: 13,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Quiet or Wild?',
    intro:
      'Options are expensive and you expect the stock to barely move. Which side fits — buying (long) or selling (short)?',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        side: 'long',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        challenge: 'pickVol',
        title: 'You expect a quiet stock — buy or sell?',
      },
    },
    challenge: {
      prompt: 'You expect a quiet stock. Buy or sell volatility?',
      instructions: 'Buying needs a big move. Selling keeps the cash if it stays quiet — but carries large risk. Pick one, then run it.',
      submitLabel: 'Run it',
    },
    cta: 'Continue',
  },

  // 14 — INTERACTIVE · volatility lab
  {
    id: 14,
    type: 'interactive',
    kicker: 'Lab',
    title: 'Volatility Lab',
    intro:
      'Everything in one place. Change the structure, strikes, cost, and where the stock lands — and watch the breakevens decide win or loss. Try the presets.',
    scene: { kind: 'lab', params: {} },
    caption:
      'Cost, strikes, and the move together decide your profit. The breakevens are the line between winning and losing.',
    cta: 'Done exploring',
  },

  // 15 — CAPSTONE · trade an earnings event
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone',
    title: 'Capstone: Trade an Earnings Event',
    intro:
      'Time to trade. Pick a structure and side, set where the stock lands, and run the earnings event. You’re graded on whether you cleared a breakeven — not just whether it moved.',
    scene: { kind: 'capstone', params: {} },
    caption:
      'You built it and ran it — and the breakevens, not the headline “it moved,” decided the result.',
    cta: 'Finish',
  },
]

const pkg: LessonPackage = {
  lesson: {
    id: 'volatility',
    index: 5,
    title: 'Straddles & Strangles',
    subtitle: 'Trading Volatility',
    level: 5,
    blurb:
      'Combine calls and puts to bet on a big move in either direction — and learn the IV-crush trap where the stock moves and you still lose.',
    modules,
  },
  scenes: {
    intro: IntroVibeScene,
    payoff: PayoffScene,
    ivcrush: IVCrushScene,
    event: EventCandleScene,
    lab: VolLabScene,
    capstone: CapstoneScene,
  },
}

export default pkg
