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
 * LESSON 2 — "The Order Book: Bids, Asks & the Spread" (planning/Lesson2Spec.md).
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
      'Press Buy — and watch where your order actually goes. A trade is not magic: somewhere a buyer and a seller meet inside a two-sided book. Tap the rungs to discover who is who.',
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
      'You pressed Buy — and met a seller resting at 100.02. Between the best buyer (100.01) and best seller (100.02) sits a 1-cent gap: the spread. The rest of the lesson is this picture.',
  },

  // 2 — TEACH bid/ask/spread/mid --------------------------------------------
  {
    id: 2,
    type: 'teach',
    kicker: 'Vocabulary',
    title: 'Bid, Ask, Spread, Mid',
    intro:
      'Four words and one inviolable rule. BID = the highest price a buyer will pay. ASK = the lowest a seller will accept. SPREAD = ask − bid. MID = (bid + ask) / 2. And bid < ask, always.',
    scene: { kind: 'topOfBook', params: { bid: 100.0, ask: 100.02 } },
    caption:
      'Spread = ask − bid = 100.02 − 100.00 = 0.02. Mid = (100.00 + 100.02)/2 = 100.01. Drag the handles — but you can never make the buyer pay more than the seller asks.',
  },

  // 3 — QUIZ spot the spread -------------------------------------------------
  {
    id: 3,
    type: 'quiz',
    kicker: 'Quiz',
    title: 'Spot the Spread',
    intro: 'Three quotes. Each shows a bid and an ask, but the spread, mid, and validity are hidden.',
    scene: {
      kind: 'quoteCards',
      params: {
        cards: [
          { id: 'A', bid: 50.1, ask: 50.14 },
          { id: 'B', bid: 50.2, ask: 50.18 },
          { id: 'C', bid: 50.0, ask: 50.3 },
        ],
      },
    },
    quiz: {
      prompt: 'Which quote has a 4-cent spread AND a valid book?',
      options: [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' },
      ],
      correctId: 'A',
      explainRight:
        'Correct. A: spread = 50.14 − 50.10 = 0.04, mid = 50.12, and bid < ask — so it is both 4-cent and valid.',
      explainWrong:
        'A is the answer. B is crossed (bid 50.20 > ask 50.18) — impossible, a buyer paying ≥ the ask would just trade; its "spread" would be −0.02. C is valid but its spread is 0.30, not 0.04 — tempting if you checked validity but forgot to measure the gap.',
    },
    caption:
      'Two checks every time: bid < ask? (valid) and ask − bid = ? (the spread). A passes both at 4 cents.',
  },

  // 4 — TEACH the ladder & top of book --------------------------------------
  {
    id: 4,
    type: 'teach',
    kicker: 'Structure',
    title: 'The Ladder & the Top of Book',
    intro:
      'The book is a ladder of price levels — asks above the spread, bids below — each with a SIZE in shares. The two rungs hugging the gap are the top of book. Toggle cumulative depth to read running totals; hover a rung for its notional.',
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
      'Every rung is a price with a size. Reading down the asks: 400 @ 100.02, then 500 @ 100.03 (900 cumulative), then 800 @ 100.05 (1,700)… The two rungs hugging the blue gap are the top of book. (Simulated depth.)',
  },

  // 5 — TEACH limit orders rest ---------------------------------------------
  {
    id: 5,
    type: 'teach',
    kicker: 'Order types',
    title: 'Limit Orders Rest in the Book',
    intro:
      'A LIMIT order adds liquidity: it rests at your chosen price until matched. You control the price — not whether or when it fills. Drag the blue tile onto a bid rung and see where you land in the queue.',
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
      'A limit order is a resting offer: you name the price (100.00) and wait your turn — there are already 900 shares ahead of you at 100.00. Guaranteed your price, never guaranteed a fill. You just added liquidity.',
  },

  // 6 — TEACH market orders cross -------------------------------------------
  {
    id: 6,
    type: 'teach',
    kicker: 'Order types',
    title: 'Market Orders Cross the Spread',
    intro:
      'A MARKET order removes liquidity: it crosses the spread and executes immediately against the best opposing level. You control the fill — not the price. Toggle LIMIT vs MARKET and fire the same order.',
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
      'A market order crosses the spread and fills now — here it lifts the 100.02 offer and prints 400 @ 100.02. You got immediacy; the price was simply whatever was resting.',
  },

  // 7 — INTERACTIVE matching engine -----------------------------------------
  {
    id: 7,
    type: 'interactive',
    kicker: 'Matching engine',
    title: 'Matching Engine: Price-Time Priority',
    intro:
      'Orders match by price first, then time (FIFO). Swap the arrival order of the two same-price orders, then fire the market buy and watch who fills first — and in what sequence.',
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
      'Two rules, in order: price first (20.00 before 20.01), then time (A before B at 20.00). A 300-share market buy prints A → B → C — exactly that sequence.',
  },

  // 8 — QUIZ who gets filled -------------------------------------------------
  {
    id: 8,
    type: 'quiz',
    kicker: 'Quiz',
    title: 'Who Gets Filled?',
    intro: 'A small book. X and Y rest at 20.00; Z rests at 20.01. A market buy for 100 shares is about to arrive.',
    scene: {
      kind: 'whoFills',
      params: {
        resting: [
          { id: 'X', price: 20.0, arrival: '9:30:01' },
          { id: 'Y', price: 20.0, arrival: '9:30:05' },
          { id: 'Z', price: 20.01, arrival: '9:30:02' },
        ],
        winnerId: 'X',
      },
    },
    quiz: {
      prompt: 'A market buy for 100 shares arrives. Which resting order fills first?',
      options: [
        { id: 'X', label: 'X' },
        { id: 'Y', label: 'Y' },
        { id: 'Z', label: 'Z' },
      ],
      correctId: 'X',
      explainRight:
        'Correct. The engine takes the best (lowest) ask first → 20.00, and among the orders there, time priority fills the earliest arrival (9:30:01) → X.',
      explainWrong:
        'X fills first. Z arrived early (9:30:02) but rests at 20.01 — a worse price, and no 20.01 share fills until every 20.00 share is gone. Y is at the right price but arrived later (9:30:05) than X. Price first, then time.',
    },
    caption:
      'Price, then time. Best price (20.00) clears before 20.01; within 20.00, the 9:30:01 order beats the 9:30:05 order. X fills first.',
  },

  // 9 — TEACH walking the book & slippage -----------------------------------
  {
    id: 9,
    type: 'teach',
    kicker: 'Cost',
    title: 'Walking the Book & Slippage',
    intro:
      'A market buy larger than the best-ask size eats successive ask levels, filling at a worse AVERAGE than the touch — that gap is slippage. Drag the size slider to re-walk the book live.',
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
      '1,000 shares but only 500 at the 100.02 touch — the rest fills at 100.05. Blended avg = 100.035, which is 0.015 above the touch: $15 of slippage, paid for taking size in one gulp. (Simulated depth; math exact.)',
  },

  // 10 — QUIZ compute the average fill --------------------------------------
  {
    id: 10,
    type: 'quiz',
    kicker: 'Quiz',
    title: "What's the Average Fill?",
    intro:
      'A market buy for 1,000 shares hits asks 100.00 × 400, then 100.05 × 600. The average fill is masked — what is it, approximately?',
    scene: {
      kind: 'avgFillQuiz',
      params: {
        asks: [
          { price: 100.0, size: 400 },
          { price: 100.05, size: 600 },
        ],
        orderSize: 1000,
      },
    },
    quiz: {
      prompt: 'The average fill is approximately…?',
      options: [
        { id: 'a', label: '100.00' },
        { id: 'b', label: '100.03' },
        { id: 'c', label: '100.05' },
      ],
      correctId: 'b',
      explainRight:
        'Correct. avg = (400×100.00 + 600×100.05) / 1000 = (40,000 + 60,030) / 1000 = 100.03 — 0.03 above the 100.00 touch (3¢/sh = $30 of slippage on 1,000 shares).',
      explainWrong:
        'It is 100.03. 100.00 is just the touch — only 400 of the 1,000 fill there; the other 600 walk up to 100.05. 100.05 is the top level reached — it ignores the 400 cheaper shares at 100.00. The weighted average sits between, pulled toward 100.05 because more shares (600) filled there: (400×100.00 + 600×100.05)/1000 = 100.03.',
    },
    caption:
      'Weighted average, not the touch and not the top: (400×100.00 + 600×100.05)/1000 = 100.03. Three cents of slippage — $30 on 1,000 shares.',
  },

  // 11 — TEACH the spread is a cost -----------------------------------------
  {
    id: 11,
    type: 'teach',
    kicker: 'Cost',
    title: 'The Spread Is a Cost',
    intro:
      'Crossing the spread costs ~half the spread vs mid on each side; a round-trip (buy at market, then sell at market) pays the full spread. Flip between the two anchors and the size slider to see the cost as a % of price.',
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
      'Cross to buy: pay ½ spread vs mid. Cross to sell: pay it again. Round-trip = the full spread. On a $400 stock a penny spread (400.00 / 400.01) is ≈0.0025% — noise. On a $5 stock a dime spread is ≈2% — you start 2% in the hole.',
  },

  // 12 — INTERACTIVE deep vs thin -------------------------------------------
  {
    id: 12,
    type: 'interactive',
    kicker: 'Liquidity',
    title: 'Deep vs Thin: Two Books',
    intro:
      'One shared slider fires the same market order into both books. Watch the deep (AAPL-like) book swallow it whole while the thin micro-cap gets gouged across several rungs. Depth absorbs size.',
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
      'Same 1,000-share order. The deep book swallows it whole at the touch — 0% slippage. The thin book makes you walk from 5.00 up through 6.50 — a blended 6.09 average, +21.8% above the touch ($1,090 of slippage). Depth is what absorbs size.',
  },

  // 13 — TEACH bid-ask bounce -----------------------------------------------
  {
    id: 13,
    type: 'teach',
    kicker: 'Nuance',
    title: 'Bid-Ask Bounce & the Moving Touch',
    intro:
      'As orders post and cancel, the touch flickers and prints alternate between bid and ask — the "bounce" — even with no real price change. Toggle the churn off to flatten the tape. (The touch you see is the NBBO: the best quote across all venues.)',
    scene: { kind: 'bounce', params: { bid: 100.0, ask: 100.01 } },
    caption:
      'Buys print at 100.01, sells print at 100.00, back and forth — a 1-cent sawtooth — while the mid never moves. That wiggle is the bid-ask bounce, not a price change.',
  },

  // 14 — QUIZ limit vs market -----------------------------------------------
  {
    id: 14,
    type: 'quiz',
    kicker: 'Quiz',
    title: 'Limit or Market? Pick the Tool',
    intro:
      'You must buy 200 shares of this thin small-cap. You refuse to pay above 5.05, and you can wait. The touch holds only 100 shares; the next rung is 5.40.',
    scene: {
      kind: 'orderTypeQuiz',
      params: {
        asks: [
          { price: 5.0, size: 100 },
          { price: 5.4, size: 100 },
        ],
        orderSize: 200,
        limitPrice: 5.05,
        correctChoice: 'limit',
      },
    },
    quiz: {
      prompt: 'To buy your 200 shares: market order now, or a limit at 5.05?',
      options: [
        { id: 'market', label: 'Market (buy 200 now)' },
        { id: 'limit', label: 'Limit 200 @ 5.05 (rest and wait)' },
      ],
      correctId: 'limit',
      explainRight:
        'Correct. Only 100 shares sit at the 5.00 touch, so a 200-share market order fills 100 @ 5.00 then walks to 5.40 — a 5.20 blended average (+4%), blowing past your 5.05 ceiling. A resting limit at 5.05 guarantees you never overpay, and the constraint says you can wait — the right tool when the book is thin and time is not urgent.',
      explainWrong:
        'A limit at 5.05 is the answer. "Buy now" feels safe, but on a thin book the touch holds only 100 of the 200 shares you need, so a market order walks to 5.40 — a 5.20 blended average (+4%) that violates your own 5.05 rule. Market orders are for deep books or true urgency; here you can wait, so control the price.',
    },
    caption:
      '200 shares, thin book, a hard 5.05 limit, and patience → limit order. A 200-share market order fills 100 @ 5.00 then walks to 5.40 — a 5.20 blended average (+4%) that breaks your rule. Limit controls price; market controls fill.',
  },

  // 15 — CAPSTONE trade the tape --------------------------------------------
  {
    id: 15,
    type: 'capstone',
    kicker: 'Capstone',
    title: 'Capstone: Trade the Tape',
    intro:
      'Everything at once. Fill a 1,000-share buy across a live, churning book at minimum cost — rest limits at the bid to capture the spread, clip the rest at market. Beat the all-market baseline, then answer the check on your own run.',
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
      'You just read a live book, paid the spread, walked it, and beat it. Spread = ask − bid; mid is the fair middle; limits rest (control price), markets cross (control fill); the engine fills best price, then earliest; size walks the book into slippage; and depth decides whether your order is a whisper (AAPL-tight) or a shout (small-cap-wide).',
  },
]

const pkg: LessonPackage = {
  lesson: {
    id: 'order-book',
    index: 2,
    title: 'The Order Book',
    subtitle: 'Bids, Asks & the Spread',
    level: 2,
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
