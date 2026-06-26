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
      "Press Buy and watch where your order goes. It doesn't vanish — it has to meet a seller. Tap the colored rungs to see both sides.",
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
      'Buyers (green) rest just below sellers (red). The gap between the best of each — here 100.01 to 100.02 — is the spread.',
  },

  // 2 — TEACH bid/ask/spread/mid --------------------------------------------
  {
    id: 2,
    type: 'teach',
    kicker: 'Vocabulary',
    title: 'Bid, Ask, Spread, Mid',
    intro:
      'The BID is the best price a buyer offers. The ASK is the best price a seller wants. Drag the two handles and watch the spread (the gap) and the mid (the middle).',
    scene: { kind: 'topOfBook', params: { bid: 100.0, ask: 100.02 } },
    caption:
      'Spread = ask − bid (here 0.02). Mid = halfway between (100.01). Bid always sits below ask — a buyer can never pay more than a seller asks.',
  },

  // 3 — CHALLENGE set the quote ----------------------------------------------
  {
    id: 3,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Set the Quote',
    intro:
      'Your turn: drag the green BID and red ASK to build a real quote. Keep the bid below the ask, and make the gap exactly 4 cents.',
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
      'A valid book always has bid below ask. The spread is simply the gap between them.',
  },

  // 4 — TEACH the ladder & top of book --------------------------------------
  {
    id: 4,
    type: 'teach',
    kicker: 'Structure',
    title: 'The Ladder & the Top of Book',
    intro:
      'Zoom out: the book is a stack of prices, each holding a number of shares. The two rungs next to the gap — the best buyer and best seller — are the "top of book." Hover any rung to see its value.',
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
      'Every rung is a price and a size. The best bid and best ask sit closest to the spread. (Simulated depth.)',
  },

  // 5 — TEACH limit orders rest ---------------------------------------------
  {
    id: 5,
    type: 'teach',
    kicker: 'Order types',
    title: 'Limit Orders Rest in the Book',
    intro:
      "A LIMIT order says \"I'll only pay this price,\" then waits in line until a seller comes to it. Drag the blue order onto a price to take your spot in the queue.",
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
      'A limit lets you pick the price — but you wait your turn (900 shares are ahead of you here), and it may never fill.',
  },

  // 6 — TEACH market orders cross -------------------------------------------
  {
    id: 6,
    type: 'teach',
    kicker: 'Order types',
    title: 'Market Orders Cross the Spread',
    intro:
      'A MARKET order buys right now at whatever price is available. Toggle LIMIT vs MARKET and fire the same order to feel the difference.',
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
      'A market order fills instantly — but you take whatever price is there (here, 100.02).',
  },

  // 7 — INTERACTIVE matching engine -----------------------------------------
  {
    id: 7,
    type: 'interactive',
    kicker: 'Matching engine',
    title: 'Matching Engine: Price-Time Priority',
    intro:
      'How does the exchange pick who trades first? Best price wins; if prices tie, whoever arrived first wins. Swap the two tickets, then fire the order and watch.',
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
      'Best price first, then earliest arrival. That order fills A → B → C.',
  },

  // 8 — CHALLENGE who gets filled --------------------------------------------
  {
    id: 8,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Who Gets Filled?',
    intro:
      'A market buy for 100 shares is about to land. Using best price first, then earliest arrival, click the order you think fills first.',
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
      'Price first, then time. X and Y both sit at the best price (20.00), but X arrived earlier — so X fills first.',
  },

  // 9 — TEACH walking the book & slippage -----------------------------------
  {
    id: 9,
    type: 'teach',
    kicker: 'Cost',
    title: 'Walking the Book & Slippage',
    intro:
      'A big order eats the cheapest shares first, then climbs to pricier rungs — so your average price ends up worse than the best price. That gap is slippage. Drag the slider to resize the order.',
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
      'Only 500 shares sit at the best price (100.02); the rest climb to 100.05. Your average (100.035) lands above the best price — that gap is slippage. (Simulated depth.)',
  },

  // 10 — CHALLENGE fill the order -------------------------------------------
  {
    id: 10,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Fill the Order',
    intro:
      'The best price holds 400 shares @ 100.00; the next holds 600 @ 100.05. Size a market buy with the slider, sweep the book, and watch your average price.',
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
      'At 700 shares you fill 400 @ 100.00 then 300 @ 100.05 — an average of ≈100.021. Buy past the cheapest rung and your average always drifts above the best price.',
  },

  // 11 — TEACH the spread is a cost -----------------------------------------
  {
    id: 11,
    type: 'teach',
    kicker: 'Cost',
    title: 'The Spread Is a Cost',
    intro:
      "Crossing the spread costs you: you buy a little above the mid and sell a little below it. Buy then sell (a round-trip) and you've paid the full spread. Switch stocks to see how much that really is.",
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
      'What matters is the spread as a % of price. On a $400 stock a 1¢ spread is ≈0.0025% — basically free. On a $5 stock a 10¢ spread is ≈2% — you start 2% behind.',
  },

  // 12 — INTERACTIVE deep vs thin -------------------------------------------
  {
    id: 12,
    type: 'interactive',
    kicker: 'Liquidity',
    title: 'Deep vs Thin: Two Books',
    intro:
      'Depth is a lake vs a puddle. Fire the same order into both books with one slider: the deep book barely moves, the thin one gets gouged across several rungs.',
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
      'Same order, two books. The deep one fills at the best price (0% slippage). The thin one makes you climb from 5.00 to 6.50 — about +22% worse. Depth absorbs size.',
  },

  // 13 — TEACH bid-ask bounce -----------------------------------------------
  {
    id: 13,
    type: 'teach',
    kicker: 'Nuance',
    title: 'The Bid-Ask Bounce',
    intro:
      'Watch the last traded price flip between the bid and the ask even though the stock isn\'t really moving. Buys print at the ask, sells print at the bid — that\'s the "bounce." Toggle the churn off to calm the tape.',
    scene: { kind: 'bounce', params: { bid: 100.0, ask: 100.01 } },
    caption:
      'Buys print at the ask, sells at the bid, back and forth — while the mid never moves. That flicker is the bid-ask bounce, not a real price change.',
  },

  // 14 — CHALLENGE limit vs market ------------------------------------------
  {
    id: 14,
    type: 'challenge',
    kicker: 'Challenge',
    title: 'Limit or Market? Place the Order',
    intro:
      "You want 200 shares but won't pay above 5.05 — and you can wait. The best price has only 100 shares; the next jumps to 5.40. Wait at your price (limit) or grab now and overpay (market)?",
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
      'A market order here fills 100 @ 5.00 then 100 @ 5.40 — a 5.20 average that breaks your 5.05 rule. With time to wait, a limit is the right call. Limit controls price; market controls the fill.',
  },

  // 15 — CAPSTONE trade the tape --------------------------------------------
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone',
    title: 'Capstone: Trade the Tape',
    intro:
      'Put it all together. Fill a 1,000-share buy across a live book for the lowest cost you can: rest limits at the bid to save, then take the rest at market. Try to beat the all-market price.',
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
      "That's the whole order book: spread is the gap, limits wait at your price, markets pay for speed, best price fills first, big orders slip, and depth decides how much your order moves the price.",
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
