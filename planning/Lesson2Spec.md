# Lesson 2 — "The Order Book: Bids, Asks & the Spread"

> **What it teaches:** How exchanges actually match trades — read the bid/ask ladder, see why limit orders rest while market orders cross, compute the spread (and a thin book) as a *real* dollar cost, and predict slippage when a market order walks the book.
> **15 modules** (mixed Teach / Interactive / Quiz) ending in a **Capstone**, then a platform‑handled **Congratulations** screen (screen 16, not counted as a module).
>
> **INTEGRITY NOTE — read this first.** Unlike Lesson 1 (where every candle is a *numerically verified* slice of real Yahoo OHLC), **Lesson 2 contains no real‑stock price charts.** Historical Level‑2 order‑book *depth* (resting bid/ask sizes at each rung) is **not freely or reliably available**, so **every depth ladder, queue, fill, and slippage figure in this lesson is a DETERMINISTIC ILLUSTRATIVE SIMULATION** of the matching mechanic and its exact math — generated from a fixed seed so it renders identically every run. These ladders are **labelled "simulated depth" on‑screen** and are **never** presented as a "verified" Level‑2 snapshot.
> The only *real* anchors are **qualitative and round**, and they are genuinely true: a liquid mega‑cap such as **AAPL** routinely quotes a **~1‑cent spread on a deep book**, whereas a thinly traded micro‑cap can show a spread of **many percent on a shallow book**. We state these as qualitative truths, not as fabricated precise snapshots. **All arithmetic** (spread, mid, weighted‑average fill, slippage, round‑trip cost, spread‑as‑%‑of‑price) **is exactly correct.**

---

## 1. How this document is organized

