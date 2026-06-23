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
 * 15 modules: 1 intro · 8 teach · 4 quiz · 1 interactive · 1 capstone. Builds on
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

  // 5 — QUIZ · find the straddle breakevens
  {
    id: 5,
    type: 'quiz',
    kicker: 'Quiz',
    title: 'Find the Straddle Breakevens',
    intro:
      'This ATM straddle has strike 100, a call premium of 4, and a put premium of 3 (total 7). The breakevens are hidden — you compute them.',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        showBreakevens: true,
        quiz: true,
        title: 'Where does this V cross zero?',
      },
    },
    quiz: {
      prompt: 'Strike 100, call premium 4, put premium 3 (total 7). What are the two breakevens, and the most you can lose?',
      options: [
        { id: 'a', label: 'Breakevens 96 and 104; max loss 7 at S = 100' },
        { id: 'b', label: 'Breakevens 93 and 107; max loss 7 (= $700) at S = 100' },
        { id: 'c', label: "Breakevens 93 and 107; max loss 0 — a straddle can't lose" },
      ],
      correctId: 'b',
      explainRight:
        'Correct. Breakevens = K ± totalPremium = 100 ± 7 = 93 and 107. If the stock pins at 100, both legs expire worthless and you lose the full 7 premium (×100 = $700) — that is the max loss, at the vertex.',
      explainWrong:
        'It is B. Breakevens depend on the TOTAL premium (7), not one leg: 100 ± 7 = 93 and 107. Answer A used only the 4-premium (±4 → 96/104). Answer C is the "either-way" optimism trap — the straddle still costs money, so a small/zero move loses the premium; the V dips to −7. You must clear a breakeven, not merely move.',
    },
    cta: 'Check',
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

  // 8 — QUIZ · straddle vs strangle: cost vs move
  {
    id: 8,
    type: 'quiz',
    kicker: 'Quiz',
    title: 'Straddle vs Strangle: Cost vs Move',
    intro:
      'A straddle at K=100 costs 7 (breakevens 93/107). A strangle with Kp=95, Kc=105 costs 3 (breakevens 92/108). Both are shown; the breakevens are masked.',
    scene: {
      kind: 'payoff',
      params: {
        compareBoth: true,
        showBreakevens: true,
        quiz: true,
        title: 'Straddle (V, cost 7) vs Strangle (valley, cost 3)',
      },
    },
    quiz: {
      prompt: 'Starting from 100, which structure needs the BIGGER move to break even?',
      options: [
        { id: 'a', label: 'The straddle — it costs more, so it must need a bigger move' },
        { id: 'b', label: 'The strangle — its nearest breakeven (108/92) is 8 from 100 vs the straddle’s 7 (107/93)' },
        { id: 'c', label: 'The same — both are centered on 100' },
      ],
      correctId: 'b',
      explainRight:
        'Correct. Breakeven distance, not price tag, sets the required move. Strangle nearest BE = 105 + 3 = 108 (or 95 − 3 = 92), 8 from 100. Straddle nearest BE = 100 + 7 = 107 (or 93), 7 from 100. The cheaper strangle needs the larger move — the cost-vs-move tradeoff.',
      explainWrong:
        'It is B. Answer A inverts it: the straddle’s higher cost buys breakevens CLOSER to spot (ATM strike), so it needs a SMALLER move. Answer C ignores the strike spread: the strangle’s 95/105 strikes are already apart before premium, pushing its breakevens to 92/108. Symmetric centering does not mean equal breakeven distance.',
    },
    cta: 'Check',
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

  // 11 — QUIZ · the stock moved — did you win?
  {
    id: 11,
    type: 'quiz',
    kicker: 'Quiz',
    title: 'The Stock Moved — Did You Win?',
    intro:
      'You own a straddle: K=100, total premium 7, breakevens 93/107. After earnings the stock gaps UP 4% to 104 and IV crushes. The outcome is masked.',
    scene: {
      kind: 'ivcrush',
      params: {
        K: 100,
        premium: 7,
        move: 0.04,
        quiz: true,
        title: 'Straddle K=100, premium 7 · gap +4% to 104 · IV crush',
      },
    },
    quiz: {
      prompt: 'After earnings the stock gaps up 4% to 104 and IV crushes. Did the straddle PROFIT?',
      options: [
        { id: 'yes', label: 'Yes — the stock moved, so my volatility bet won' },
        { id: 'no', label: 'No — 104 is inside the 93/107 breakevens, so it lost' },
      ],
      correctId: 'no',
      explainRight:
        'Correct. 104 is INSIDE the breakevens (93–107), so it is a loss even though the stock moved. Pure breakeven math: at expiry the straddle is worth its intrinsic value max(104−100,0)+max(100−104,0) = 4, less than the 7 paid, so P&L = 4 − 7 = −3 (−$300). To profit, price had to clear 107 (up) or 93 (down). (IV crush is the separate, pre-expiry reason you could not even sell out for leftover time value.)',
      explainWrong:
        'It is No. "It moved 4%, so my bet won" conflates "moved" with "cleared a breakeven." The move needed just to break even was 7 points (the total premium); a 4-point move never reaches 107. P&L = 4 − 7 = −3 (−$300). And IV crush removes any extrinsic value you might have hoped to sell. Clear the breakeven — do not just move.',
    },
    cta: 'Check',
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

  // 13 — QUIZ · quiet or wild
  {
    id: 13,
    type: 'quiz',
    kicker: 'Quiz',
    title: 'Quiet or Wild? Pick the Right Trade',
    intro:
      'IV is very rich heading into earnings, and you expect the stock to barely move — pinning near the 100 strike. Which trade fits best?',
    scene: {
      kind: 'payoff',
      params: {
        structure: 'straddle',
        side: 'short',
        K: 100,
        callPremium: 4,
        putPremium: 3,
        showBreakevens: true,
        quiz: true,
        title: 'Rich IV · you expect a pin near 100 — which trade?',
      },
    },
    quiz: {
      prompt: 'IV is very rich into earnings and you expect a pin near the 100 strike. Which trade fits best?',
      options: [
        { id: 'a', label: 'Long straddle — buy volatility into the event' },
        { id: 'b', label: 'Short straddle — sell the rich premium, accepting the large risk' },
        { id: 'c', label: 'Stay flat — do nothing' },
      ],
      correctId: 'b',
      explainRight:
        'Correct (best-fit). If you genuinely expect a pin and IV is rich, SELLING the straddle lets you keep the fat premium if the stock stays inside 93–107 and benefit from IV crush. The caveat: a short straddle has large/undefined risk if the move is bigger than you expect — so it is only right when you truly expect quiet. (Staying flat, C, is also a reasonable risk-averse choice.)',
      explainWrong:
        'The best-fit for a confident "pin + rich IV" view is B (short straddle). Answer A is the IV-crush trap from module 11 — buying rich premium for an expected small move loses to the move + crush. Answer C (stay flat) is not wrong — it is a defensible, risk-averse call given the short’s unbounded tail risk; it simply forfeits the clearest edge (selling overpriced premium you expect to decay).',
    },
    cta: 'Check',
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
