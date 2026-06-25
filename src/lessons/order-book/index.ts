import type { LessonPackage, ModuleSpec } from '../../engine/types'
import OrderBookIntroScene from './scenes/OrderBookIntroScene'
import TopOfBookScene from './scenes/TopOfBookScene'
import QuoteCardsScene from './scenes/QuoteCardsScene'
import LadderScene from './scenes/LadderScene'
import LimitOrderScene from './scenes/LimitOrderScene'
import MarketOrderScene from './scenes/MarketOrderScene'
import MatchingEngineScene from './scenes/MatchingEngineScene'
import WhoFillsScene from './scenes/WhoFillsScene'
import WalkBookScene from './scenes/WalkBookScene'
import AvgFillQuizScene from './scenes/AvgFillQuizScene'
import SpreadCostScene from './scenes/SpreadCostScene'
import TwoBooksScene from './scenes/TwoBooksScene'
import BounceScene from './scenes/BounceScene'
import OrderTypeQuizScene from './scenes/OrderTypeQuizScene'
import CapstoneScene from './scenes/CapstoneScene'

/**
 * LESSON 1 — "The Order Book: Bids, Asks & the Spread" (spec: planning/Lesson2Spec.md).
 *
 * 15 modules: vocabulary → structure → order types → matching → cost → liquidity →
 * noise → judgment → a live capstone. Every order-book ladder is a DETERMINISTIC
 * ILLUSTRATIVE SIMULATION (labelled "Simulated depth" on-screen, per §4) — all
 * arithmetic (spread, mid, weighted-average fill, slippage, round-trip cost, %) is
 * exactly correct. Real anchors are qualitative & round (AAPL penny spread on a deep
 * book vs a micro-cap several-percent spread on a thin book).
 *
 * Palette convention: green = bid/buy, red = ask/sell/slippage, blue = annotations,
 * calipers, mid line, limit orders, and the integrity label. (On the time-and-sales
 * tape, M13 colors by AGGRESSOR: a buy print at the ask is green, a sell print at the
 * bid is red — still "green = buy pressure, red = sell pressure".)
 */
