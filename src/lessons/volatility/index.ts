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
      'You can bet on volatility itself: profit from a big move either way, and lose only if the stock sits still. Drag the future price and watch the profit meter.',
    scene: { kind: 'intro', params: {} },
    caption:
      "Illustrative: a $100 anchor. This is a volatility bet — it doesn't care which way, it cares how far. The next modules build the exact trade that pays off like this meter.",
    cta: 'Got it',
  },

  // 2 — TEACH · stacking two Lesson-4 payoffs
  {
    id: 2,
    type: 'teach',
    kicker: 'Recap',
    title: 'Stacking Two Lesson-4 Payoffs',
    intro:
      'A straddle is literally a long call + a long put from Lesson 4, summed. Two hockey-stick payoffs add vertically into a new V — and the cost is the sum of the two premiums.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        showLegMerge: true,
        title: 'long call (−4) + long put (−3)  →  combined V',
        caption:
          'Illustrative example. Add the two hockey sticks and you get a V that is down 7 at the strike (the total premium) and climbs in both directions.',
      },
    },
    caption: 'A straddle is nothing new — it is two Lesson-4 legs stacked into a V.',
    cta: 'Got it',
  },

  // 3 — TEACH · the long straddle
  {
    id: 3,
    type: 'teach',
    kicker: 'Long Straddle',
    title: 'The Long Straddle',
    intro:
      'Long 1 call + long 1 put at the SAME strike (usually ATM), same expiry. Cost = call + put premium. It is non-directional / long-volatility. Max loss = total premium if the stock pins at K. Drag the sliders to feel it.',
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
        title: 'Long straddle — V, vertex (100, −7)',
      },
    },
    caption:
      'Illustrative example. You pay 7 up front (×100 = $700). The worst case is the stock pinning at 100 — both options expire worthless and you lose the full 7. Everything past the arms is profit.',
    cta: 'Got it',
  },

  // 4 — TEACH · straddle breakevens
  {
    id: 4,
    type: 'teach',
    kicker: 'Breakevens',
    title: 'Straddle Breakevens',
    intro:
      'The two breakevens are K + totalPremium (up) and K − totalPremium (down). With K=100 and total 7 they sit at 93 and 107 — you must move MORE than the premium to profit.',
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
        title: 'Breakevens = K ± total premium',
      },
    },
    caption:
      'Illustrative example. Breakevens = strike ± total premium. With cost 7 on a $100 stock you need a 7% move (to 93 or 107) just to reach zero — and more than that to win. Profit zones shade green, the loss interior red.',
    cta: 'Got it',
  },

  // 5 — CHALLENGE · drag the straddle breakevens onto where the V crosses zero
  {
    id: 5,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Find the Straddle Breakevens',
    intro:
      'This ATM straddle has strike 100, a call premium of 4, and a put premium of 3 (total 7). Drag the two blue markers onto the prices where the V crosses zero.',
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
      prompt: 'Place the two breakevens where this V crosses zero.',
      instructions: 'Drag each blue marker. Breakevens = strike ± TOTAL premium; the vertex is the max loss at K.',
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
      'Long 1 OTM call (higher strike Kc) + long 1 OTM put (lower strike Kp). Cheaper than a straddle but needs a bigger move. Payoff is a flat-bottomed valley between the strikes. The straddle V is ghosted behind for contrast.',
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
        title: 'Long strangle — flat-bottom valley (95–105 at −3)',
      },
    },
    caption:
      'Illustrative example. A strangle uses two OTM options, so it is cheaper (3 vs 7) — but its loss zone is a flat valley spanning 95–105. Cheaper to own, but the stock must travel farther to escape.',
    cta: 'Got it',
  },

  // 7 — TEACH · strangle breakevens
  {
    id: 7,
    type: 'teach',
    kicker: 'Breakevens',
    title: 'Strangle Breakevens',
    intro:
      'Breakevens are Kc + totalPremium (up) and Kp − totalPremium (down). With Kp=95, Kc=105, total 3 they sit at 108 and 92. Max loss = total premium, flat across the whole band between the strikes.',
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
        title: 'Breakevens = Kc + total (up) / Kp − total (down)',
      },
    },
    caption:
      'Illustrative example. Strangle breakevens push out from the strikes: 108 up, 92 down. Inside the strikes you simply lose the 3 you paid — the loss is flat across 95–105. Nearest breakeven is 8 from 100.',
    cta: 'Got it',
  },

  // 8 — CHALLENGE · pick the structure that profits at a given move
  {
    id: 8,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Straddle vs Strangle: Cost vs Move',
    intro:
      'A straddle at K=100 costs 7 (breakevens 93/107). A strangle with Kp=95, Kc=105 costs 3 (breakevens 92/108). The stock is expected to land at the dashed line — pick the structure that PROFITS there.',
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
      instructions: 'Tap Straddle or Strangle, then Submit. The cheaper structure needs the bigger move — breakeven distance, not cost, decides.',
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
      'Long straddles/strangles are placed ahead of earnings or binary events (earnings, FDA decisions, court rulings) — when you expect a big move but not the direction. Pick an event and structure, then trigger the whip.',
    scene: {
      kind: 'event',
      params: {
        interactive: true,
        title: 'Earnings event — the payoff wins on EITHER whip (if it clears a BE)',
        caption:
          'Illustrative example. These are event trades: a catalyst is coming and you expect a big move but cannot call the direction. A tiny move foreshadows the next module (IV crush).',
      },
    },
    caption: 'You do not pick the direction — you pick that it MOVES (far enough to clear a breakeven).',
    cta: 'Got it',
  },

  // 10 — TEACH · the IV-crush trap
  {
    id: 10,
    type: 'teach',
    kicker: 'The Trap',
    title: 'The IV-Crush Trap',
    intro:
      'IV is high (premiums fat) BEFORE the event and collapses right after (IV crush). A long straddle can LOSE even when the stock moves, if the realized move is smaller than the breakeven move. Tune the premium and the move and watch.',
    scene: {
      kind: 'ivcrush',
      params: {
        K: 100,
        premium: 7,
        move: 0.04,
        interactive: true,
        title: 'High IV before → crush after · S=104 inside 93–107 ⇒ loss',
        caption:
          'Illustrative example. You paid 7 of fat premium; the stock moved 4% to 104 and you still lost 3 because 104 is inside 93–107 — the 4-point move never cleared the 7-point breakeven move. The −3 is pure breakeven math; IV crush is the separate reason you cannot even sell out for time value. Clear a breakeven, not just move.',
      },
    },
    caption: 'P&L at expiry = intrinsic_after − premium_paid. At 104 that is 4 − 7 = −3 (intrinsic only; no IV term).',
    cta: 'Got it',
  },

  // 11 — CHALLENGE · drag the landing price; submit applies IV crush, reveals P&L
  {
    id: 11,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'The Stock Moved — Did You Win?',
    intro:
      'You own a straddle: K=100, total premium 7, breakevens 93/107. The marker starts at 104 (a +4% gap up). Drag it to a price where this straddle would actually PROFIT, then run the IV crush.',
    scene: {
      kind: 'ivcrush',
      params: {
        K: 100,
        premium: 7,
        move: 0.04,
        challenge: true,
        title: 'Straddle K=100, premium 7 · drag the landing price · IV crush',
      },
    },
    challenge: {
      prompt: 'Drag the marker to where the stock must land for this straddle to PROFIT.',
      instructions: 'A move alone isn’t enough — profit needs to CLEAR a breakeven (below 93 or above 107). Submit applies the IV crush and reveals the P&L.',
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
      'A short straddle/strangle is the mirror: SELL both legs, COLLECT the premium, and profit if the stock stays quiet inside the breakevens. The payoff flips into an inverted tent — large/undefined risk if the stock moves big.',
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
        title: 'Short straddle — inverted tent, peak +7 at K (collect 7)',
      },
    },
    caption:
      'Illustrative example. Flip the trade and you flip the bet: a short straddle keeps the 7 you collected if the stock pins near 100 — but a big move now costs you, with unbounded risk to the upside. Quiet wins; wild ruins. Same breakevens (93/107), reversed.',
    cta: 'Got it',
  },

  // 13 — CHALLENGE · pick long vol vs short vol for a pin scenario
  {
    id: 13,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Quiet or Wild? Pick the Right Trade',
    intro:
      'IV is very rich heading into earnings, and you expect the stock to barely move — pinning near the 100 strike. Pick LONG VOL or SHORT VOL, then run it.',
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
      instructions: 'Long vol = BUY the straddle (needs a big move). Short vol = SELL it (keeps premium on a pin, but large risk). Submit runs the pin at 100.',
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
      'The whole trade in one place. Toggle structure and long/short, set strikes, premium, and the realized price, and watch the breakevens decide. Try the presets — build a winner, then build one where the stock moves and you still lose.',
    scene: { kind: 'lab', params: {} },
    caption:
      'Illustrative example. Strikes, premium, and the realized move jointly decide P&L — the breakevens are the line between winning and losing.',
    cta: 'Done exploring',
  },

  // 15 — CAPSTONE · trade an earnings event
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone',
    title: 'Capstone & Recap: Trade an Earnings Event',
    intro:
      'Recap, then trade: pick a structure and side, state your expectation, and run the earnings event. The scorecard grades your P&L against the breakevens and the IV crush — clear the breakeven, not just move.',
    scene: { kind: 'capstone', params: {} },
    caption:
      'Illustrative example. You built it and ran the event — the breakevens, not the headline "it moved," decided the result. That is volatility trading: structure, breakevens, and IV crush together.',
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