- **§2 Lesson structure** — the 15‑module spine table (every module: #, type, title, the one idea it lands), how the lesson paces easiest → hardest, and how the segmented progress bar advances `completedModules / 15`.
- **§3 Module mechanics** — what each module TYPE does (TEACH, INTERACTIVE, QUIZ, CAPSTONE), reusing Lesson 1's quiz *mask → answer → reveal → grade → explain* pattern exactly.
- **§4 Data sourcing & integrity method** — why this lesson is simulation‑driven, how the seeded ladders are generated, and the real qualitative anchors that keep it honest.
- **§5 Pacing / parameter philosophy** — how the price levels, sizes, spreads and order sequences were chosen so the math and shapes read clearly easiest → hardest.
- **§6 The modules** — *the core deliverable*: one subsection per module, each with goal, "What the learner sees", a step‑by‑step Phaser animation, the interactive element with live readouts, a markdown table of the exact levels/sizes/values to draw, a numbers caption, and (for quizzes) the masked setup, options, correct answer, reveal, and why‑right/why‑wrong.
- **§7 PRD / platform traceability** — every PRD & platform requirement → where it is satisfied.
- **§8 Implementation notes** — the reusable Phaser scenes (`OrderBookScene`, `MatchingEngineScene`, `SpreadCostScene`, `TradeTapeScene`), how interactive state is driven, progress bar, streak, dashboard resume, Firestore shape, responsive behavior, palette.

---

## 2. Lesson structure

This lesson opens the "black box" that Lesson 1 left closed: in Lesson 1 a learner decided *whether* to buy; here they learn *what physically happens* when they do. The lesson moves from **vocabulary → structure → order types → matching → cost → liquidity → noise → judgment → a live capstone.**

### Module spine

| # | Type | Title | The one idea it lands |
|---|---|---|---|
| 1 | Interactive | What Happens When You Hit "Buy"? | A trade isn't magic — a buyer and a seller meet inside a two‑sided book. |
| 2 | Teach | Bid, Ask, Spread, Mid | BID = best buyer price, ASK = best seller price, **bid < ask always**; SPREAD = ask − bid; MID = (bid+ask)/2. |
| 3 | Quiz | Spot the Spread | Pick the valid quote and its spread/mid; reject a *crossed* (impossible) quote. |
| 4 | Teach | The Ladder & the Top of Book | The book is a ladder of price levels, each with a SIZE; best bid/best ask = top of book; cumulative depth. |
| 5 | Teach | Limit Orders Rest in the Book | A LIMIT order **adds** liquidity, rests at your price; you control **price, not fill**. |
| 6 | Teach | Market Orders Cross the Spread | A MARKET order **removes** liquidity, crosses immediately; you control **fill, not price**. |
| 7 | Interactive | Matching Engine: Price‑Time Priority | Orders match by **price first, then time (FIFO)**; a trade PRINTS when marketable meets resting. |
| 8 | Quiz | Who Gets Filled? | Best price first, then earliest arrival — predict which resting order fills. |
| 9 | Teach | Walking the Book & Slippage | A market order bigger than the touch eats successive levels → worse **average** fill = slippage. |
| 10 | Quiz | What's the Average Fill? | Compute the size‑weighted average fill across two levels; see it exceed the touch. |
| 11 | Teach | The Spread Is a Cost | Crossing costs ~½ spread vs mid per side; round‑trip pays the full spread; express it as a % of price. |
| 12 | Interactive | Deep vs Thin: Two Books | Depth absorbs size: a tight, deep book barely moves; a wide, thin book gets gouged by the same order. |
| 13 | Teach | Bid‑Ask Bounce & the Moving Touch | Prints alternate bid↔ask and the touch flickers as orders post/cancel — noise around an unchanged mid (NBBO mentioned lightly). |
| 14 | Quiz | Limit or Market? Pick the Tool | Choose the right order type for the situation (immediacy & depth vs price control & patience). |
| 15 | Capstone | Capstone: Trade the Tape | Fill a 1,000‑share target across a moving book at minimum cost — ties spread/mid, limit vs market, FIFO, walking the book, liquidity together. |

→ **Congratulations screen** (screen 16, platform‑handled, **not** counted as a module).

### How it paces easiest → hardest
- **Modules 1–4 (vocabulary & structure):** purely *reading* — name the two sides, read one quote, then read a whole ladder. No math beyond subtraction and an average of two numbers.
- **Modules 5–8 (mechanics):** introduce the two order types, then *how they interact* in the matching engine. The first quiz (M3) is pure recognition; the second (M8) requires a one‑step priority rule.
- **Modules 9–12 (cost):** the only real arithmetic — size‑weighted average fill (M9/M10), spread‑as‑cost and % of price (M11), then comparing two books (M12). Numbers are chosen so the weighted average lands on a clean value.
- **Modules 13–14 (nuance & judgment):** the bounce (why "price" can wiggle with no real move), then a decision quiz that forces a trade‑off.
- **Module 15 (capstone):** everything at once in a live sim, scored against a benchmark.

### Progress bar
A **segmented bar of 15 ticks** sits at the top of every module, bound to `completedModules / 15`. It ticks **once** when a module is completed (Teach: "Got it"; Interactive: "Continue" after the learner has engaged; Quiz: after the reveal+explanation is shown; Capstone: after the scorecard). The final tick fills entering the Congratulations screen.

---

## 3. Module mechanics (mapped to PRD + platform)

Lesson 2 uses exactly **four** module types — **TEACH, INTERACTIVE, QUIZ, CAPSTONE**. (There is no separate "Intro" type: **Module 1 is an INTERACTIVE module** that happens to serve as the lesson's cold‑open / intro — it is a manipulable discovery sandbox, so it lives under INTERACTIVE below.) All chrome (buttons, readouts, progress bar, streak) is **React**; all animation is **Phaser** scenes. Palette is minimalist **white / blue / green**, with **green = up / buy / long / bid side**, **red = down / sell / short / ask‑consumed**, **blue = annotations, measurements, limit orders**.

### TEACH (modules 2, 4, 5, 6, 9, 11, 13)
> PRD analogue: *"a module which shows the user the concept, with an overlay explaining it."*
1. Phaser draws the concept in (ladder rungs, calipers, order tiles) with sequenced **overlay annotations** that appear one at a time.
2. A short caption ties the numbers to the rule (e.g. "SPREAD = 100.02 − 100.00 = **0.02**").
3. Most Teach modules embed a **small live sandbox** (a drag handle, a toggle) so the concept is *felt*, not just read — there is no pass/fail.
4. **"Got it"** advances; the progress bar ticks.

### INTERACTIVE (modules 1, 7, 12, and the capstone's body)
> A sandbox the learner manipulates with **live‑updating readouts**; **no pass/fail** — exploration that produces an "aha."
1. Phaser renders a manipulable scene; React renders sliders/toggles/draggable tiles and the live readouts.
2. Every input re‑drives the scene **in real time** (re‑walk the book, re‑queue orders, re‑compute averages) at 60fps where possible.
3. A short prompt tells the learner what to try; **"Continue"** advances once they've interacted at least once.

### QUIZ (modules 3, 8, 10, 14) — *reuses Lesson 1's mechanic exactly*
> PRD: *"cover half … ask if the condition is fulfilled … reveal … show right or wrong … explanation telling them why they were wrong."*
1. **Masked / partial state:** show the setup with the *outcome hidden* (a covered card, a pending fill, a masked "average fill" figure, or a masked consequence).
2. **Question:** a **Yes/No** or **A/B/C** prompt.
3. On submit, **animate the REVEAL** (flip the card, walk the book, drop the print, play out the chosen order).
4. **GRADE** Right / Wrong against the deterministic ground truth (the math is fixed and exact).
5. **EXPLANATION** that teaches *why the right answer is right* **and why each tempting wrong answer is wrong** (e.g. "picking 100.00 ignores walking the book").

### CAPSTONE (module 15)
> A multi‑step scenario that scores the learner and recaps the whole lesson.
1. A mini live trading sim (moving book + tape) where the learner places orders to fill a target.
2. A running **scorecard** grades realized average fill vs a benchmark.
3. A **summary reel** replays the lesson's key animations as a recap, then hands off to the Congratulations screen.

---

## 4. Data sourcing & integrity method

**This lesson is simulation‑driven by necessity, and says so.** There is no candle chart to fetch.

- **Why simulated:** real‑time order books exist, but **historical, free, reliable Level‑2 depth** (the resting size at every price level at a past instant) effectively does not. Fabricating a precise "verified" Level‑2 snapshot would violate the project's no‑synthetic‑data‑pretending‑to‑be‑real rule. So the ladders are honest, *labelled* simulations.
- **Deterministic generation:** every ladder/queue is produced by a fixed function `buildBook(seed, params)` — given the same seed and parameters it returns the identical `{ asks:[{price,size}], bids:[{price,size}] }`. This guarantees the figures in this spec match what ships, and that the quiz math is reproducible. The seeds/params live in `src/lessons/lesson2/books.ts`.
- **On‑screen labelling:** every depth scene shows a small blue caption **"Simulated depth — illustrating the matching mechanic"** (per the integrity rule). Nothing in this lesson is tagged "verified."
- **Real qualitative anchors (genuinely true, round):**
  - A liquid mega‑cap like **AAPL** trades with a **~1‑cent (penny) spread on a deep book** during regular hours — used as the "deep/tight" anchor in M11 and M12.
  - A **thinly traded micro‑cap** can show a spread of **several percent on a shallow book** (e.g. a 5–10‑cent spread on a ~$5 stock ≈ 1–2%) — used as the "thin/wide" anchor in M11, M12, M14.
  - **Real names** (AAPL for deep, a generic illiquid small‑cap for thin) are referenced qualitatively; **specific sizes/prices are simulated** and labelled as such.
- **Math integrity:** all derived numbers — spread, mid, cumulative depth, weighted‑average fill, slippage, half‑spread, round‑trip cost, spread % — are **computed, not invented**, and are shown correct in §6. The reference formulas:
  - `spread = ask − bid`  ·  `mid = (bid + ask) / 2`
  - `avgFill = Σ(price_i × shares_i) / Σ shares_i`  (weighted across the levels consumed)
  - `slippage_per_share = avgFill − touch`  ·  `slippage_total = (avgFill − touch) × shares`
  - `halfSpreadCost_per_side = spread / 2` (cost vs mid of crossing one side)
  - `roundTrip_cost_per_share = spread` (buy at ask, sell at bid)  ·  `spread_pct = spread / mid × 100`

---

## 5. Pacing / parameter philosophy

The numbers are chosen so the **mechanic is obvious** and the **arithmetic is clean**:

- **Anchor price ≈ 100.** Most ladders center near \$100 with **1‑cent ticks**, so a 2‑cent spread (100.00 / 100.02) reads instantly and a percentage is trivial (`0.02 / 100.01 ≈ 0.02%`).
- **Round, distinct sizes** (e.g. 400 / 600 / 500 / 800 / 1500 shares) so cumulative depth and weighted averages compute in the learner's head.
- **Quiz averages land clean.** M10 is engineered so `(400×100.00 + 600×100.05)/1000 = 100.03` exactly — no ugly decimals — making the "above the touch" lesson unmistakable.
- **Two contrasting price regimes for cost** (M11/M12): a **~\$400 stock with a 1‑cent spread** (≈0.0025%) vs a **~\$5 stock with a 10‑cent spread** (≈2%) — an **~800× difference in cost %** that the learner *sees* on the same slider.
- **Order types before matching:** limit (M5) and market (M6) are taught *before* the engine (M7) so the learner already knows the two ingredients when they watch them combine.
- **Cost before liquidity:** spread‑as‑cost (M11) precedes deep‑vs‑thin (M12) so "depth matters" lands as *"depth changes the cost I just learned to measure."*
- **Bounce last (M13)** so the learner already trusts bid/ask/mid before being told the printed "price" is partly noise.

---

## 6. The modules (the core)

> **Palette key (used throughout):** white background; **green** = buy pressure (bid side / up / buy‑initiated print / confirm); **red** = sell pressure (ask side consumed / down / sell‑initiated print / slippage); **blue** = annotations, calipers, mid line, limit orders, and the "simulated depth" label. Bid *rungs* render green, ask *rungs* render red, the **spread gap** glows blue. **One nuance, made explicit in M13:** color tracks *side* on the **ladder** (bid rung green / ask rung red) but tracks the *aggressor* on the **time‑and‑sales tape** (a buy‑initiated print, executed at the ask, is **green**; a sell‑initiated print, executed at the bid, is **red**). Both are just "green = buy pressure, red = sell pressure" read in two places.

---

### Module 1 — INTERACTIVE · "What Happens When You Hit 'Buy'?"

- **Type / title:** Interactive (cold‑open discovery sandbox — the lesson's interactive "intro").
- **Context:** Illustrative simulation. Deterministic seeded ladder; qualitative anchor = a liquid name with a 1‑cent gap. No definitions yet — discovery first.
- **Learning goal:** A trade is not magic — somewhere a buyer and a seller agree on a price *inside an order book*. This lesson opens that box.
- **What the learner sees:** A single big **"Buy"** button, like the end of Lesson 1. They press it. Instead of a confirmation, the button **dissolves into an exploding‑view** of a two‑sided ladder: green **bid** rungs slide **up from below**, red **ask** rungs slide **down from above**, leaving a glowing **blue gap** in the middle (the spread). A caption teases: *"Your order didn't vanish — it met the other side. Tap the rungs to see who's who."*
- **ANIMATION (Phaser `OrderBookScene`, intro variant):**
  1. **0.0s** — "Buy" button centered; gentle blue pulse.
  2. **On press (0.0–0.4s)** — button scales up and **dissolves** (alpha→0, particles) using `Cubic.easeOut`.
  3. **0.4–1.1s** — 5 ask rungs descend from top (red, `Back.easeOut`, staggered 80ms) and 5 bid rungs rise from bottom (green, same), each a horizontal bar whose length = (simulated) size.
  4. **1.1–1.6s** — the central **blue spread gap** fades in and a soft glow pulses across it; a small blue label "the spread" hovers, then fades, leaving the rungs tappable.
  5. Idle: rungs shimmer faintly to invite interaction.
- **INTERACTIVE element:** The learner **taps any rung**; each tapped rung **flips its label** to reveal **"bid (buyer)"** (green rungs) or **"ask (seller)"** (red rungs). A live counter shows "Sides discovered: bid ✓ / ask ✓." Once both sides have been revealed, **"Continue"** enables. *Edge case:* tapping the blue gap reveals "the spread — nobody is here yet." No wrong answers; this is pure self‑discovery before any vocabulary.
- **Levels to draw (illustrative seeded ladder):**

  | Side | Price | Size (sim) | Render |
  |---|---|---|---|
  | Ask 3 | 100.04 | 700 | red rung |
  | Ask 2 | 100.03 | 500 | red rung |
  | **Best Ask** | **100.02** | **400** | red, top of ask stack |
  | *(spread gap)* | — | — | **blue glow** |
  | **Best Bid** | **100.01** | **600** | green, top of bid stack |
  | Bid 2 | 100.00 | 900 | green rung |
  | Bid 3 | 99.99 | 800 | green rung |

- **Caption:** "You pressed Buy — and met a *seller* resting at **100.02**. Between the best buyer (**100.01**) and best seller (**100.02**) sits a **1‑cent gap**: the spread. The rest of the lesson is this picture."

---

### Module 2 — TEACH · "Bid, Ask, Spread, Mid"

- **Type / title:** Teach (with a live sandbox).
- **Context:** Illustrative simulation; anchor values **bid 100.00 / ask 100.02** (a real‑feeling penny‑wide quote).
- **Learning goal:** Define the four words and the one inviolable rule. **BID** = highest price a buyer will pay. **ASK/OFFER** = lowest price a seller will accept. **bid < ask, always.** **SPREAD = ask − bid.** **MID = (bid + ask) / 2.**
- **What the learner sees:** The top two rungs from M1 isolated on a vertical price axis. Best bid (green, 100.00) and best ask (red, 100.02) highlight; a **blue caliper** measures the gap and prints **SPREAD = ask − bid = 0.02**; then a **blue midpoint marker** glides to the center printing **MID = (100.00 + 100.02)/2 = 100.01**.
- **ANIMATION (`OrderBookScene`, topOfBook variant):**
  1. Best bid bar pulses green + label "BID 100.00 — best buyer."
  2. Best ask bar pulses red + label "ASK 100.02 — best seller."
  3. A **blue caliper** draws between them (`Sine.easeInOut`), printing "SPREAD = 0.02."
  4. A blue **MID** dot tweens to the midpoint, printing "MID = 100.01."
  5. A rule banner fades in: **"bid < ask, always."**
- **INTERACTIVE element:** **Two draggable handles** set the best bid and best ask along the price axis (1‑cent snap). A live readout recomputes **spread** and **mid** instantly as they drag. **Edge case (the teaching moment):** if the learner ever drags **bid ≥ ask**, the spread label turns **red**, the gap fills with a red hatch, and a warning flashes: **"Crossed book — impossible. A buyer paying ≥ what a seller asks would just trade. bid < ask, always."** Releasing snaps bid back below ask.
- **Levels to draw:**

  | Item | Value | Render |
  |---|---|---|
  | Best bid (draggable) | 100.00 | green handle |
  | Best ask (draggable) | 100.02 | red handle |
  | Spread (computed) | **0.02** | blue caliper label |
  | Mid (computed) | **100.01** | blue dot + label |
  | Invalid state | bid ≥ ask | red hatch + warning |

- **Caption:** "Spread = **ask − bid = 100.02 − 100.00 = 0.02**. Mid = **(100.00 + 100.02)/2 = 100.01**. Drag the handles — but you can never make the buyer pay more than the seller asks."

---

### Module 3 — QUIZ · "Spot the Spread"

- **Type / title:** Quiz (A/B/C).
- **Context:** Illustrative simulation (three quote cards).
- **Learning goal:** Read a quote — compute spread and mid — and **reject an invalid (crossed) quote**.
- **Masked setup:** Three neutral **quote cards** are shown with their bid/ask printed but **no spread/mid revealed and no validity marked**:

  | Card | Bid | Ask | (hidden) Spread | (hidden) Mid | (hidden) Valid? |
  |---|---|---|---|---|---|
  | **A** | 50.10 | 50.14 | 0.04 | 50.12 | ✅ valid (bid < ask) |
  | **B** | 50.20 | 50.18 | — | — | ❌ crossed (bid > ask) |
  | **C** | 50.00 | 50.30 | 0.30 | 50.15 | ✅ valid but wide |

- **Question text:** *"Which quote has a **4‑cent spread** AND a **valid** book?"*
- **Options:** **A** · **B** · **C**
- **Correct answer:** **A.**
- **Reveal animation:** On submit, the chosen card flips face‑up. The **correct card (A)** animates its blue spread caliper (printing **0.04**) and snaps a blue **MID = 50.12** marker into place. If the learner picked **B**, the card **visibly collapses** (the bars overlap and crumble) with a red "CROSSED — impossible" stamp. **C** flips to show a valid but **0.30** caliper.
- **Why right / why wrong:**
  - **A is correct:** spread = 50.14 − 50.10 = **0.04**, mid = **50.12**, and bid < ask, so it's both 4‑cent *and* valid.
  - **B is wrong (the trap):** bid **50.20** > ask **50.18** — a *crossed* book, which **cannot exist** (the buyer would already cross with the seller and trade). Its "spread" would be −0.02; negative spreads aren't real.
  - **C is wrong:** it *is* valid (bid < ask) but its spread is **0.30**, not 0.04 — tempting if you only checked validity and forgot to measure the gap.
- **Caption:** "Two checks every time: **bid < ask?** (valid) and **ask − bid = ?** (the spread). A passes both at 4 cents."

---

### Module 4 — TEACH · "The Ladder & the Top of Book"

- **Type / title:** Teach (scroll/zoom + cumulative‑depth toggle).
- **Context:** Illustrative simulation; depth bars labelled **"simulated depth."**
- **Learning goal:** The book is a **ladder**: ask levels stacked **above** the spread, bid levels **below**, each with a **SIZE** (shares). The **best bid** and **best ask** are the **top of book**. Cumulative depth = total shares available down to a price.
- **What the learner sees:** A tall two‑sided ladder. The camera pans down it; each rung fills a horizontal bar whose **length = size in shares**, with **running cumulative depth** totals counting up beside each level. The **top of book** (best bid / best ask, the rungs bracketing the spread) is boxed in blue.
- **ANIMATION (`OrderBookScene`, fullLadder variant):**
  1. Camera starts at the highest ask, **pans down** (`Sine.easeInOut`) to the lowest bid over ~2s.
  2. Each rung's bar **grows from 0 → size** as it enters view (red asks above, green bids below).
  3. A blue **"TOP OF BOOK"** bracket pulses around best bid + best ask.
  4. Beside each level, a **cumulative depth** number counts up (asks accumulate downward toward the touch; bids accumulate downward away from it).
- **INTERACTIVE element:** The learner **scrolls/zooms** the ladder (wheel/drag/pinch) and **toggles a "cumulative depth" overlay** (on = show running totals; off = show per‑level sizes). **Hovering any rung** surfaces a tooltip: **price × size = notional resting** (e.g. "100.05 × 800 = **\$80,040** resting here"). *Edge case:* scrolling past the ends shows "end of visible book — deeper levels exist but are hidden."
- **Levels to draw (illustrative seeded ladder; cumulative is per‑side from the touch outward):**

  | Level | Side | Price | Size (sim) | Cumulative (sim) |
  |---|---|---|---|---|
  | Ask 4 | ask | 100.10 | 1500 | 3200 |
  | Ask 3 | ask | 100.05 | 800 | 1700 |
  | Ask 2 | ask | 100.03 | 500 | 900 |
  | **Best Ask** | ask | **100.02** | **400** | 400 |
  | — | spread | *(blue gap)* | — | — |
  | **Best Bid** | bid | **100.01** | **600** | 600 |
  | Bid 2 | bid | 100.00 | 900 | 1500 |
  | Bid 3 | bid | 99.99 | 800 | 2300 |
  | Bid 4 | bid | 99.95 | 1200 | 3500 |

- **Caption:** "Every rung is a price with a **size**. Reading down the asks: 400 @ 100.02, then 500 @ 100.03 (**900 cumulative**), then 800 @ 100.05 (**1,700**)… The two rungs hugging the blue gap are the **top of book**." *(Simulated depth.)*

---

### Module 5 — TEACH · "Limit Orders Rest in the Book"

- **Type / title:** Teach (place‑a‑limit sandbox).
- **Context:** Illustrative simulation.
- **Learning goal:** A **LIMIT order adds liquidity**: it **rests** at your chosen price until matched. You **control the price, not whether/when it fills.**
- **What the learner sees:** The ladder from M4. A new **blue limit‑order tile** flies in and **docks onto a bid‑side rung**, lengthening that bar. A **"PROVIDES LIQUIDITY"** tag pulses. The order then **sits and waits** (a gentle idle shimmer) to dramatize that it *may never fill*.
- **ANIMATION (`OrderBookScene`, limitOrder variant):**
  1. A blue tile labelled "LIMIT BUY 200 @ 100.00" slides in from the side (`Back.easeOut`).
  2. It **docks** onto the 100.00 bid rung; that green bar **extends** by the tile's size, and the blue tile nests at the **back of the queue** for that level.
  3. A **"PROVIDES LIQUIDITY"** blue tag pulses once.
  4. Idle shimmer + a "status: **PENDING** — fills only if a seller comes down to you" banner remains.
- **INTERACTIVE element:** The learner **drags a limit‑buy tile to any bid‑side price.** The readout shows: the chosen price, the **queue position at that level (FIFO)** — at 100.00 the M4 ladder already rests **900 shares**, so the learner's tile joins at the **back of the line: "900 shares ahead of you"** — and a persistent **"fills only if a seller crosses down to your price"** status that **stays PENDING** (it actually resolves in M7). *Edge case:* if they drag the tile **above the best bid into the spread**, the readout notes "this would become the new best bid (still resting), or — if at/above the ask — it would cross like a market order (you'll see that next module)."
- **Levels to draw:**

  | Item | Value | Render |
  |---|---|---|
  | Limit buy tile | 200 @ 100.00 | blue tile docked on green rung |
  | Resting size already at 100.00 (from M4 ladder) | 900 | green rung |
  | Queue position | back of the line (FIFO) | blue readout |
  | Shares ahead | 900 | readout |
  | Status | PENDING (provides liquidity) | blue banner |

- **Caption:** "A **limit** order is a *resting* offer: you name the price (100.00) and **wait your turn** in line — there are already **900 shares ahead of you** at 100.00. You're guaranteed your price — never guaranteed a fill. You just **added liquidity**."

---

### Module 6 — TEACH · "Market Orders Cross the Spread"

- **Type / title:** Teach (limit‑vs‑market toggle).
- **Context:** Illustrative simulation; **best ask 100.02 prints** on a market buy.
- **Learning goal:** A **MARKET order removes liquidity**: it **crosses the spread** and executes **immediately** against the best opposing level. You **control the fill, not the price.**
- **What the learner sees:** A red **market‑buy arrow** shoots **upward**, instantly **consumes the best‑ask rung** (its bar shrinks/vanishes), and a **"PRINT"** tape flashes the execution price **100.02**. A **"TAKES LIQUIDITY"** tag appears. The contrast with M5's patient limit is explicit.
- **ANIMATION (`OrderBookScene`, marketOrder variant):**
  1. A red arrow labelled "MARKET BUY 400" launches up from the spread (`Quad.easeIn`).
  2. It strikes the **best ask (100.02 × 400)**; the red bar **flashes white then collapses to 0** (consumed).
  3. A **time‑and‑sales "PRINT 400 @ 100.02"** chip drops onto a small tape with a green flash (a buy print at the ask).
  4. The new best ask becomes 100.03; a red **"TAKES LIQUIDITY"** tag pulses.
- **INTERACTIVE element:** A **toggle: fire the same order as LIMIT vs MARKET.** In **LIMIT** mode the tile **docks and waits** (PENDING, as in M5); in **MARKET** mode it **crosses and prints now** at 100.02. A side panel contrasts the two: **"LIMIT → control PRICE (maybe no fill)"** vs **"MARKET → control FILL (price is whatever's there)."** *Edge case:* toggling to MARKET when the best‑ask size (400) is **smaller** than the order teases module 9 ("bigger orders walk the book — coming up").
- **Levels to draw:**

  | Item | Value | Render |
  |---|---|---|
  | Market buy size | 400 | red arrow |
  | Best ask consumed | 100.02 × 400 | red bar → 0 |
  | Print | 400 @ 100.02 | green chip on tape |
  | New best ask | 100.03 | red rung |
  | Tag | TAKES LIQUIDITY | red |

- **Caption:** "A **market** order **crosses the spread** and fills **now** — here it lifts the 100.02 offer and prints **400 @ 100.02**. You got immediacy; the price was simply *whatever was resting*."

---

### Module 7 — INTERACTIVE · "Matching Engine: Price‑Time Priority"

- **Type / title:** Interactive (queue & fire).
- **Context:** Illustrative simulation.
- **Learning goal:** Orders match by **price‑time priority** — best price first, then **FIFO** (earliest arrival) at each level. A trade **PRINTS** when an incoming **marketable** order meets resting liquidity at the **best opposing** price.
- **What the learner sees:** Resting orders **queue left‑to‑right at each rung**, each stamped with an **arrival timestamp**. An incoming marketable order matches the **front of the best‑priced queue**; the two **annihilate in a green flash**, and a **print drops onto a time‑and‑sales tape.**
- **ANIMATION (`MatchingEngineScene`):**
  1. Resting limit tiles line up at each ask rung with timestamps (e.g. 9:30:01, 9:30:03, 9:30:05) shown in blue.
  2. An incoming **MARKET BUY** arrow approaches; the engine highlights the **best (lowest) ask** queue, then the **front** tile.
  3. Front resting tile + incoming order **flash green and annihilate**; a **PRINT** chip drops on the tape with price, size, time.
  4. Remaining tiles **shuffle forward** (the next becomes front), visualizing FIFO.
- **INTERACTIVE element:** The learner **queues several limit orders** (sets each one's **price + arrival order**), then **sends a marketable order** and watches **who fills first.** They can **reorder arrivals** at the same price to discover that, **at equal price, the earliest order wins.** Live readout: a "fill log" listing each print (price, size, which resting order, in order). *Edge case:* if the incoming size exceeds the front order, it fills the front fully then **continues to the next in queue** (multiple prints) — a gentle preview of walking the book (M9).
- **Levels to draw (illustrative seeded scenario):**

  | Resting order | Price | Arrival | Size | Fill order vs MKT BUY 300 |
  |---|---|---|---|---|
  | A | 20.00 | 9:30:01 | 100 | **1st** (best price, earliest) |
  | B | 20.00 | 9:30:05 | 100 | **2nd** (same price, later) |
  | C | 20.01 | 9:30:02 | 100 | **3rd** (worse price, despite early) |

- **Caption:** "Two rules, in order: **price first** (20.00 before 20.01), then **time** (A before B at 20.00). A 300‑share market buy prints **A → B → C** — exactly that sequence."

---

### Module 8 — QUIZ · "Who Gets Filled?"

- **Type / title:** Quiz (A/B/C).
- **Context:** Illustrative simulation.
- **Learning goal:** At/near the touch, **price beats time, then time breaks ties.** Predict the first fill.
- **Masked setup:** A small book with the **fill hidden** (no order highlighted yet):

  | Resting order | Price | Arrival | Size |
  |---|---|---|---|
  | **X** | 20.00 | 9:30:01 | 100 |
  | **Y** | 20.00 | 9:30:05 | 100 |
  | **Z** | 20.01 | 9:30:02 | 100 |

- **Question text:** *"A **market buy for 100 shares** arrives. Which resting order fills **first**?"*
- **Options:** **X** · **Y** · **Z**
- **Correct answer:** **X.**
- **Reveal animation:** On submit, the engine highlights the **best ask queue (20.00)**, then lights the **front (X)**; X and the incoming order **annihilate** and a **PRINT 100 @ 20.00** drops on the tape. Mis‑picked orders (**Y** or **Z**) briefly highlight, then **dim** with a grey **"still resting"** tag.
- **Why right / why wrong:**
  - **X is correct:** the engine takes the **best (lowest) ask first → 20.00**, and among the two orders at 20.00, **time priority** fills the **earlier arrival (9:30:01) → X**.
  - **Z is wrong (price trap):** Z arrived early (9:30:02) but rests at **20.01**, a *worse* price. Price priority means **no 20.01 fills until every 20.00 share is gone.** Earliness can't beat a worse price.
  - **Y is wrong (time trap):** Y is at the right price (20.00) but arrived **later** (9:30:05) than X — at equal price, **earlier wins.**
- **Caption:** "Price, then time. Best price (20.00) clears before 20.01; within 20.00, the 9:30:01 order beats the 9:30:05 order. **X fills first.**"

---

### Module 9 — TEACH · "Walking the Book & Slippage"

- **Type / title:** Teach (size slider that re‑walks the book).
- **Context:** Illustrative simulation; e.g. touch ask **100.02 (500 sh)**, next **100.05 (800 sh)**, **100.10 (1500 sh)**.
- **Learning goal:** A market buy **larger than the best‑ask size** eats successive ask levels, filling at a **worse AVERAGE price** than the touch — that gap is **slippage**.
- **What the learner sees:** An oversized red order **climbs the ask side rung by rung**; each consumed level **prints its own fill**; a running **average‑price line drifts up away from the touch line**; and the final blended **VWAP** is **boxed against the touch.**
- **ANIMATION (`OrderBookScene`, walkTheBook variant):**
  1. A red **MARKET BUY 1000** arrow rises and consumes **500 @ 100.02** (print 1), then **500 @ 100.05** (print 2 — only 500 of the 800 needed).
  2. As each level fills, a blue **running‑average line** steps **upward** from 100.02 toward the blended value.
  3. The **touch line** (100.02) stays fixed in grey; the gap between it and the average line is shaded red and labelled **"slippage."**
  4. A boxed result: **avg fill 100.035 vs touch 100.02 → slippage 0.015/sh.**
- **INTERACTIVE element:** A **size slider** grows/shrinks the market order; the scene **re‑walks the book live**, redrawing which shares fill at each level, the **average fill**, and **slippage vs the touch** in real time. Live readouts: *shares filled per level, weighted average, slippage per share, slippage total (\$).* *Edge case:* a size ≤ best‑ask size fills entirely at the touch (slippage = 0 — "small orders don't move the book"); a size larger than total visible depth shows "order exceeds visible depth — would walk further / rest as the new ask."
- **Levels to draw (illustrative seeded ladder + a 1,000‑share walk):**

  | Ask level | Price | Size (sim) | Filled by MKT 1000 | Notional |
  |---|---|---|---|---|
  | Touch | 100.02 | 500 | 500 | 50,010.00 |
  | L2 | 100.05 | 800 | 500 | 50,025.00 |
  | L3 | 100.10 | 1500 | 0 | — |
  | **Total** | — | — | **1000** | **100,035.00** |

  **Average fill = 100,035.00 / 1000 = 100.035.  Slippage = 100.035 − 100.02 = 0.015/sh → \$15.00 total.**
- **Caption:** "1,000 shares but only **500** at the 100.02 touch — the rest fills at **100.05**. Blended **avg = 100.035**, which is **0.015 above the touch**: **\$15** of slippage, paid for taking size in one gulp." *(Simulated depth; math exact.)*

---

### Module 10 — QUIZ · "What's the Average Fill?"

- **Type / title:** Quiz (A/B/C; masked outcome).
- **Context:** Illustrative simulation (math exact).
- **Learning goal:** Compute the **size‑weighted average fill** when a market order walks two ask levels, and see it **exceed the touch.**
- **Masked setup:** The ladder and order size are shown; the **"average fill" figure is masked** (a blue "?" chip):

  | Ask level | Price | Size |
  |---|---|---|
  | Touch | 100.00 | 400 |
  | L2 | 100.05 | 600 |

  Order: **MARKET BUY 1,000 shares.**  Average fill = **? (masked).**
- **Question text:** *"A market buy for **1,000 shares** hits asks **100.00 × 400** then **100.05 × 600**. The **average fill** is approximately…?"*
- **Options:** **A. 100.00** · **B. 100.03** · **C. 100.05**
- **Correct answer:** **B. 100.03.**
- **Reveal animation:** On submit, the order **walks both levels** with **per‑level fill chips** (400 @ 100.00, then 600 @ 100.05). A **weighted‑average bar** then **slides to 100.03** and the masked "?" **unmasks to 100.03**, boxed against the 100.00 touch with the slippage shaded.
- **Why right / why wrong:**
  - **B is correct:** `avg = (400×100.00 + 600×100.05) / 1000 = (40,000 + 60,030) / 1000 = 100,030 / 1000 = `**`100.03`**, which is **0.03 above** the 100.00 touch (slippage = 3¢/sh = **\$30** total).
  - **A (100.00) is wrong:** that's the **touch** — it ignores that only **400** of the 1,000 shares fill there; the other **600 walk up** to 100.05.
  - **C (100.05) is wrong:** that's the **top level reached** — it ignores that **400 shares filled *cheaper*** at 100.00, pulling the average **below** 100.05.
  - The true value sits **between** the two prices, **weighted toward 100.05** because more shares (600) filled there.
- **Caption:** "Weighted average, not the touch and not the top: **(400×100.00 + 600×100.05)/1000 = 100.03.** Three cents of slippage — \$30 on 1,000 shares."

---

### Module 11 — TEACH · "The Spread Is a Cost"

- **Type / title:** Teach (spread‑width + size sliders).
- **Context:** Illustrative simulation; anchors **~\$400 mega‑cap with a 1¢ spread (≈0.0025%)** vs **~\$5 small‑cap with a 10¢ spread (≈2%)**. The mega‑cap quote is kept **penny‑aligned** (bid 400.00 / ask 400.01) to respect 1‑cent ticks — its mid is 400.005, *not* a round 400.00.
- **Learning goal:** Crossing the spread costs **~half the spread vs mid on each side**; a **round‑trip** (buy at market, then sell at market) pays the **full spread.** Express it as a **% of price.**
- **What the learner sees:** A trader avatar **buys at the ask** and **immediately sells at the bid**; the price "falls into" the **spread gap twice**, and a **cost meter** tallies **½ spread + ½ spread = full spread**, then converts to a **% of mid.**
- **ANIMATION (`SpreadCostScene`):**
  1. Buy: a green token rises from **mid** to the **ask**; the meter adds **½ spread** ("cost vs mid, side 1").
  2. Sell: the token drops from **mid** to the **bid**; the meter adds the other **½ spread** ("cost vs mid, side 2").
  3. The meter snaps to **full spread = round‑trip cost** and prints the **% of mid.**
  4. A blue caliper labels each half‑spread; the round‑trip total boxes in red.
- **INTERACTIVE element:** The learner sets the **spread width** and **share size** (and can flip between the two preset **anchors**: \$400/1¢ vs \$5/10¢). Live readouts: **per‑side cost vs mid (= spread/2 × shares)**, **round‑trip dollar cost (= spread × shares)**, and **spread‑as‑%‑of‑price (= spread/mid × 100)**. The two presets **visibly diverge**: a 1¢ spread on a \$400 stock vs a 10¢ spread on a \$5 stock. *Edge case:* tightening the spread to 0 zeroes the cost ("a free round‑trip would mean no spread — not realistic, but it shows the spread *is* the cost").
- **Values to draw (both math‑exact):**

  | Anchor | Bid | Ask | Mid | Spread | ½‑spread/side | Round‑trip / sh | Spread % of mid |
  |---|---|---|---|---|---|---|---|
  | Mega‑cap (~\$400, 1¢) | 400.00 | 400.01 | 400.005 | **0.01** | 0.005 | **0.01** | **≈0.0025%** |
  | Small‑cap (~\$5, 10¢) | 4.95 | 5.05 | 5.00 | **0.10** | 0.05 | **0.10** | **≈2.0%** |

  *Penny‑aligned by design: the \$400 book quotes **400.00 / 400.01** on 1‑cent ticks (sub‑penny quoting is prohibited under Reg NMS Rule 612 for stocks ≥ \$1), so its mid lands at **400.005** — half a cent, not a round 400.00. Spread % = 0.01 / 400.005 × 100 ≈ **0.0025%**. Round‑trip on 1,000 shares: mega‑cap = \$10; small‑cap = \$100 — and as a % of capital, **0.0025% vs 2%**, an ~800× difference.*
- **Caption:** "Cross to buy: pay **½ spread** vs mid. Cross to sell: pay it **again.** Round‑trip = **the full spread.** On a \$400 stock a penny spread (400.00 / 400.01) is **0.0025%** — noise. On a \$5 stock a dime spread is **2%** — you start **2% in the hole.**"

---

### Module 12 — INTERACTIVE · "Deep vs Thin: Two Books"

- **Type / title:** Interactive (one slider drives two books).
- **Context:** Illustrative simulation; real qualitative anchors — **AAPL‑like penny spread / deep book** vs a **thinly traded micro‑cap with a several‑percent spread / shallow book.**
- **Learning goal:** A **tight spread + deep book** absorbs size with little impact; a **wide spread + thin book** moves hard on the **same** order. **Depth absorbs size.**
- **What the learner sees:** **Two ladders side by side.** The **same red market order** is fired into both — the **deep book barely flinches** (one rung dented), while the **thin book is gouged** across several rungs with a **large average‑price jump.**
- **ANIMATION (`OrderBookScene` ×2, synced):**
  1. Left = "DEEP (AAPL‑like, ~1¢ spread)"; right = "THIN (micro‑cap, ~%‑wide spread)." Both labelled **"simulated depth."**
  2. On fire, an identical red **MARKET BUY** arrow enters both.
  3. Left: consumes part of the touch only; average line barely lifts (slippage ≈ 0).
  4. Right: walks **several** rungs; average line **jumps** sharply; slippage shaded large and red.
  5. A comparison panel boxes both results.
- **INTERACTIVE element:** **One shared size slider** drives **both** books at once. A **comparison panel** shows, side by side: **average fill, slippage (\$ and %), and price impact** for the liquid vs illiquid name, updating live. The lesson lands when a mid‑size order is **invisible** on the deep book but **devastating** on the thin one. *Edge case:* at very small sizes both fill at the touch (slippage ≈ 0) — "depth only matters once your size approaches the resting size."
- **Values to draw (illustrative seeded ladders; a 1,000‑share buy):**

  | | DEEP book (AAPL‑like, ~\$400) | THIN book (micro‑cap, ~\$5) |
  |---|---|---|
  | Best ask × size | 400.00 × 20,000 | 5.00 × 100 |
  | Next ask × size | 400.01 × 25,000 | 5.40 × 100 |
  | Next ask × size | 400.02 × 30,000 | 6.00 × 300 |
  | Next ask × size | — | 6.50 × 500 |
  | Fill of 1,000 sh | all 1,000 @ 400.00 | 100@5.00, 100@5.40, 300@6.00, 500@6.50 |
  | Avg fill | **400.00** (touch) | **6.09** (walked far above 5.00) |
  | Slippage vs touch | **\$0 (0%)** | **\$1,090 (+21.8%)** |

  *Thin‑book math (exact): (100×5.00 + 100×5.40 + 300×6.00 + 500×6.50) / 1,000 = (500 + 540 + 1,800 + 3,250) / 1,000 = 6,090 / 1,000 = **6.09**; slippage = (6.09 − 5.00) × 1,000 = 1.09/sh × 1,000 = **\$1,090** = (6.09 − 5.00)/5.00 = **+21.8%**. Deep book: 1,000 ≪ 20,000 resting at the 400.00 touch → no walk, avg = 400.00, slippage \$0. The deep book is now anchored at ~\$400 to match the AAPL anchor used in §5/§11.*
- **Caption:** "Same 1,000‑share order. The **deep** book swallows it whole at the touch — **0% slippage.** The **thin** book makes you **walk** from 5.00 up through 6.50 — a blended **6.09** average, **+21.8% above** the touch (**\$1,090** of slippage). **Depth is what absorbs size.**"

---

### Module 13 — TEACH · "Bid‑Ask Bounce & the Moving Touch"

- **Type / title:** Teach (toggle order churn; freeze‑mid overlay).
- **Context:** Illustrative simulation.
- **Learning goal:** As orders **arrive and cancel**, the best bid/ask **flicker** and prints **alternate** between bid and ask — the **"bounce"** — even with **no real price change.** (**NBBO** = best quote across venues, mentioned lightly.)
- **What the learner sees:** The **top of book jitters** as small orders post and cancel; the **last‑print tape** alternates **green (buy‑initiated print, executed at the ask)** and **red (sell‑initiated print, executed at the bid)**, producing a **sawtooth "price"** even while the **mid holds flat.** A faint **NBBO badge** notes "best quote across exchanges."
- **Color convention (read this — it differs from the ladder):** Two different things are being colored. On the **ladder**, color tracks the **side of the rung** — *bid rung = green, ask rung = red* (the global key). On the **time‑and‑sales tape**, color tracks the **aggressor** in the standard market convention — *a **buy‑initiated** print (lifting the ask) is **green**, a **sell‑initiated** print (hitting the bid) is **red**.* These are consistent, not contradictory: green is always "buy pressure" and red always "sell pressure"; what changes is whether you read it on a resting rung or on an executed print. M13's sawtooth is colored by **aggressor** (print color), so a green chip prints at the *ask* (100.01) and a red chip prints at the *bid* (100.00).
- **ANIMATION (`TradeTapeScene` + `OrderBookScene`):**
  1. Small orders **post and cancel** at/near the touch; best bid and best ask **flicker** by a tick.
  2. The tape prints alternate **green (buy at ask)** and **red (sell at bid)** chips, drawing a **sawtooth line.**
  3. A blue **"MID (frozen)"** line is overlaid dead flat across the sawtooth.
  4. A faint **NBBO** badge fades in: "the touch you see = the *best* quote across all exchanges."
- **INTERACTIVE element:** A **toggle** turns **random order arrivals/cancellations on/off**; the learner watches the touch and the printed‑price tape react. A **"freeze mid" overlay** draws a flat line through the sawtooth, **revealing the bounce is noise around an unchanged mid.** Live readout: "last print," "current mid (unchanged)," and a small "prints: N at ask / M at bid" tally. *Edge case:* turning churn **off** flattens the tape to a single repeated print ("no churn → no bounce → the sawtooth was the order flow, not the value").
- **Levels to draw (illustrative; mid pinned at 100.005):**

  | Tick | Best bid | Best ask | Last print | Side | Mid |
  |---|---|---|---|---|---|
  | t1 | 100.00 | 100.01 | 100.01 | ask (green) | 100.005 |
  | t2 | 100.00 | 100.01 | 100.00 | bid (red) | 100.005 |
  | t3 | 100.00 | 100.01 | 100.01 | ask (green) | 100.005 |
  | t4 | 100.00 | 100.01 | 100.00 | bid (red) | 100.005 |

- **Caption:** "Buys print at **100.01**, sells print at **100.00**, back and forth — a 1‑cent **sawtooth** — while the **mid never moves.** That wiggle is the **bid‑ask bounce**, not a price change. (The touch you see is the **NBBO**: the best quote across all venues.)"

---

### Module 14 — QUIZ · "Limit or Market? Pick the Tool"

- **Type / title:** Quiz (A/B scenario picker).
- **Context:** Illustrative simulation.
- **Learning goal:** Choose the right order type: **market** when immediacy matters / the book is deep; **limit** when **price control** matters / the book is **thin** and you **can wait.**
- **Masked setup:** A scenario card + a **thin** book; the **outcome of each choice is hidden** until the learner picks:

  | Ask level | Price | Size |
  |---|---|---|
  | Touch | 5.00 | 100 |
  | L2 | 5.40 | 100 |

  Constraint: *"You must buy **200 shares** of this thin small‑cap. You **refuse to pay above 5.05**, and you **can wait.**"*
- **Question text:** *"To buy your **200 shares**: market order now, or a **limit at 5.05**?"*
- **Options:** **A. Market (buy 200 now)** · **B. Limit 200 at 5.05 (rest and wait)**
- **Correct answer:** **B. Limit at 5.05.**
- **Reveal animation:** On submit, the chosen order **plays out** on the thin book. **Market (A):** the red order takes **100 @ 5.00** (the entire touch) then **jumps to 5.40** for the remaining **100** — blended avg = **5.20**, a huge red **slippage** box and a red verdict "paid 5.20 on average — far above your 5.05 limit." **Limit (B):** a blue tile for 200 shares **rests at 5.05**; status **PENDING** with a green verdict "you control your price — you fill *only if* a seller comes to 5.05, and you never overpay."
- **Why right / why wrong:**
  - **B is correct:** only **100 shares** sit at the 5.00 touch, but you need **200** — so a market order fills 100 @ 5.00 then **walks to 5.40** for the other 100. Blended avg = (100×5.00 + 100×5.40)/200 = **5.20** = **+4% above the 5.00 touch** (the second rung at 5.40 is +8% above the touch, dragging the blend up to 5.20 = +4%), blowing past your 5.05 ceiling. A **resting limit at 5.05** guarantees you **never pay above 5.05** (you may not fill, but the constraint says you **can wait**) — the right trade‑off when the book is **thin** and **time is not urgent.**
  - **A is wrong (the trap):** "buy now" feels safe, but on a **thin** book immediacy is **expensive** — the touch holds only **100** of the **200** shares you need, so the blended average fill (**5.20**, +4%) **violates your own 5.05 rule.** Market orders are for **deep** books or **true urgency**, neither of which applies here. *(Note: it is the **200‑share size** that forces the walk — a market order for ≤ 100 shares would fill entirely at 5.00 and stay under 5.05, which is exactly why the target is 200.)*
- **Caption:** "200 shares, thin book, a hard 5.05 price limit, and patience → **limit order.** A 200‑share market order fills 100 @ 5.00 then walks to 5.40 — a **5.20** blended average (+4%) that breaks your 5.05 rule. **Limit controls price; market controls fill** — match the tool to the situation."

---

### Module 15 — CAPSTONE · "Capstone: Trade the Tape"

- **Type / title:** Capstone (live sim + scorecard + recap).
- **Context:** Illustrative simulation; closing recap cites the **AAPL‑tight vs small‑cap‑wide** contrast as the real‑world takeaway.
- **Learning goal:** Integrate the whole lesson — **read a live book, place orders, and minimize cost while filling a target** — then recap **spread/mid, limit vs market, FIFO matching, walking the book, and liquidity.**
- **What the learner sees:** A **mini trading sim.** The book **updates with bounce** (M13's churn running live); the learner's orders **print to the tape**; a **running scorecard** tallies their **average fill vs mid.** At the end, a **summary reel** replays the lesson's key animations as a recap before the congrats handoff.
- **ANIMATION (`OrderBookScene` + `MatchingEngineScene` + `TradeTapeScene`, orchestrated):**
  1. A live, churning book (mid drifting only slightly) with a **target banner: "BUY 1,000 shares."**
  2. Each learner order animates exactly as taught: limits **dock & wait**; markets **cross & print / walk** with slippage.
  3. A scorecard updates: **shares filled, average fill, cost vs mid, % filled.**
  4. On completion, a **"spread‑cost budget" verdict** (green if under, red if over), then a **3‑shot recap reel** (spread caliper → market‑vs‑limit toggle → walk‑the‑book average line).
- **INTERACTIVE element:** The learner must **fill a 1,000‑share buy target across a moving book** using **any mix of limit and market orders**, trying to **beat a "spread‑cost budget."** The scorecard **grades total slippage** and shows how a **smarter limit/market mix saved cost** (e.g. resting limits at/inside the touch + small market clips to finish). Live readouts: target remaining, average fill so far, cost vs mid, vs an **all‑market baseline.** *Edge cases:* over‑aggressive all‑market filling blows the budget (red) and is contrasted with a mixed strategy; doing nothing leaves the target unfilled and disables completion until at least the target is met.
- **Embedded check (full reveal + explanation, §3 QUIZ pattern):** Before the final scorecard unmasks, the learner answers one **Yes/No** check on their *own* run — *"Did you beat the all‑market (mid‑cross) benchmark?"* The benchmark figure stays **masked** until they answer.
  - **Question:** *"Yes / No — did your realized average fill beat the all‑market baseline?"*
  - **Correct answer (deterministic):** computed from the learner's actual run — **Yes** if `realizedAvgFill < allMarketBaselineAvg`, else **No** (ties = No). The grader compares the two stored numbers exactly, so the "right" answer is whatever the learner truly achieved.
  - **Reveal:** the masked baseline number flips up beside the learner's realized average; a green bar if they beat it, red if not, with the gap (in \$ and ¢/sh) shaded.
  - **Why right / why wrong:**
    - **"Beat it" is right when** the learner **rested limits at/inside the touch** (capturing the spread instead of paying it) and used only **small market clips** to finish — so most shares filled at or below mid and the blended average came in **under** the all‑market walk.
    - **"Beat it" is wrong (you didn't beat it) when** the learner **fired large market clips** that **walked the book**, paying progressively worse rungs; that slippage pushed the realized average **above** the all‑market baseline (or only matched it). The explanation points at **exactly which clips walked** (worse rungs) and **which limits saved the spread**, so the learner sees *where* the cost came from, not just the verdict.
- **Values to draw (illustrative seeded live book; representative end‑state):**

  | Metric | All‑market baseline | A smart mix (limits + small clips) |
  |---|---|---|
  | Target | 1,000 sh | 1,000 sh |
  | Avg fill | ~100.04 (walked) | ~100.015 (mostly rested at/near touch) |
  | Cost vs mid (mid≈100.00) | ~\$40 | ~\$15 |
  | Verdict | over budget (red) | under budget (green) |

- **Caption (recap):** "You just **read a live book, paid the spread, walked it, and beat it.** Spread = ask − bid; mid is the fair middle; **limits rest** (control price), **markets cross** (control fill); the engine fills **best price, then earliest**; size **walks the book** into slippage; and **depth** is what decides whether your order is a whisper (AAPL‑tight) or a shout (small‑cap‑wide)."

---

## 7. PRD / platform traceability

| PRD / platform requirement | Satisfied by |
|---|---|
| Numbered modules within a lesson | §2 — 15 numbered modules (1…15) |
| Teach module: shows concept + explanatory overlay | §3 TEACH; per‑module overlays in §6 (M2,4,5,6,9,11,13) |
| Quiz: masked state → question → reveal → right/wrong → explanation | §3 QUIZ + §6 quizzes (M3,8,10,14) — reuses Lesson 1's mechanic exactly |
| Interactive/animated, interesting modules (Phaser) | §3 INTERACTIVE; §6 animations; §8 scenes |
| No AI‑generated charts presented as real data | §4 — ladders are *labelled* deterministic simulations; **no fabricated "verified" Level‑2** |
| Real‑data integrity where applicable | §0/§4 — real **qualitative** anchors (AAPL penny spread vs micro‑cap wide spread); all math exact |
| Progress bar showing position in lesson | §2 — segmented 15‑tick bar bound to `completedModules / 15`; §8 |
| Streak = most modules completed in one sitting | §8 — `currentSittingCount → bestStreak` |
| Dashboard resume where left off | §8 — Firestore `progress.lastCompletedModule`; resume to `+1` |
| Google‑auth gated dashboard | §8 — Firebase Google sign‑in; user doc on first login |
| Congratulations screen at the end | §2 — screen 16, platform‑handled, not counted |
| Minimalist white/blue/green UI, desktop + mobile | §6 palette key; §8 responsive/relative coords |
| Capstone / recap tying the lesson together | §6 M15 — scored sim + summary reel |

---

## 8. Implementation notes (concise)

- **Reusable Phaser scenes for this lesson:**
  - **`OrderBookScene`** — the workhorse. Renders a two‑sided ladder from `{ asks:[{price,size}], bids:[{price,size}] }`: green bid rungs (length ∝ size), red ask rungs, a blue spread gap, blue calipers/mid marker. **Variants** (a `mode` prop): `intro` (M1 explode‑in + tap‑to‑reveal), `topOfBook` (M2 calipers + drag handles), `fullLadder` (M4 pan/zoom + cumulative overlay), `limitOrder` (M5 dock + queue), `marketOrder` (M6 consume + print), `walkTheBook` (M9 multi‑level walk + running average), `twoBooks` (M12 ×2 synced). Always renders a small blue **"Simulated depth"** label.
  - **`MatchingEngineScene`** — price‑time‑priority queues with timestamps, annihilation flashes, FIFO shuffle (M7, M8, capstone).
  - **`SpreadCostScene`** — the buy‑at‑ask / sell‑at‑bid cost meter, half‑spread calipers, % of mid (M11).
  - **`TradeTapeScene`** — time‑and‑sales tape + bid‑ask‑bounce sawtooth with a frozen‑mid overlay and NBBO badge (M13, capstone).
  - All scenes consume a shared `Book` type and the deterministic `buildBook(seed, params)` from `src/lessons/lesson2/books.ts`; **`CandleChart` from Lesson 1 is *not* reused** here (no candles).
- **How interactive state is driven:** React owns the UI state (slider values, toggles, dragged order tiles, selected quiz option) and pushes it into the active Phaser scene via the scene's registry/events; the scene **recomputes and redraws on every change** (re‑walk the book, re‑queue, re‑average) so readouts update live at interaction speed. Pure functions (`spread`, `mid`, `walk(book, size) → {fills, avgFill, slippage}`, `roundTripCost`, `spreadPct`) live in a tested `src/lessons/lesson2/orderbook.ts` so the same math powers both the scene and the quiz grading.
- **Progress bar:** segmented bar with **15 ticks** bound to `completedModules`; advances once per module (Teach: "Got it"; Interactive: "Continue" after ≥1 interaction; Quiz: after reveal+explanation; Capstone: after the scorecard). 16th state = entering the Congratulations screen.
- **Streak:** keep `currentSittingCount` in memory, increment per module completed, reset on a session gap; persist `bestStreak = max(bestStreak, currentSittingCount)`. *("Most modules completed in one sitting.")*
- **Dashboard resume:** Firestore `users/{uid}` → `{ progress: { lastCompletedModule, completedModules[] }, bestStreak, updatedAt }`. "Resume" jumps to `lastCompletedModule + 1`. (Same shape as Lesson 1, so progress across lessons composes; key module ids as e.g. `L2-1 … L2-15`.)
- **Auth:** Firebase Google sign‑in (the platform shell); create/merge the user doc on first login.
- **Responsive:** ladders/scenes use **relative coordinates** and scale to the container; on mobile the **two‑book view (M12)** stacks vertically and each ladder shows fewer rungs with the **top of book always in view**; sliders/toggles are touch‑sized.
- **Palette:** white background; **green** = bid/buy/up/confirm; **red** = ask‑consumed/sell/down/slippage; **blue** = annotations, calipers, mid line, limit orders, and the "Simulated depth" integrity label.

---

## Congratulations screen (screen 16 — platform‑handled, not a module)

After the capstone scorecard, the platform shows the **Congratulations** screen: a full‑width confetti burst over the minimalist white background, a headline **"Lesson 2 complete — you can read the order book."** and a one‑line recap chip row (**Bid · Ask · Spread · Mid · Limit vs Market · FIFO · Slippage · Liquidity**). It surfaces the session **streak** ("N modules in one sitting — new best!" when `currentSittingCount > previous bestStreak`), shows the **15/15** filled progress bar, and offers **"Back to dashboard"** (which now lists Lesson 2 as complete and points resume at the next lesson). This screen is **not** counted in `completedModules` and renders entirely in React; no Phaser scene runs here.
