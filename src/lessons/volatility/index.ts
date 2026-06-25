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
    title: 'Betting on Motion, Not Direction',
    intro:
      "Here's a different kind of bet: you win if the stock makes a big move — up OR down — and lose only if it sits still. You're betting on how FAR it travels, not which way. Drag the future price and watch the profit meter.",
    scene: { kind: 'intro', params: {} },
    caption:
      'Illustrative: a $100 anchor. Think of a coiled spring — you profit if it snaps loose either way, and lose only if it just sits there. This bet cares how FAR price moves, not which direction. The next modules build the real trade behind this meter.',
    cta: 'Got it',
  },

  // 2 — TEACH · stacking two Lesson-4 payoffs
  {
    id: 2,
    type: 'teach',
    kicker: 'Recap',
    title: 'Stacking Two Lesson-4 Payoffs',
    intro:
      'A straddle is just two bets from Lesson 4 bought together: a call (wins if price rises) plus a put (wins if price falls). Think of taping two one-way tickets into one — the two payoffs stack into a V, and you pay both premiums (the price of each option).',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        showLegMerge: true,
        title: 'buy a call (−4) + buy a put (−3)  →  one combined V',
        caption:
          'Illustrative example. Stack the two payoffs and you get a V: it sits 7 below zero at the strike — that is the total premium you paid — and climbs back up on both sides.',
      },
    },
    caption: "A straddle is nothing new — it's just two Lesson-4 options (a call and a put) stacked into a V.",
    cta: 'Got it',
  },

  // 3 — TEACH · the long straddle
  {
    id: 3,
    type: 'teach',
    kicker: 'Long Straddle',
    title: 'The Long Straddle',
    intro:
      "Buy one call and one put at the SAME strike (usually at-the-money, ATM — right where the stock trades), same expiry. It's a non-directional, long-volatility bet: like storm insurance that pays whether the storm blows in from the north or the south — you just need a big move. Cost = both premiums; max loss = that total if the stock pins at the strike K. Drag the sliders to feel it.",
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
          { key: 'K', label: 'K', min: 90, max: 110, step: 1 },
          { key: 'callPremium', label: 'call prem', min: 1, max: 8, step: 0.5 },
          { key: 'putPremium', label: 'put prem', min: 1, max: 8, step: 0.5 },
        ],
        title: 'Long straddle — V with its low at (100, −7)',
      },
    },
    caption:
      "Illustrative example. You pay 7 up front (×100 = $700). Worst case: the stock pins at 100, both options expire worthless, and you lose the whole 7. Past the arms of the V, you're in profit.",
    cta: 'Got it',
  },

  // 4 — TEACH · straddle breakevens
  {
    id: 4,
    type: 'teach',
    kicker: 'Breakevens',
    title: 'Straddle Breakevens',
    intro:
      'Your two breakevens (the prices where you switch from losing to winning) are strike + total premium (up) and strike − total premium (down). With K=100 and total 7, that is 107 and 93. Think of the premium as a prepaid toll: the move has to pay back more than the toll before you profit.',
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
        sliders: [{ key: 'total', label: 'total premium', min: 2, max: 14, step: 0.5 }],
        title: 'Breakevens = strike ± total premium',
      },
    },
    caption:
      'Illustrative example. Breakevens = strike ± total premium. With cost 7 on a $100 stock, you need a 7% move (to 93 or 107) just to break even — and a bit more to actually win. Green shades the profit zones; red is the losing interior.',
    cta: 'Got it',
  },

  // 5 — CHALLENGE · drag the straddle breakevens onto where the V crosses zero
  {
    id: 5,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Find the Straddle Breakevens',
    intro:
      "This straddle sits at-the-money: strike 100, call premium 4, put premium 3 (total 7). The breakevens are the waterline — anywhere between them you're underwater (a loss). Drag the two blue markers to where the V rises back to zero.",
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        challenge: 'breakevens',
        title: 'Drag both markers to where P&L = 0',
      },
    },
    challenge: {
      prompt: 'Place the two breakevens where this V crosses back to zero.',
      instructions: 'Drag each blue marker. Breakevens = strike ± TOTAL premium (not one leg); the bottom of the V is your max loss at the strike.',
      submitLabel: 'Check breakevens',
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
      "Buy one out-of-the-money call (at a higher strike Kc) and one OTM put (lower strike Kp) — both starting away from the current price. It's like a cheaper insurance plan with a bigger deductible: you pay less, but the move has to be bigger before it pays. The payoff is a flat-bottomed valley between the strikes; the straddle V is ghosted behind for contrast.",
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
        title: 'Long strangle — flat valley from 95 to 105 at −3',
      },
    },
    caption:
      'Illustrative example. Two OTM options make a strangle cheaper (3 vs 7), but the loss zone is a flat valley across 95–105. Less to pay up front — but the stock has to travel farther to escape it.',
    cta: 'Got it',
  },

  // 7 — TEACH · strangle breakevens
  {
    id: 7,
    type: 'teach',
    kicker: 'Breakevens',
    title: 'Strangle Breakevens',
    intro:
      "Breakevens are upper strike + total premium (up) and lower strike − total premium (down). With Kp=95, Kc=105, total 3, that's 108 and 92. Between the strikes is a wide 'nothing happens' zone — like a moat the stock must cross — where you just lose the 3 you paid, flat across the whole band.",
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
          { key: 'Kp', label: 'Kp', min: 85, max: 99, step: 1 },
          { key: 'Kc', label: 'Kc', min: 101, max: 115, step: 1 },
          { key: 'total', label: 'total premium', min: 1, max: 10, step: 0.5 },
        ],
        title: 'Breakevens = upper strike + total (up) / lower strike − total (down)',
      },
    },
    caption:
      'Illustrative example. The breakevens push out past the strikes: 108 up, 92 down. Anywhere inside, you simply lose the 3 you paid — a flat loss across 95–105. The nearest breakeven is 8 away from 100.',
    cta: 'Got it',
  },

  // 8 — CHALLENGE · pick the structure that profits at a given move
  {
    id: 8,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Straddle vs Strangle: Cost vs Move',
    intro:
      "A straddle at K=100 costs 7 (breakevens 93/107). A strangle with Kp=95, Kc=105 costs 3 (breakevens 92/108). The bargain isn't always the winner — the cheaper trade needs a bigger move to pay. The stock is expected to land at the dashed line; pick the structure that PROFITS there.",
    scene: {
      kind: 'payoff',
      params: {
        compareBoth: true,
        challenge: 'compareMove',
        expectedMove: 7.5, // S = 107.5: clears straddle BE 107 but NOT strangle BE 108
        title: 'Straddle (cost 7) vs Strangle (cost 3) — which wins at this move?',
      },
    },
    challenge: {
      prompt: 'The stock lands at the dashed price. Which structure profits there?',
      instructions: 'Tap Straddle or Strangle, then Submit. The cheaper one needs the bigger move — what wins is breakeven distance, not the price tag.',
      submitLabel: 'Run the move',
    },
    cta: 'Continue',
  },

  // 9 — TEACH · when you'd use them
  {
    id: 9,
    type: 'teach',
    kicker: 'When to Use',
    title: 'When You’d Use Them: Earnings & Binary Events',
    intro:
      "You buy these just before a binary event — a scheduled moment with two very different outcomes, like an earnings report, an FDA decision, or a court ruling. It's like a fireworks show: you know a bang is coming, you just can't call which way the sparks fly. Pick an event and structure, then trigger the move.",
    scene: {
      kind: 'event',
      params: {
        interactive: true,
        title: 'Earnings event — you win on a move EITHER way (if it clears a breakeven)',
        caption:
          "Illustrative example. These are event trades: a catalyst is coming, you expect a big move, but you can't call the direction. Watch how a tiny move loses — a preview of the next module, IV crush.",
      },
    },
    caption: "You're not picking the direction — you're betting it MOVES, far enough to clear a breakeven.",
    cta: 'Got it',
  },

  // 10 — TEACH · the IV-crush trap
  {
    id: 10,
    type: 'teach',
    kicker: 'The Trap',
    title: 'The IV-Crush Trap',
    intro:
      'Before an event, implied volatility (IV — the expected move priced into options) runs high, so premiums are fat. Right after, IV collapses — that is IV crush. Picture umbrella prices surging before a forecast, then the storm fizzles: a long straddle can LOSE even when the stock moves, if the move falls short of your breakeven. Tune the premium and the move and watch.',
    scene: {
      kind: 'ivcrush',
      params: {
        K: 100,
        premium: 7,
        move: 0.04,
        interactive: true,
        title: 'IV fat before → crushed after · S=104 inside 93–107 = a loss',
        caption:
          "Illustrative example. You paid 7 of fat premium; the stock moved 4% to 104 and you STILL lost 3 — because 104 sits inside 93–107. The 4-point move never cleared the 7-point breakeven. That −3 is pure breakeven math; IV crush is the separate reason you can't even sell out for leftover time value. Clear a breakeven, not just move.",
      },
    },
    caption: 'P&L at expiry = value left (intrinsic) − premium paid. At 104 that is 4 − 7 = −3 (intrinsic only; no IV term).',
    cta: 'Got it',
  },

  // 11 — CHALLENGE · drag the landing price; submit applies IV crush, reveals P&L
  {
    id: 11,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'The Stock Moved — Did You Win?',
    intro:
      "You own a straddle: K=100, total premium 7, breakevens 93/107. The marker starts at 104 — a +4% gap up that looks like a win but isn't. Close only counts in horseshoes: drag it to a price where this straddle actually PROFITS, then run the IV crush.",
    scene: {
      kind: 'ivcrush',
      params: {
        K: 100,
        premium: 7,
        move: 0.04,
        challenge: true,
        title: 'Straddle K=100, premium 7 · drag where it lands · then IV crush',
      },
    },
    challenge: {
      prompt: 'Drag the marker to where the stock must land for this straddle to PROFIT.',
      instructions: "Moving isn't enough — profit needs to CLEAR a breakeven (below 93 or above 107). Submit runs the IV crush and reveals the P&L.",
      submitLabel: 'Run earnings + IV crush',
    },
    cta: 'Continue',
  },

  // 12 — TEACH · the short mirror
  {
    id: 12,
    type: 'teach',
    kicker: 'The Other Side',
    title: 'The Other Side: Short Straddle & Short Strangle',
    intro:
      "Flip it around: a short straddle/strangle SELLS both options and COLLECTS the premium up front. Now you're the insurance company — you keep the premium if the stock stays quiet inside the breakevens, but one big move and you pay out. The payoff flips into an inverted tent, with large, undefined risk if it moves far.",
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
        title: 'Short straddle — inverted tent, peak +7 at the strike (you collect 7)',
      },
    },
    caption:
      'Illustrative example. Flip the trade, flip the bet: a short straddle keeps the 7 you collected if the stock pins near 100 — but a big move now costs you, with unbounded risk to the upside. Quiet wins; wild ruins. Same breakevens (93/107), just reversed.',
    cta: 'Got it',
  },

  // 13 — CHALLENGE · pick long vol vs short vol for a pin scenario
  {
    id: 13,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Quiet or Wild? Pick the Right Trade',
    intro:
      'IV is very rich heading into earnings, and you expect the stock to barely move — pinning near the 100 strike. Match the trade to your forecast: if you truly expect calm, which side wins? Pick LONG VOL or SHORT VOL, then run it.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        side: 'long',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        challenge: 'pickVol',
        title: 'Rich IV · you expect a PIN near 100 — long vol or short vol?',
      },
    },
    challenge: {
      prompt: 'You expect a pin near 100 with rich IV. Long vol or short vol?',
      instructions: 'Long vol = BUY the straddle (needs a big move). Short vol = SELL it (keeps the premium on a pin, but carries large risk). Submit runs the pin at 100.',
      submitLabel: 'Run the pin',
    },
    cta: 'Continue',
  },

  // 14 — INTERACTIVE · volatility lab
  {
    id: 14,
    type: 'interactive',
    kicker: 'Lab',
    title: 'Volatility Lab: Tune the Whole Trade',
    intro:
      'The whole trade on one control panel. Toggle structure and long/short, set the strikes, premium, and where the stock lands, and watch the breakevens decide win from loss. Try the presets — build a winner, then build one where the stock moves and you still lose.',
    scene: { kind: 'lab', params: {} },
    caption:
      'Illustrative example. Strikes, premium, and the realized move together decide your P&L — the breakevens are the line between winning and losing.',
    cta: 'Done exploring',
  },

  // 15 — CAPSTONE · trade an earnings event
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone',
    title: 'Capstone & Recap: Trade an Earnings Event',
    intro:
      'Recap, then trade: pick a structure and side, state your expectation, and run the earnings event. Like a final exam, the scorecard grades your P&L against the breakevens and the IV crush — not on whether it moved, but on whether you cleared a breakeven.',
    scene: { kind: 'capstone', params: {} },
    caption:
      'Illustrative example. You built it and ran the event — the breakevens, not the headline "it moved," decided the result. That is volatility trading: structure, breakevens, and IV crush, together.',
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