const modules: ModuleSpec[] = [
  // 1 — INTERACTIVE cold-open ------------------------------------------------
  {
    id: 1,
    type: 'interactive',
    kicker: 'Order book',
    title: 'What Happens When You Hit "Buy"?',
    intro:
      "Press Buy — and follow where your order actually goes. A trade isn't magic: your buy has to meet a seller. Picture two facing lists — what buyers will pay, and what sellers will take. That's the order book. Tap the rungs to meet both sides.",
    scene: {
      kind: 'intro',
      params: {
        asks: [
          { price: 100.04, size: 700 },
          { price: 100.03, size: 500 },
          { price: 100.02, size: 400 },
        ],
        bids: [
          { price: 100.01, size: 600 },
          { price: 100.0, size: 900 },
          { price: 99.99, size: 800 },
        ],
      },
    },
    caption:
      'You pressed Buy and met a seller waiting at 100.02. The best buyer sits at 100.01, the best seller at 100.02 — a 1-cent gap between them. That gap is the spread, and the whole lesson lives in this picture.',
  },

  // 2 — TEACH bid/ask/spread/mid --------------------------------------------
  {
    id: 2,
    type: 'teach',
    kicker: 'Vocabulary',
    title: 'Bid, Ask, Spread, Mid',
    intro:
      "Think of a ticket booth: it buys from you cheap and sells to you dear. BID is the most a buyer will pay. ASK is the least a seller will take. The gap between them, ask − bid, is the SPREAD — the booth's cut. MID is the fair middle, (bid + ask) / 2. And bid is always below ask.",
    scene: { kind: 'topOfBook', params: { bid: 100.0, ask: 100.02 } },
    caption:
      'Spread = ask − bid = 100.02 − 100.00 = 0.02. Mid = (100.00 + 100.02)/2 = 100.01 — the fair middle. Drag the handles, but you can never make a buyer pay more than a seller asks.',
  },

  // 3 — CHALLENGE set the quote ----------------------------------------------
  {
    id: 3,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Set the Quote',
    intro:
      "Now build a valid quote yourself. A buyer's top price has to sit below a seller's floor — otherwise they'd just trade on the spot. Drag the green BID and red ASK so the book is valid (bid below ask) and the spread hits the target exactly.",
    scene: {
      kind: 'quoteCards',
      params: {
        bid: 50.1,
        ask: 50.16,
        targetSpread: 0.04,
        pMin: 49.9,
        pMax: 50.3,
      },
    },
    challenge: {
      prompt: 'Make a valid book with a 4-cent spread.',
      instructions: 'Drag the BID and ASK handles. Goal: bid below ask, and ask − bid = 0.04.',
      submitLabel: 'Lock the quote',
    },
    caption:
      'Two checks every time: is bid below ask (valid?), and does ask − bid equal the target (the spread)? Cross them — a buyer willing to pay the ask — and there is no gap left, because that buyer would simply trade.',
  },

  // 4 — TEACH the ladder & top of book --------------------------------------
  {
    id: 4,
    type: 'teach',
    kicker: 'Structure',
    title: 'The Ladder & the Top of Book',
    intro:
      'The book is a ladder of prices — sellers (asks) stacked above the gap, buyers (bids) below — and each rung holds a SIZE in shares. The two rungs hugging the gap are the top of book: the best buyer and best seller. Toggle cumulative depth for running totals; hover a rung for its notional (its dollar value, shares × price).',
    scene: {
      kind: 'ladder',
      params: {
        asks: [
          { price: 100.1, size: 1500 },
          { price: 100.05, size: 800 },
          { price: 100.03, size: 500 },
          { price: 100.02, size: 400 },
        ],
        bids: [
          { price: 100.01, size: 600 },
          { price: 100.0, size: 900 },
          { price: 99.99, size: 800 },
          { price: 99.95, size: 1200 },
        ],
      },
    },
    caption:
      'Each rung is a price holding a number of shares. Reading down the asks: 400 @ 100.02, then 500 @ 100.03 (900 so far), then 800 @ 100.05 (1,700)… The two rungs hugging the blue gap are the top of book. (Simulated depth.)',
  },

  // 5 — TEACH limit orders rest ---------------------------------------------
  {
    id: 5,
    type: 'teach',
    kicker: 'Order types',
    title: 'Limit Orders Rest in the Book',
    intro:
      "A LIMIT order is like leaving a note: \"I'll pay exactly this price,\" then waiting your turn in line. It rests in the book until someone trades with it — that's adding liquidity (resting shares others can trade against). You set the price, not whether or when it fills. Drag the blue tile onto a bid rung to see your place in the queue.",
    scene: {
      kind: 'limitOrder',
      params: {
        asks: [
          { price: 100.03, size: 500 },
          { price: 100.02, size: 400 },
        ],
        bids: [
          { price: 100.01, size: 600 },
          { price: 100.0, size: 900 },
          { price: 99.99, size: 800 },
        ],
        orderSize: 200,
      },
    },
    caption:
      'Your note rests at 100.00 — but 900 shares are already in line ahead of you at that price, so they fill first. A limit guarantees your price, never a fill. You just added liquidity: shares sitting in the book for others to trade against.',
  },

  // 6 — TEACH market orders cross -------------------------------------------
  {
    id: 6,
    type: 'teach',
    kicker: 'Order types',
    title: 'Market Orders Cross the Spread',
    intro:
      'A MARKET order is grabbing whatever is on the shelf right now, at today\'s price. It crosses the spread and fills instantly against the best opposing rung — so it removes liquidity (it takes resting shares away). You control getting filled, not the price you pay. Toggle LIMIT vs MARKET and fire the same order.',
    scene: {
      kind: 'marketOrder',
      params: {
        asks: [
          { price: 100.04, size: 700 },
          { price: 100.03, size: 500 },
          { price: 100.02, size: 400 },
        ],
        bids: [
          { price: 100.01, size: 600 },
          { price: 100.0, size: 900 },
        ],
        orderSize: 400,
      },
    },
    caption:
      'A market order crosses the spread and fills now — here it grabs the 100.02 offer and prints 400 @ 100.02. You got it done instantly; the price was simply whatever happened to be on the shelf.',
  },

  // 7 — INTERACTIVE matching engine -----------------------------------------
  {
    id: 7,
    type: 'interactive',
    kicker: 'Matching engine',
    title: 'Matching Engine: Price-Time Priority',
    intro:
      'Think of a deli counter with take-a-number tickets. The best price gets served first; if two orders share a price, whoever lined up earliest wins (that is FIFO — first in, first out). Swap the arrival times of the two same-price orders, then fire the market buy and watch the serving order.',
    scene: {
      kind: 'matching',
      params: {
        resting: [
          { id: 'A', price: 20.0, arrival: '9:30:01', size: 100 },
          { id: 'B', price: 20.0, arrival: '9:30:05', size: 100 },
          { id: 'C', price: 20.01, arrival: '9:30:02', size: 100 },
        ],
        incoming: 300,
      },
    },
    caption:
      'Two rules, in order: best price first (20.00 before 20.01), then earliest arrival (A before B at 20.00). A 300-share market buy serves A → B → C — exactly that line.',
  },

  // 8 — CHALLENGE who gets filled --------------------------------------------
  {
    id: 8,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Who Gets Filled?',
    intro:
      "Your turn to call it. X and Y rest at 20.00; Z rests at 20.01. A market buy for 100 shares is about to land. Use the matching rule: best price first, then whoever's waited longest.",
    scene: {
      kind: 'whoFills',
      params: {
        resting: [
          { id: 'X', price: 20.0, arrival: '9:30:01' },
          { id: 'Y', price: 20.0, arrival: '9:30:05' },
          { id: 'Z', price: 20.01, arrival: '9:30:02' },
        ],
      },
    },
    challenge: {
      prompt: 'Click the resting order that fills first.',
      instructions: 'A MARKET BUY 100 arrives. Best price first, then earliest arrival.',
      submitLabel: 'Run the match',
    },
    caption:
      'Price, then time. The best price (20.00) clears before 20.01; among the orders at 20.00, the 9:30:01 order has waited longer than the 9:30:05 one. So X fills first.',
  },

  // 9 — TEACH walking the book & slippage -----------------------------------
  {
    id: 9,
    type: 'teach',
    kicker: 'Cost',
    title: 'Walking the Book & Slippage',
    intro:
      'Picture buying every seat to a show: the cheap seats sell out, so you climb to pricier rows, and your average seat costs more than the cheapest. A big market buy does the same — it eats the next ask rungs, filling at a worse AVERAGE than the touch (the best price). That gap is slippage. Drag the size slider to re-walk the book.',
    scene: {
      kind: 'walkBook',
      params: {
        asks: [
          { price: 100.02, size: 500 },
          { price: 100.05, size: 800 },
          { price: 100.1, size: 1500 },
        ],
        startSize: 1000,
        maxSize: 2800,
      },
    },
    caption:
      '1,000 shares, but only 500 seats at the 100.02 touch — the rest climb to 100.05. Blended average = 100.035, which is 0.015 above the touch: $15 of slippage, the price of taking size in one gulp. (Simulated depth; math exact.)',
  },

  // 10 — CHALLENGE fill the order -------------------------------------------
  {
    id: 10,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Fill the Order',
    intro:
      'The front price holds 400 @ 100.00; behind it sits 600 @ 100.05. It is like a discount bin: once you buy more than the cheap bin holds, the extra comes at the higher price — and your average drifts up. Size a market buy with the slider, sweep the book, and read your average against the touch.',
    scene: {
      kind: 'avgFillQuiz',
      params: {
        asks: [
          { price: 100.0, size: 400 },
          { price: 100.05, size: 600 },
        ],
        startSize: 700,
        maxSize: 1000,
      },
    },
    challenge: {
      prompt: 'Fill a 700-share market buy — what average price do you pay?',
      instructions: 'Drag the slider to size the order, then sweep. Watch your average drift above the 100.00 touch.',
      submitLabel: 'Sweep the book',
    },
    caption:
      'You pay a weighted average — not the touch, not the top. At 700 shares: (400×100.00 + 300×100.05)/700 ≈ 100.021, above the 100.00 touch. Buy past the cheap rung and your average always lands above the best price.',
  },

  // 11 — TEACH the spread is a cost -----------------------------------------
  {
    id: 11,
    type: 'teach',
    kicker: 'Cost',
    title: 'The Spread Is a Cost',
    intro:
      "Crossing the spread isn't free — it's the booth taking its cut. Buying, you pay a bit over the fair mid; selling, you give a bit back. Do both (a round-trip) and you've paid the full spread. Flip between the two anchors and the size slider to see the cost as a % of price.",
    scene: {
      kind: 'spreadCost',
      params: {
        anchors: [
          { name: 'Mega-cap (~$400, 1¢)', bid: 400.0, ask: 400.01 },
          { name: 'Small-cap (~$5, 10¢)', bid: 4.95, ask: 5.05 },
        ],
        startShares: 1000,
      },
    },
    caption:
      "Think of the booth's cut: buying, you pay a little over the fair mid; selling, you give a little back. Do both (a round-trip) and you've paid the whole spread. On a $400 stock a 1¢ spread is ≈0.0025% — basically free. On a $5 stock a 10¢ spread is ≈2% — you start the trade already 2% behind.",
  },

  // 12 — INTERACTIVE deep vs thin -------------------------------------------
  {
    id: 12,
    type: 'interactive',
    kicker: 'Liquidity',
    title: 'Deep vs Thin: Two Books',
    intro:
      'Depth is a lake versus a puddle. Drop the same rock — one big order — and the lake barely ripples, but the puddle splashes everywhere. One shared slider fires the same order into both books: the deep (AAPL-like) book swallows it whole; the thin micro-cap gets gouged across several rungs. Depth is what absorbs size.',
    scene: {
      kind: 'twoBooks',
      params: {
        deep: [
          { price: 400.0, size: 20000 },
          { price: 400.01, size: 25000 },
          { price: 400.02, size: 30000 },
        ],
        thin: [
          { price: 5.0, size: 100 },
          { price: 5.4, size: 100 },
          { price: 6.0, size: 300 },
          { price: 6.5, size: 500 },
        ],
        startSize: 1000,
        maxSize: 2000,
      },
    },
    caption:
      'Same 1,000-share order. The lake (deep book) swallows it whole at the touch — 0% slippage. The puddle (thin book) makes you climb from 5.00 up to 6.50 — a blended 6.09 average, +21.8% above the touch ($1,090 of slippage). Depth is what absorbs size.',
  },

  // 13 — TEACH bid-ask bounce -----------------------------------------------
  {
    id: 13,
    type: 'teach',
    kicker: 'Nuance',
    title: 'Bid-Ask Bounce & the Moving Touch',
    intro:
      'Watch the last price flicker between two shelf-tags even though nothing really changed. As orders post and cancel, prints alternate between the bid and the ask — that is the "bounce" — with no real move in value. Toggle the churn off to flatten the tape. (The touch you see is the NBBO: the best bid and ask across all exchanges.)',
    scene: { kind: 'bounce', params: { bid: 100.0, ask: 100.01 } },
    caption:
      'Buys print at 100.01, sells at 100.00, back and forth — a 1-cent sawtooth — while the mid never budges. That flicker is the bid-ask bounce, not a real price change.',
  },

  // 14 — CHALLENGE limit vs market ------------------------------------------
  {
    id: 14,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Limit or Market? Place the Order',
    intro:
      "You need 200 shares of this thin small-cap. You won't pay above 5.05, and you can wait. The front price holds only 100 shares; the next rung jumps to 5.40. So: leave a note and wait (limit), or grab now and overpay (market)? Pick the tool, then place it.",
    scene: {
      kind: 'orderTypeQuiz',
      params: {
        asks: [
          { price: 5.0, size: 100 },
          { price: 5.4, size: 100 },
        ],
        orderSize: 200,
        limitPrice: 5.05,
        limitMin: 4.95,
        limitMax: 5.45,
      },
    },
    challenge: {
      prompt: 'Pick an order type to buy 200 without paying above 5.05.',
      instructions: 'Choose MARKET or LIMIT. If LIMIT, drag the price. Then place it — your goal is best price, and you can wait.',
      submitLabel: 'Place the order',
    },
    caption:
      '200 shares, a thin book, a hard 5.05 ceiling, and time to wait → leave a note (limit). A 200-share market order fills 100 @ 5.00 then jumps to 5.40 — a 5.20 blended average (+4%) that breaks your rule. Limit controls your price; market only controls getting filled.',
  },

  // 15 — CAPSTONE trade the tape --------------------------------------------
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone',
    title: 'Capstone: Trade the Tape',
    intro:
      'Everything at once. Fill a 1,000-share buy across a live, churning book for the lowest cost you can. Leave notes at the bid to earn the spread (rest limits), then grab the rest at market. Beat the all-market baseline, then answer the check on your own run.',
    scene: {
      kind: 'capstone',
      params: {
        asks: [
          { price: 100.01, size: 300 },
          { price: 100.03, size: 300 },
          { price: 100.05, size: 400 },
          { price: 100.08, size: 600 },
          { price: 100.12, size: 800 },
        ],
        bid: 100.0,
        target: 1000,
        marketClip: 200,
        limitClip: 250,
      },
    },
    caption:
      'You just read a live book, paid the spread, walked it, and beat it. Spread = ask − bid; mid is the fair middle; limits rest (you control price), markets cross (you control the fill); the deli rule fills best price first, then earliest; size climbs into slippage; and depth decides whether your order is a whisper (AAPL-tight) or a shout (small-cap-wide).',
  },
]

const pkg: LessonPackage = {
  lesson: {
    id: 'order-book',
    index: 1,
    title: 'The Order Book',
    subtitle: 'Bids, Asks & the Spread',
    level: 1,
    blurb:
      'Open the matching engine: how bids and asks meet, what the spread really costs you, and why liquidity moves price.',
    modules,
  },
  scenes: {
    intro: OrderBookIntroScene,
    topOfBook: TopOfBookScene,
    quoteCards: QuoteCardsScene,
    ladder: LadderScene,
    limitOrder: LimitOrderScene,
    marketOrder: MarketOrderScene,
    matching: MatchingEngineScene,
    whoFills: WhoFillsScene,
    walkBook: WalkBookScene,
    avgFillQuiz: AvgFillQuizScene,
    spreadCost: SpreadCostScene,
    twoBooks: TwoBooksScene,
    bounce: BounceScene,
    orderTypeQuiz: OrderTypeQuizScene,
    capstone: CapstoneScene,
  },
}

export default pkg
