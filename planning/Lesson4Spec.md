# Lesson 4 — "Option Contracts: American Calls & Puts"

> What a call and a put really are — the **right (not obligation)** to trade **100 shares** at a fixed **strike** by an **expiry** — plus **premium**, **intrinsic vs time value**, the **hockey-stick payoffs** with exact **breakevens**, **delta / leverage**, and **exercise vs assignment**.
>
> **INTEGRITY NOTE.** Lesson 4 teaches the *mechanics and math of option contracts*, not the recognition of a historical option print. Accordingly:
> - The **underlying stock price anchors** (e.g. "a $100 stock", "AAPL ~$190", "NVDA ~$120") are **real, plausible levels** and where a specific dated chart is shown it is a genuine Yahoo window with `interval`+`period1`+`period2` (the same method as Lessons 1 & 3, bundled in `planning/data/`).
> - **All specific option premiums, implied-volatility figures, theta numbers, and exact delta values are ILLUSTRATIVE DETERMINISTIC SIMULATIONS** — example numbers chosen to make the math land cleanly. They are clearly labelled "illustrative" and are **never** presented as "verified" historical option quotes. What *is* guaranteed exactly correct is the **math built on them**: intrinsic = `max(S−K,0)` / `max(K−S,0)`, breakeven = `K ± premium`, P&L, leverage %, and the payoff geometry. No fabricated precise option-chain snapshot is labelled "verified."

---

## 1. How this document is organized

- **§2 Lesson structure** — the 15-module spine table (every module: #, type, title, the one key idea it lands) and how the lesson paces easiest → hardest; how the segmented progress bar advances `completedModules / 15`.
- **§3 Module mechanics** — what each module TYPE does (TEACH, INTERACTIVE, QUIZ, INTRO, CAPSTONE), mapped to the PRD, reusing Lesson 1's masked → question → reveal → grade → explain quiz pattern exactly.
- **§4 Data sourcing & integrity method** — which artifacts are real underlying anchors vs. illustrative deterministic simulations of option premiums / IV / theta / delta; how the math is held exact.
- **§5 Pacing / parameter philosophy** — how the concept order and the strike / price / premium choices were picked so the shapes & math read clearly easiest → hardest.
- **§6 The modules (THE CORE)** — one subsection per module: type & title; instrument + strike/price context; "What the learner sees"; the ANIMATION; the INTERACTIVE element with live readouts; a markdown TABLE of the exact values/levels to draw; a caption tying numbers to the lesson; and for QUIZ modules the masked setup, the question, the options, the correct answer, the reveal, and a "why right / why wrong" explanation.
- **§7 PRD / platform traceability** — every PRD & platform requirement → where it is satisfied.
- **§8 Implementation notes** — the reusable Phaser scenes for this lesson, how INTERACTIVE state is driven, the segmented progress bar, streak, dashboard resume, Firestore shape, responsive behavior, palette.
- **§9 Congratulations screen** — the end-of-lesson handoff.

---

## 2. Lesson structure

Lesson 4 is **15 modules** then a **Congratulations screen** (screen 16, platform-handled, **not** counted as a module). Unlike Lesson 1's 12 *pairs*, Lesson 4 is a **single conceptual staircase**: each module unlocks exactly one new idea and most TEACH/INTERACTIVE modules are followed shortly by a QUIZ that proves the idea against ground-truth math.

### Module spine

| # | Type | Title | The one key idea it lands |
|---|---|---|---|
| 1 | INTRO | A Coupon on a Stock | An option is the **right, not obligation** to trade **100 shares** at a fixed price by a deadline. |
| 2 | TEACH | Calls vs Puts (and the ×100 Multiplier) | **Call** = right to **BUY** 100 @ K; **Put** = right to **SELL** 100 @ K; premium is per-share **×100**. |
| 3 | QUIZ | Right, Not Obligation | The **buyer chooses** to exercise; they walk away (max loss = premium) when it doesn't help. |
| 4 | TEACH | American vs European Style | **American** = exercise **anytime** to expiry; **European** = expiry only; early exercise usually wastes time value. |
| 5 | TEACH | Premium = Intrinsic + Time Value | Premium splits into **intrinsic** (`max(S−K,0)` / `max(K−S,0)`) + **extrinsic/time**; ITM / ATM / OTM. |
| 6 | QUIZ | How Much Is Real Value? | Separate intrinsic from time value in a quoted premium using the correct formula. |
| 7 | TEACH | Theta: Time Value Decays to Zero | Extrinsic value decays to **zero by expiry** (theta); at expiry an option = exactly its intrinsic value. |
| 8 | TEACH | Long Call & Long Put Payoffs (with Breakevens) | Hockey sticks: long-call **BE = K + premium**, long-put **BE = K − premium**; max loss = premium. |
| 9 | QUIZ | Find the Breakeven | Long-call breakeven = **strike + premium**, not merely "above the strike". |
| 10 | TEACH | The Writer's Side: Short Call & Short Put | Writer **receives premium, takes obligation**: short call ~**unlimited** risk; short put risk to **(K−premium)×100**. |
| 11 | QUIZ | Who Has Unlimited Risk? | Only the **short (naked) call** has theoretically unlimited loss. |
| 12 | INTERACTIVE | Value vs the Underlying (Delta) | Option value moves by **delta** per $1: deep-ITM ≈ tracks shares (δ→1), ATM ≈ 0.5, OTM ≈ small δ. |
| 13 | TEACH | Leverage: $1 Premium, 100 Shares | A small premium controls **100 shares**, amplifying **% gains AND losses** vs owning the stock. |
| 14 | QUIZ | Exercise, Sell, or Let It Expire? | **Sell-to-close** usually beats exercise (keeps time value); ITM auto-exercises, OTM expires worthless, shorts get **assigned**. |
| 15 | CAPSTONE | Build & Read an Option Position | Integrate type/side/strike/premium → live payoff, breakeven, max loss/gain, moneyness, delta; recap. |

Then **screen 16 = Congratulations** (see §9).

### Pacing (easiest → hardest)

1. **Modules 1–4 — "what is it":** the contract, call vs put, the buyer's choice, and exercise style. No payoff math yet, just the shape of the right.
2. **Modules 5–7 — "what is it worth":** premium decomposition, moneyness, and time decay. Introduces the only two formulas the learner must memorize (`max(S−K,0)`, `max(K−S,0)`).
3. **Modules 8–11 — "what do I make / lose":** the four payoff diagrams and breakevens, then the writer's mirror and the unlimited-risk gotcha.
4. **Modules 12–13 — "how does it track the stock":** delta and leverage — the bridge back to "vs the underlying asset."
5. **Module 14 — "how do I get out":** exercise vs sell-to-close vs expire, and assignment.
6. **Module 15 — capstone:** the learner *constructs* a position and reads everything at once.

### Progress bar

A segmented bar of **15 ticks** sits at the top (React chrome). It binds to `completedModules / 15` and ticks **once per module** as the learner taps "Got it" (TEACH/INTRO), "Done exploring" (INTERACTIVE), or submits a QUIZ (graded either way — a wrong answer still advances; the learner is taught, not gated). The **final module (15) is the recap/capstone**; finishing it fills the bar to 15/15 and the platform shows the **Congratulations screen (screen 16, not counted)**.

---

## 3. Module mechanics (mapped to PRD + platform)

Five module types appear in Lesson 4. All animation is **Phaser**; all chrome (header, progress bar, streak pill, buttons, captions) is **React**. Palette is minimalist **white background / blue annotations / green = up·buy·long / red = down·sell·short** (see §8).

### INTRO (module 1)
A gentle TEACH variant that frames the whole lesson with one metaphor (a coupon) and a single light toggle. Animated concept draw-in → one-line interactive toggle → **"Got it"** advances. No pass/fail.

### TEACH (modules 2, 4, 5, 7, 8, 10, 13)
> PRD analog: *"a module which shows the user the chart, and an overlay explaining the … pattern."* Here the "chart" is an option diagram (contract card, premium bar, payoff curve).

1. **Animated concept draw-in** (Phaser): the core object draws itself (card flips in, premium bar grows, payoff line sweeps out).
2. **Sequenced overlay annotations** (blue): labels, formulas, and markers fade in one at a time so the eye follows the logic.
3. A small **embedded manipulation** (slider/toggle) lets the learner perturb one variable and watch the readouts update live — TEACH modules carry a light interactive so nothing is a static picture (PRD: *"not just see an image or a wall of text"*).
4. **"Got it"** advances; the progress bar ticks.

### INTERACTIVE (module 12; capstone 15 is interactive+capstone)
A **sandbox** the learner manipulates with **live-updating readouts** and **no pass/fail** — pure exploration (PRD: *"practice strategies which I learn"*). The scene re-renders continuously as the learner drags. A **"Done exploring"** button advances and ticks the bar.

### QUIZ (modules 3, 6, 9, 11, 14)
> PRD: *"cover half of a chart and ask the user if the condition … is fulfilled. It should then reveal the rest … show them if they were right or wrong … an explanation telling them why they were wrong."*
>
> **Reuses Lesson 1's mechanic exactly:**
1. **Masked / partial state** — the scene shows the setup (an option with S, K, premium, type) but **hides the answer** (the right half of a payoff, the split of a premium bar, the decision branch).
2. **Question** — a **Yes/No** or **A/B/C(/D)** prompt.
3. **Submit → animate the REVEAL** — the hidden half tweens into view (the bar splits, the branch fires, the payoff line completes).
4. **GRADE right / wrong** against **ground-truth math** (computed from the formulas, never eyeballed).
5. **Teaching EXPLANATION** — why the right answer is right *and specifically why the tempting wrong answer is wrong* (e.g., "picking the strike as breakeven forgets the premium you already paid").

A wrong answer is never punitive: it still advances and still counts toward the sitting streak; the value is the explanation.

### CAPSTONE / RECAP (module 15)
A multi-part interactive scenario: the learner **builds** a position (type, side, strike, premium), the scene **auto-labels** breakeven / max loss / max gain / moneyness / delta, a short **embedded check** grades a P&L question against the breakeven, and a **summary reel** replays the lesson's three signature animations before the congrats handoff.

---

## 4. Data sourcing & integrity method

Lesson 4 is a **simulation-driven** lesson (like Lessons 2 & 5), with **real qualitative anchors**:

- **Real underlying anchors.** Stock prices used as the "S" in examples are real, plausible levels for named tickers at the stated rough dates — e.g. **AAPL ≈ $190**, **NVDA ≈ $120 (post-2024 10-for-1 split)**, and a clean **$100 generic** stock for the first modules. Where a module shows an actual price *path* (module 13's leverage comparison and the capstone's underlying), it may load a real daily window via the same Yahoo method used in Lessons 1 & 3:
  `https://query2.finance.yahoo.com/v8/finance/chart/{TICKER}?period1={unixStart}&period2={unixEnd}&interval=1d` (browser `User-Agent`; parse `chart.result[0].timestamp` + `indicators.quote[0].{open,high,low,close}`), bundled in `planning/data/`. The implementer may also use a flat anchor price if no path animation is needed.
- **Illustrative deterministic simulations (clearly labelled).** Every specific **premium**, **implied volatility**, **theta per day**, and **exact mid-curve delta** in this lesson is a chosen example number. They are deterministic (the same inputs always give the same readouts) and are generated so the math is clean — e.g. a $9.00 premium on a 100/107 call splits exactly into $7.00 intrinsic + $2.00 time value. The pre-expiry option **price curve** in modules 7 and 12 is a smooth illustrative curve (a simplified Black-Scholes-shaped arc), **not** a quoted historical option price.
- **What is held exactly correct.** All payoff math and breakevens are computed, not drawn by hand: long-call BE `= K + premium`; long-put BE `= K − premium`; intrinsic `= max(S−K,0)` (call) / `max(K−S,0)` (put); short payoffs are the exact mirror; P&L per contract `= (payoff − cost) × 100`; leverage % is computed from the actual dollars. The reveal in every quiz is graded against these formulas.
- **Integrity guard.** No module presents an invented option-chain row as "verified." The word **"illustrative"** appears in the caption wherever a premium/IV/theta/delta number is shown. Real ticker names and real underlying levels are used only to make the examples feel concrete.

---

## 5. Pacing / parameter philosophy

**Round, legible numbers were chosen so the shapes and arithmetic read instantly:**

- **The generic $100 stock with a $100 strike** opens the lesson so ATM is literally "S = K = 100" and intrinsic is obviously zero — moneyness is read at a glance.
- **The hero example for value decomposition is a 100-strike call at S = 107 priced 9.00** → intrinsic exactly 7, time value exactly 2. The quiz (module 6) reuses these so the learner *recognizes* the split rather than recomputes from scratch.
- **Breakeven examples use small premiums on small strikes** (e.g. strike 50, premium 2.50 → BE 52.50) so the learner can verify `K + premium` in their head and *feel* that "above the strike" (50.01) is still a loss.
- **Strikes/premiums are scaled to the underlying** in delta/leverage modules: a ~$100 underlying with an ATM call at exactly $5.00 (→ $500 per contract) makes "$500 ≈ 5 shares vs 1 contract = 100 shares" exact and the ±10% leverage swing dramatic but honest. A single $500 budget is committed to throughout module 13 so the shares-controlled figures never drift.
- **Concept order mirrors how risk compounds:** rights before obligations (long before short), single variable before two (intrinsic before delta), static expiry payoff before the moving pre-expiry curve. The only two formulas to memorize are introduced together (module 5) and then reused everywhere.
- **The four payoffs are always drawn in the same orientation** (x = stock price at expiry, y = P&L per share; up = green profit, down = red loss) so long↔short is visually "flip across the x-axis" and the learner builds one mental template.

---

## 6. The modules (THE CORE)

Convention used in every diagram below: **x-axis = underlying price S at expiry**, **y-axis = profit/loss per share** (multiply by 100 for per-contract dollars). **Green = up / profit / long / buy**, **red = down / loss / short / sell**, **blue = annotations, axes labels, formulas, breakeven & strike markers**, **white = background**.

---

### Module 1 — INTRO · "A Coupon on a Stock"

- **Learning goal:** An option is a **contract granting the RIGHT, not the obligation**, to trade **100 shares** at a fixed price (the **strike**) by a **deadline** (the **expiry**) — like a price-locking coupon you may or may not redeem.
- **Instrument / context:** Illustrative — a generic **$100 stock**; the contract card reads "strike $100, expires in 30 days." Any premium shown (e.g. "$5.00") is labelled *illustrative example*.
- **What the learner sees:** A familiar paper **coupon** ("$100 OFF — redeem by [date]") sits center-screen. It **morphs** into a sleek **contract card** that reads: *"RIGHT to BUY 100 shares of XYZ at $100 each, on or before [expiry]."* Behind the card, a translucent **stack of 100 share-tiles** materializes to anchor the ×100 multiplier. A one-line caption: *"You hold a right — you choose whether to use it."*
- **ANIMATION (Phaser, `ContractCardScene`):**
  1. `0.0–0.6s` — coupon fades in (white card, blue border), gentle bob (sine ease).
  2. `0.6–1.4s` — coupon **morphs**: corners square off, the "$100 OFF" text cross-fades to the contract sentence; border recolors blue.
  3. `1.4–2.2s` — a 10×10 grid of small **share-tiles** (light blue) cascades in behind the card (stagger 8ms each) and a **"×100"** stamp presses on with a quick scale-overshoot (back-ease).
  4. `2.2s+` — the verb in the sentence ("**BUY**", green) pulses once to invite the toggle.
- **INTERACTIVE element:** Two controls on the card:
  - **CALL ⇄ PUT toggle.** Flipping it rewrites the card sentence in real time: CALL → *"right to **BUY** 100 shares at $100"* (verb green); PUT → *"right to **SELL** 100 shares at $100"* (verb red). The little share-stack icon flips its arrow (in for buy, out for sell).
  - **Deadline slider** (7 → 365 days). Dragging it updates the "expires in N days" line; the card edge shows a subtle hourglass that fills as the deadline shrinks (foreshadows theta in module 7).
  - *Edge case:* at the minimum (7 days) the hourglass is nearly empty and a faint tooltip whispers *"less time = usually less value"* — a teaser, not yet quantified.
- **Levels / values to draw:**

  | Card field | Value (illustrative) |
  |---|---|
  | Underlying | XYZ @ $100 |
  | Strike (K) | $100 |
  | Multiplier | ×100 shares |
  | Expiry | learner-set, default 30 days |
  | Right | toggles BUY (call) / SELL (put) |

- **Caption:** *"An option is a coupon on a stock: the **right** (never the obligation) to **buy** (call) or **sell** (put) **100 shares** at a fixed strike by a deadline. You'll pay a small fee — the premium — for that right. (Premium shown is illustrative.)"*

---

### Module 2 — TEACH · "Calls vs Puts (and the ×100 Multiplier)"

- **Learning goal:** A **CALL** = right to **BUY** 100 shares at strike K by expiry; a **PUT** = right to **SELL** 100 shares at K by expiry. **One contract = 100 shares**, so a quoted **per-share premium ×100 = the dollar cost** of one contract.
- **Instrument / context:** Illustrative — underlying anchored at **$100**; example premium **$3.00 per share → $300 per contract** (labelled illustrative).
- **What the learner sees:** Two contract cards side by side — **CALL** (left, green accent) and **PUT** (right, red accent). When the underlying is drawn **high ($110)**, the call card animates *buying 100 shares at $100* (a green "buy 100 @ 100, worth 110" ribbon). When the underlying is **low ($90)**, the put card animates *selling 100 shares at $100* (a red "sell 100 @ 100 into a 90 market" ribbon). A **"×100"** stamp turns the $3.00 per-share premium into **$300**.
- **ANIMATION (Phaser, `CallPutCompareScene`):**
  1. Two cards slide in from left/right and settle (`0–0.5s`).
  2. A **price ticker** for S sweeps from 90 → 110 along a thin blue vertical gauge between the cards.
  3. When S > K, the **call** card lights green and a ribbon shows *"exercise: buy 100 @ $100, market $110 → +$10/share."* When S < K, the **put** card lights red and a ribbon shows *"exercise: sell 100 @ $100, market $90 → +$10/share."*
  4. The **×100 stamp** drops onto the per-share premium ($3.00) and it ticks up to **$300** (count-up tween).
- **INTERACTIVE element:** Two sliders + a toggle:
  - **Strike K** (50–150) and **current price S** (50–150) sliders.
  - **CALL/PUT** toggle.
  - Live readout: *"Exercising helps? "* → for a call shows **YES when S > K** (green "buy cheap") / **NO when S ≤ K**; for a put shows **YES when S < K** (red "sell dear") / **NO when S ≥ K**. A **dollar cost** field shows `premium × 100` and updates as the (illustrative) premium field is edited.
  - *Edge case:* exactly **S = K** → readout flips to *"ATM — exercising is a wash (no intrinsic gain)."*
- **Levels / values to draw:**

  | Field | Call card | Put card |
  |---|---|---|
  | Right to… | BUY 100 @ K (green) | SELL 100 @ K (red) |
  | Helps when | S **>** K | S **<** K |
  | Example S vs K | S=110, K=100 → +$10/sh | S=90, K=100 → +$10/sh |
  | Per-share premium (illustrative) | $3.00 | $3.00 |
  | Cost of 1 contract | $3.00 × 100 = **$300** | $3.00 × 100 = **$300** |

- **Caption:** *"Call = the right to **buy** 100 shares cheap (good when the stock is **high**). Put = the right to **sell** 100 shares dear (good when the stock is **low**). One contract is **100 shares**, so a $3.00 premium costs **$300**. (Premium illustrative; the ×100 rule is exact.)"*

---

### Module 3 — QUIZ · "Right, Not Obligation"

- **Learning goal:** The **buyer chooses** whether to exercise and will only do so when it helps; otherwise they **walk away**, losing only the **premium**. That choice is exactly what **caps the buyer's loss at the premium**.
- **Instrument / context:** Illustrative — a **CALL, strike 100**, stock at **expiry = 95**. Example premium (e.g. $4) shown only to size the walk-away loss.
- **MASKED setup:** The scene shows the call contract (strike 100), a price marker at **95** at expiry, and a forked path ahead labelled **"Exercise?"** with both branches **greyed/hidden**. The learner must decide before the branches light.
- **Question text:** *"You hold a **CALL** with **strike 100**. At expiry the stock is **95**. Should you **exercise** (buy at 100)?"*
- **Options:** **Yes — exercise** / **No — let it expire**
- **Correct answer:** **NO — let it expire.**
- **REVEAL animation:** On submit, the fork lights up:
  - The **Exercise branch** (red) animates buying 100 @ $100 into a $95 market → a red *"−$5/share = overpaying"* tag; it is crossed out.
  - The **Abandon branch** (green-grey) shows the option expiring worthless with a single tag: *"loss = premium only (e.g. −$4/share)."* A checkmark lands here.
  - A short label: *"Right, not obligation — you simply don't redeem a bad coupon."*
- **Why right / why wrong:**
  - **Why NO is right:** Exercising means **buying at 100 when the market is 95** — you'd overpay by $5/share. You instead let it expire worthless and lose **only the premium** you already paid. (You could buy the shares at $95 in the open market if you wanted them.)
  - **Why "Yes — exercise" is the tempting trap:** New traders feel they "must use" the contract or treat the strike like an entry they're committed to. But an option is a **right, not an obligation** — the whole point. Exercising an **OTM** call manufactures an instant loss on top of the premium. The cap on a long option's loss (= the premium) exists *only because* you can decline to exercise.

---

### Module 4 — TEACH · "American vs European Style"

- **Learning goal:** **American** options are exercisable **any time** up to expiry; **European** options only **at expiry**. **Early exercise of an American option is usually suboptimal** — you throw away remaining **time value** — *except* special cases: (a) a **deep-ITM call just before a dividend**, to capture the dividend; and (b) a **deep-ITM put**, where exercising early to receive the strike cash now earns the **time value of money** on that cash (interest), so it can be rational **even without any dividend**.
- **Instrument / context:** Illustrative — a 90-day American call vs a 90-day European call, both strike 100; time-value figures (e.g. "$2.00 of time value left") are illustrative; the logic is exact.
- **What the learner sees:** Two horizontal **life-of-option timelines**. The **American** timeline is green for its **whole length** (a continuous "exercise allowed" band). The **European** timeline is grey with a single **green tick only at expiry**. An "exercise now" attempt mid-life on the American option visibly **snaps off a chunk of the bar** labelled *"forfeited time value."*
- **ANIMATION (Phaser, `ExerciseTimelineScene`):**
  1. Two tracks draw left→right (`0–0.8s`); American fills green continuously, European stays grey with one green node at the right end.
  2. A draggable **"exercise now" marker** appears on the American track.
  3. When dropped mid-track, the option's **value bar** splits: the **intrinsic** part is realized (green) but the **time-value** part **shatters/falls away** (grey particles) with a red *"−time value"* tag.
  4. A **dividend flag** icon can appear on the timeline; when the marker is dropped just before it on a deep-ITM call, the math flips and a green *"early exercise can win here"* note shows.
- **INTERACTIVE element:** Drag the **"exercise now"** marker along the American option's life. Live readout compares:
  - **Value if exercised now** = intrinsic only (e.g. $6.00).
  - **Value if sold-to-close now** = intrinsic + remaining time value (e.g. $8.00).
  - A verdict line: *"Selling wins by $2.00"* (usual case) that flips to *"Early exercise wins"* only in a special case — for a **call**, when the dividend-capture toggle is on and the residual time value is below the dividend; for a **deep-ITM put**, when the interest earned on the strike cash (collected now) exceeds the residual time value, **even with no dividend**.
  - A small **CALL/PUT** toggle so the learner can see both special cases: the call's dividend exception and the put's interest-on-strike exception.
  - *Edge case:* drag to the far right (at expiry) → time value = 0, so exercise = sell = intrinsic; verdict reads *"at expiry they're equal."*
- **Levels / values to draw:**

  | Style | Exercise window | Mid-life early exercise (illustrative) |
  |---|---|---|
  | American | **anytime** to expiry (green band) | gives up time value (e.g. realize $6 vs sell for $8) |
  | European | **expiry only** (single green node) | not possible before expiry |
  | Special case — call | deep-ITM call before a **dividend** | early exercise may beat holding (capture the dividend) |
  | Special case — put | **deep-ITM put** (no dividend needed) | early exercise can win to earn **interest** on the strike cash now |

- **Caption:** *"American = exercise **anytime**; European = **only at expiry**. Equity options are usually **American**, but exercising early normally **wastes time value** — selling-to-close keeps it. The exceptions are special cases: a **deep-ITM call before a dividend** (to grab the dividend), and a **deep-ITM put** (to earn **interest** on the strike cash now — no dividend required). (Time-value figures illustrative; the trade-off logic is exact.)"*

---

### Module 5 — TEACH · "Premium = Intrinsic + Time Value"

- **Learning goal:** A premium splits into **INTRINSIC** value + **EXTRINSIC (time)** value. **Call intrinsic = max(S − K, 0)**; **Put intrinsic = max(K − S, 0)**. **Moneyness:** ITM (intrinsic > 0), ATM (S ≈ K), OTM (intrinsic = 0).
- **Instrument / context:** Illustrative — a call, strike **100**, with the underlying S draggable; an example total premium so the time-value remainder is visible.
- **What the learner sees:** A vertical **premium bar** split into two stacked segments: a **solid blue INTRINSIC** block on the bottom and a **lighter (translucent) TIME VALUE** block on top. As S slides across the strike, the intrinsic block **grows/shrinks** and a **moneyness tag** (ITM / ATM / OTM) updates.
- **ANIMATION (Phaser, `PremiumBarScene`):**
  1. The total premium bar grows up from the axis (`0–0.5s`).
  2. It **splits** horizontally: intrinsic (solid blue) settles at the bottom, time value (light blue) on top, with two labels fading in.
  3. A blue **strike line** at K and a movable **price marker** at S draw on a mini number-line beside the bar.
  4. As S moves right past K, the intrinsic block tweens taller (`S−K`); as S moves left of K, intrinsic collapses to zero and the whole bar is time value.
- **INTERACTIVE element:** Drag **S** across the strike (mini number-line, 70–130 with K=100). In real time:
  - **Intrinsic** readout `= max(S−K, 0)` (call) updates (e.g. S=107 → 7).
  - **Time value** readout `= premium − intrinsic` (with the illustrative total premium).
  - **Moneyness tag** flips: **OTM** (S<100, intrinsic 0), **ATM** (S≈100), **ITM** (S>100).
  - A **CALL/PUT** toggle switches the formula to `max(K−S,0)` and mirrors the behavior (put is ITM when S < K).
  - *Edge case:* drag S far OTM → intrinsic pinned at 0, bar is 100% time value, tag = OTM; drag S far ITM → time-value sliver shrinks (foreshadows module 7).
- **Levels / values to draw (call example, K=100):**

  | S | Intrinsic = max(S−K,0) | Moneyness | (Illustrative) time value | Premium |
  |---|---|---|---|---|
  | 92 | 0 | OTM | 1.50 | 1.50 |
  | 100 | 0 | ATM | 3.00 | 3.00 |
  | 107 | 7.00 | ITM | 2.00 | 9.00 |
  | 120 | 20.00 | deep ITM | 0.50 | 20.50 |

- **Caption:** *"Premium = **intrinsic** + **time value**. Intrinsic is the in-the-money part (**call: max(S−K,0)**, **put: max(K−S,0)**); the rest is time value. ITM = intrinsic > 0, OTM = intrinsic 0, ATM = right at the strike. (Time-value numbers illustrative; intrinsic math exact.)"*

---

### Module 6 — QUIZ · "How Much Is Real Value?"

- **Learning goal:** Split a quoted premium into intrinsic and time value using the correct formula for the option type.
- **Instrument / context:** Illustrative — **CALL, strike 100, stock at 107, premium 9.00** (the §5 hero example).
- **MASKED setup:** A premium bar of total height **9.00** is shown **un-split** (one grey block, "premium 9.00"), with S=107, K=100 labelled beside it. The intrinsic/time-value split is hidden.
- **Question text:** *"A **CALL**, strike **100**, with the stock at **107**, trades for a **9.00** premium. What is its **intrinsic value** (and therefore its time value)?"*
- **Options (A/B/C):**
  - **A. Intrinsic 9.00 (time value 0.00)**
  - **B. Intrinsic 7.00 (time value 2.00)** ✅
  - **C. Intrinsic 0.00 (time value 9.00)**
- **Correct answer:** **B — intrinsic 7.00, time value 2.00.**
- **REVEAL animation:** On submit, the grey bar **splits**: the bottom **7.00** snaps solid blue (labelled "intrinsic = max(107−100,0) = 7"), the top **2.00** becomes light blue ("time value = 9 − 7 = 2"). Wrong picks first show their **incorrect split** (e.g. A drawn as all-intrinsic) then animate **correcting** to the 7/2 split with a brief red→blue recolor.
- **Why right / why wrong:**
  - **Why B is right:** Call intrinsic `= max(S−K, 0) = max(107−100, 0) = 7`. The remaining `9 − 7 = 2` is **time/extrinsic value** — what you pay for the chance the stock climbs further before expiry.
  - **Why A (9.00) is tempting but wrong:** It treats the **entire premium** as "real" in-the-money value. But part of every pre-expiry premium is time value that **decays to zero by expiry** (module 7). If S sat at 107 *at expiry*, the option would be worth exactly 7, not 9.
  - **Why C (0.00) is wrong:** It treats an **ITM** call as having no intrinsic value. With S (107) **above** K (100), the call *is* in the money by 7 — it is not all time value.

---

### Module 7 — TEACH · "Theta: Time Value Decays to Zero"

- **Learning goal:** **Extrinsic (time) value decays to zero by expiry** — this is **theta**. **At expiry an option is worth exactly its intrinsic value:** OTM → 0, ITM → S−K (call) or K−S (put). Decay **accelerates** near expiry.
- **Instrument / context:** Illustrative — a call, strike 100, with S held at, say, 105 (so intrinsic = 5) and a 60-day life; the decay curve is an illustrative (Black-Scholes-shaped) arc, intrinsic-at-expiry exact.
- **What the learner sees:** The premium bar from module 5, now over a **clock/timeline**. As time runs from "now" to "expiry," the **light-blue time-value segment melts away** — slowly at first, then faster near the end — while the **solid-blue intrinsic block holds constant**. At expiry only the intrinsic block remains (or **nothing**, if OTM).
- **ANIMATION (Phaser, `ThetaDecayScene`):**
  1. A horizontal **time axis** (now → expiry) draws; the premium bar sits at "now" (`0–0.5s`).
  2. A **decay curve** (light blue) sweeps across showing total premium shrinking toward the intrinsic floor; the curve **steepens** in the final third (this is the visual of accelerating theta).
  3. The time-value segment **melts** (height tweens down following the curve) with faint downward particles; the intrinsic block stays put.
  4. At expiry the curve lands exactly on the **intrinsic floor**; if the toggle is set OTM, the floor is **0** and the bar vanishes.
- **INTERACTIVE element:** Drag **time-to-expiry** from far (60d) → near (0d). Live readouts:
  - **Time value** shrinking along the curve (illustrative magnitude, monotonically → 0).
  - **Intrinsic** constant (= max(S−K,0), exact).
  - **Total premium** = the sum.
  - A **moneyness toggle** (ITM/ATM/OTM) changes the floor: ITM floor = intrinsic, ATM/OTM floor = 0.
  - *Edge case:* set OTM and drag to expiry → the whole bar reaches **0** ("expires worthless"); set ATM → at expiry value ≈ 0 (only intrinsic, which is ~0).
- **Levels / values to draw (call, K=100, S=105, illustrative time value):**

  | Days to expiry | Intrinsic (exact) | Time value (illustrative) | Total premium |
  |---|---|---|---|
  | 60 | 5.00 | 3.00 | 8.00 |
  | 30 | 5.00 | 1.80 | 6.80 |
  | 7 | 5.00 | 0.60 | 5.60 |
  | 0 (expiry) | 5.00 | **0.00** | **5.00** |

- **Caption:** *"Time value bleeds to **zero by expiry** — that's **theta**, and it speeds up near the end. **At expiry the option is worth exactly its intrinsic value**: an OTM option becomes worthless, an ITM one is worth S−K (call) / K−S (put). Holding too long just bleeds the time-value you paid for. (Decay curve illustrative; intrinsic-at-expiry exact.)"*

---

### Module 8 — TEACH · "Long Call & Long Put Payoffs (with Breakevens)"

- **Learning goal:** **At expiry**, the **long call** is a hockey stick kinked **up at K** with **BE = K + premium**; the **long put** is a hockey stick kinked **down at K** with **BE = K − premium**. **Max loss for either long = the premium.**
- **Instrument / context:** Illustrative — long call (K=100, premium 5 → BE 105) and long put (K=100, premium 5 → BE 95).
- **What the learner sees:** A blank P&L grid (x = price at expiry, y = profit/share). The **long-call** line draws: **flat at −5** (the premium) for all S ≤ 100, then **rises 1-for-1 (45°)** above 100; a blue **breakeven marker lands exactly at 105**. Then the **long-put** mirror draws: flat at −5 for S ≥ 100, rising as S falls below 100, breakeven at **95**.
- **ANIMATION (Phaser, `PayoffScene` — the lesson's workhorse):**
  1. Axes draw with the **strike line** at K (blue, dashed) and the **zero-P&L line** (grey).
  2. **Long call:** the flat **−premium** leg draws left→right (red while below zero), reaches K, then a green leg rises at 45°; as it crosses zero, a blue **BE marker** snaps to **K + premium = 105** with a label.
  3. **Long put** (on toggle): mirror — green leg rising as S→0 on the left, flat red −premium leg on the right, **BE marker at K − premium = 95**.
  4. The **max-loss floor** (−premium) is shaded faint red; the **unbounded profit** arrow (green) points up the rising leg (call) or toward S=0 (put, capped at K−premium profit).
- **INTERACTIVE element:** Drag **K** and **premium** sliders; toggle **CALL/PUT**. In real time:
  - The payoff line and the **BE marker recompute** (`BE = K + premium` for the call, `K − premium` for the put).
  - The flat **max-loss leg stays pinned at −premium**.
  - Readouts: **Breakeven**, **Max loss = premium**, **Max gain** ("unlimited" for the call; **K − premium** for the put, since S can't go below 0).
  - *Edge case:* premium → 0 makes BE = K (the kink sits on the zero line); a large premium pushes BE far from K and deepens the red floor.
- **Levels / values to draw:**

  | Position | Flat leg (max loss) | Kink at | Slope above/below K | Breakeven | Max gain |
  |---|---|---|---|---|---|
  | Long call (K=100, prem 5) | −5 for S ≤ 100 | 100 | +1 for S > 100 | **105** (K+prem) | unlimited |
  | Long put (K=100, prem 5) | −5 for S ≥ 100 | 100 | +1 for S < 100 | **95** (K−prem) | **95** (K−prem) at S=0 |

- **Caption:** *"A long option's **most you can lose is the premium** — the flat leg. The **long call** profits above **K + premium (105)**; the **long put** profits below **K − premium (95)**. Notice the call's upside is **unlimited** while the put's max gain is **K − premium** (the stock can't fall below 0). (Breakeven math exact; premium illustrative.)"*

---

### Module 9 — QUIZ · "Find the Breakeven"

- **Learning goal:** **Long-call breakeven = strike + premium.** The holder profits **above the breakeven**, not merely above the strike.
- **Instrument / context:** Illustrative — **long CALL, strike 50, premium 2.50.**
- **MASKED setup:** A payoff grid with the call's **flat −2.50 leg** and rising leg drawn, but the **breakeven marker hidden** (a "?" floats on the rising leg). Strike line at 50 is visible.
- **Question text:** *"You buy a **CALL**, **strike 50**, for a **2.50** premium. What stock price at expiry is your **breakeven**?"*
- **Options (A/B/C):**
  - **A. 47.50** (K − premium)
  - **B. 50.00** (the strike)
  - **C. 52.50** (K + premium) ✅
- **Correct answer:** **C — 52.50.**
- **REVEAL animation:** On submit, the rising leg's crossing of the zero line **snaps a blue BE marker to 52.50**. A small dot at **50.00** (the tempting answer) is shown still sitting **−2.50 below zero** (a red tag: *"at the strike you've only recovered intrinsic 0 — still down the premium"*). The 47.50 pick is shown **off the chart on the flat leg** (a red tag: *"that's the put formula"*).
- **Why right / why wrong:**
  - **Why C is right:** `BE = K + premium = 50 + 2.50 = 52.50`. At expiry the call's value is `max(S−50,0)`; you only recoup the 2.50 you paid once `S − 50 = 2.50`, i.e. **S = 52.50**.
  - **Why B (50) is the classic trap:** "It's above the strike, so I'm winning." No — at S = 50 the call's intrinsic is exactly **0**, so you're still down the full **2.50** premium. "Above the strike" is **not** profit; you must clear **strike + premium**.
  - **Why A (47.50) is wrong:** That's `K − premium`, the **long-put** breakeven. A call needs the stock to go **up** past 52.50, not down.

---

### Module 10 — TEACH · "The Writer's Side: Short Call & Short Put"

- **Learning goal:** The **seller/writer receives the premium** up front and takes on **obligation**. **Short (naked) call = theoretically UNLIMITED risk** (price can rise without bound). **Short (cash-secured) put = large risk down to (K − premium)**, with **max loss = (K − premium) × 100** if the stock goes to 0.
- **Instrument / context:** Illustrative — short call (K=100, premium 5) and short put (K=100, premium 5); the longs from module 8 are their mirrors.
- **What the learner sees:** The same payoff grid, now showing the **short** lines as **mirror images** of the longs across the x-axis. **Short call:** flat at **+5** (premium received) for S ≤ 100, then **falling without bound** above 100 (a red tail that runs off the top of the loss region). **Short put:** flat at **+5** for S ≥ 100, then falling toward **−(K − premium) = −95** as S → 0.
- **ANIMATION (Phaser, `PayoffScene`, short mode):**
  1. The long call (faint, green) is shown, then **reflected across the x-axis** to become the short call (red) — the reflection tween makes "long ↔ short = flip" visceral.
  2. The short-call's **falling tail** extends past the visible grid with an off-screen **⚠ "unlimited"** arrow.
  3. **Short put** (on toggle): mirror of the long put — flat +5 on the right, falling left to a **floor at −95** with a label *"max loss (K−premium) = 95/share = $9,500 per contract."*
  4. A **risk badge** updates per position.
- **INTERACTIVE element:** A **LONG ⇄ SHORT** toggle and a **CALL/PUT** toggle over draggable K/premium. The payoff **flips across the x-axis** when toggling long/short, and a **risk badge** updates:
  - Long call/put → **"Max loss = premium."**
  - Short call → **"Max loss = UNLIMITED."**
  - Short put → **"Max loss = (K − premium) × 100"** (e.g. 95 × 100 = **$9,500**).
  - Readouts also show **max gain**: short call/put max gain = **premium received** (flat leg).
  - *Edge case:* toggling to short call paints the badge red and animates the tail off-screen; toggling to short put pins the floor at S=0.
- **Levels / values to draw:**

  | Position | Premium flow | Flat leg (max gain) | Risk side | Max loss |
  |---|---|---|---|---|
  | Short call (K=100, prem 5) | **+5 received** | +5 for S ≤ 100 | rises above 100 | **unlimited** |
  | Short put (K=100, prem 5) | **+5 received** | +5 for S ≥ 100 | falls below 100 | **(K−prem)×100 = $9,500** |
  | (vs) Long call | −5 paid | −5 floor | upside | premium (5) |
  | (vs) Long put | −5 paid | −5 floor | downside | premium (5) |

- **Caption:** *"The **writer collects the premium** and is **obligated**. A **short call** must deliver shares no matter how high the stock climbs → **unlimited** risk. A **short put** must buy shares at K → loss grows as the stock falls, **capped at (K − premium) × 100** (here $9,500) because the stock can't go below 0. Short = the **mirror** of long across the x-axis. (Premium illustrative; risk math exact.)"*

---

### Module 11 — QUIZ · "Who Has Unlimited Risk?"

- **Learning goal:** Among the four single-leg positions, **only the short (naked) call** has theoretically **unlimited** loss; the other three are bounded (longs by the premium, short put by strike − premium).
- **Instrument / context:** Illustrative — all four at K=100, premium 5.
- **MASKED setup:** Four small payoff thumbnails (long call, long put, short call, short put) are shown with their **loss tails masked** (the loss region is fogged). The learner must pick which one's loss is unbounded **before** the fog lifts.
- **Question text:** *"Which single-leg option position has **theoretically UNLIMITED** loss?"*
- **Options (A/B/C/D):**
  - **A. Long call**
  - **B. Long put**
  - **C. Short call** ✅
  - **D. Short put**
- **Correct answer:** **C — short call.**
- **REVEAL animation:** The fog lifts on all four:
  - **Long call** & **long put** show their **flat −5 floors** (green "max loss = premium" tags).
  - **Short put** shows its floor at **−95** ("capped: stock can't go below 0").
  - **Short call**'s tail **extends off-screen** with a red ⚠ banner *"loss → ∞ as S rises."*
- **Why right / why wrong:**
  - **Why C is right:** A naked short call is **obligated to deliver 100 shares at K** no matter how high S goes; to deliver, the writer buys at the (arbitrarily high) market price, so loss **grows without bound** as S rises. There is no ceiling on a stock price.
  - **Why D (short put) is the most tempting wrong answer:** A short put *does* have large risk and *feels* symmetric to the short call — but the stock **cannot fall below 0**, so the worst case is the stock at 0: loss = **(K − premium) × 100 = $9,500**. Large, but **bounded**.
  - **Why A/B are wrong:** A long option's loss is **capped at the premium** you paid — you can always just decline to exercise (module 3). Bounded, and small.

---

### Module 12 — INTERACTIVE · "Value vs the Underlying (Delta)"

- **Learning goal:** As the stock moves, the option's value changes by **delta per $1**. **Deep-ITM ≈ tracks the shares (δ → 1), ATM ≈ 0.5, OTM ≈ small δ.** **Delta is the slope of the option's price curve.** This is the direct answer to "value compared to the underlying asset."
- **Instrument / context:** Illustrative — a **call, strike 100**, ~30 days out; a smooth **pre-expiry price curve** (illustrative BS-shaped) overlaid on the **at-expiry hockey stick** from module 8. Delta values are example/qualitative; the *slope behavior* is correct.
- **What the learner sees:** Two curves on the P&L/price grid: the **at-expiry hockey stick** (sharp kink at 100) and, above it, the **smooth pre-expiry curve** (rounded near the strike, hugging the hockey stick far ITM/OTM). A **tangent line** rides the smooth curve; its **slope = delta**. The tangent is **near-flat** far OTM, **~45° (0.5)** at the money, and **~steep (→1)** deep ITM — visibly showing the option "becoming the stock" deep ITM.
- **ANIMATION (Phaser, `DeltaCurveScene`, extends `PayoffScene`):**
  1. The at-expiry hockey stick draws (faint), then the **smooth pre-expiry curve** sweeps over it (blue).
  2. A **tangent segment** appears at the current S and a **δ gauge** (0 → 1) shows its slope.
  3. As S moves, the tangent **tilts**: flat (δ≈0.12) at S=85, ~45° (δ≈0.50) at S=100, steep (δ≈0.90) at S=120 — matching the table below exactly.
  4. A **"shares-equivalent" badge** = δ × 100 shows how many shares this one contract currently behaves like.
- **INTERACTIVE element:** Drag **S** along the curve (70–135). Live readouts:
  - **Delta** (illustrative): e.g. **0.12** at S=85, **0.50** at S=100, **0.90** at S=120.
  - **"$1 move → option gains ~$δ"**: at δ=0.5, a +$1 stock move ≈ **+$0.50** option (≈ **+$50 per contract**).
  - **Shares-equivalent = δ × 100**: e.g. 90 shares deep ITM vs 12 shares deep OTM — the learner *feels* deep-ITM tracking shares while OTM barely moves.
  - *Edge case:* drag deep ITM (S=135) → δ ≈ 0.97, badge ≈ 97 shares, tangent nearly parallel to the 45° share line ("this contract is basically 100 shares now"); drag deep OTM → δ ≈ 0.03, badge ≈ 3 shares ("barely responds").
- **Levels / values to draw (call, K=100, illustrative deltas):**

  | S | Moneyness | Delta (illustrative) | $ move per +$1 stock | Shares-equiv (δ×100) |
  |---|---|---|---|---|
  | 85 | deep OTM | 0.12 | +$0.12/sh | 12 |
  | 100 | ATM | 0.50 | +$0.50/sh | 50 |
  | 110 | ITM | 0.75 | +$0.75/sh | 75 |
  | 120 | deep ITM | 0.90 | +$0.90/sh | 90 |

- **Caption:** *"**Delta** is how much the option moves per **$1** in the stock — the **slope** of its price curve. **Deep-ITM options ≈ track the shares (δ near 1)**, **ATM ≈ 0.5**, **OTM ≈ small δ**. So one deep-ITM contract behaves like ~100 shares, while a far-OTM one barely budges. (Delta values illustrative; slope behavior exact.)"*

---

### Module 13 — TEACH · "Leverage: $1 Premium, 100 Shares"

- **Learning goal:** A small premium **controls 100 shares**, amplifying **percentage gains AND losses** versus buying the stock outright — including the possibility of a **−100% wipeout**.
- **Instrument / context:** Real anchor — a ~**$100 stock** (e.g. AAPL-scale; the implementer may load a real daily window such as `…/chart/AAPL?...&interval=1d` from `planning/data/`, or use a flat $100 anchor). Example **ATM call premium $5.00 (→ $500/contract)** is illustrative; the returns are computed exactly from the inputs.
- **What the learner sees:** A side-by-side comparison from the **same $500 budget**: on the left, **$500 buys 5 shares** of a $100 stock; on the right, the **same $500 buys one $5.00 ATM call**, which **controls 100 shares**. On a **+10% move** the option's **% return dwarfs** the stock's; on a **−10% move** the option's **% loss is equally magnified** (and any close at/below the strike at expiry hits **−100%**). The single $500 anchor is used everywhere in this module so the shares-controlled figure (5 shares vs 100 shares) stays consistent with the table below.
- **ANIMATION (Phaser, `LeverageScene`):**
  1. Two columns: **STOCK** (green) and **CALL** (blue) seeded with the same dollars.
  2. A **% move dial** sweeps; both columns' values animate. The **CALL bar swings far more** in both directions (a longer green up-bar and a longer red down-bar).
  3. At the strike-down threshold the CALL bar **bottoms at −100%** (premium fully lost) with a red "wipeout" tag, while the stock bar shows only its modest loss — the asymmetry of leverage made visual.
- **INTERACTIVE element:** Drag the **% move in the underlying** (−30% → +30%). Live comparison panel:
  - **Stock % return** = the move itself (the $500 buys 5 shares at $100).
  - **Option % return** computed exactly from the payoff: `( max(S_new − K, 0) − premium ) / premium`.
  - Dollar P&L for each from the **same $500 starting budget** (5 shares vs 1 contract).
  - *Edge case:* any move that leaves the call **at/below the strike at expiry** shows **−100%** (premium gone) while the stock is only modestly down — the headline lesson that leverage cuts both ways.
- **Levels / values to draw (stock $100, ATM call K=100, premium $5.00 → $500/contract; same $500 deployed; expiry P&L):**

  | Underlying move | New stock price | Stock %return | Call value at expiry = max(S−100,0) | Call %return = (val−5)/5 |
  |---|---|---|---|---|
  | +20% | 120 | **+20%** | 20.00 | **+300%** |
  | +10% | 110 | **+10%** | 10.00 | **+100%** |
  | +5% | 105 | +5% | 5.00 | **0%** (breakeven = K+prem = 105) |
  | 0% | 100 | 0% | 0.00 | **−100%** |
  | −10% | 90 | **−10%** | 0.00 | **−100%** |

- **Caption:** *"$500 buys exactly **5 shares** of a $100 stock — or **one $5.00 call controlling 100 shares**. A **+10%** move turns the stock's +10% into the call's **+100%**; but **0% or down** turns into **−100%** (the whole premium). Same direction, **magnified both ways** — that's leverage. (Underlying anchor real; premium illustrative; returns computed exactly.)"*

---

### Module 14 — QUIZ · "Exercise, Sell, or Let It Expire?"

- **Learning goal:** **Sell-to-close usually beats exercise** (you keep the time value); **ITM options auto-exercise** at expiry, **OTM expire worthless**, and the **short side gets ASSIGNED**.
- **Instrument / context:** Illustrative — you hold an **ITM call worth 8.00** (intrinsic 6.00 + time value 2.00) with **one week left**, and you want out.
- **MASKED setup:** The held call is shown with its **8.00** premium bar split into **6.00 intrinsic + 2.00 time value**. Three action doors are shown closed: **Exercise**, **Sell-to-close**, **Let it expire**.
- **Question text:** *"You hold an **ITM call worth 8.00** (intrinsic **6.00**, time value **2.00**) with **a week left**, and you want out **now**. Should you **exercise** or **sell-to-close**?"*
- **Options (A/B/C):**
  - **A. Exercise** (buy the shares at K)
  - **B. Sell-to-close** ✅
  - **C. Let it expire worthless**
- **Correct answer:** **B — sell-to-close.**
- **REVEAL animation:** The chosen door opens:
  - **Sell-to-close** (green): captures the **full 8.00** (you hand the contract to another buyer who pays for both intrinsic *and* the remaining time value). A green *"+8.00 realized"* tag.
  - **Exercise** (amber): converts to **100 shares at K**, realizing only the **6.00 intrinsic**; the **2.00 time value shatters** (red *"−2.00 thrown away"*).
  - **Let it expire** (red): nonsensical here — you'd forfeit all 8.00; shown crossed out.
  - A side note fires an **"ASSIGNMENT"** envelope to the *writer* of this call ("if you'd been short, you'd be assigned — forced to deliver shares").
- **Why right / why wrong:**
  - **Why B is right:** Selling-to-close captures the **full 8.00**, including the **2.00 of time value**. Exercising realizes only the **6.00 intrinsic** and **throws away the 2.00**. **Early exercise of an American option is usually suboptimal** — the exception is special cases like **capturing a dividend** (module 4).
  - **Why A (exercise) is the tempting trap:** It feels like "claiming" your in-the-money value, but it **forfeits the remaining time value** and ties up far more capital (you'd pay K × 100 to own the shares). Unless you specifically want the shares (or there's a dividend to capture), selling is better.
  - **Why C (let it expire) is wrong:** Letting an **ITM** option you still hold expire would waste real value — though note that **at expiry** an ITM option you do nothing with is **auto-exercised** by the broker, and an **OTM** one simply **expires worthless**. The point of this scenario (a week left, wanting out) is to **sell** and keep the time value.

---

### Module 15 — CAPSTONE · "Build & Read an Option Position"

- **Learning goal:** Integrate **call/put**, **long/short**, **intrinsic vs time value**, **payoff/breakeven**, **delta**, **leverage**, and **exercise/assignment** into one position the learner **constructs and reads** — then recap the lesson.
- **Instrument / context:** Real anchor — a ~**$120 stock** (e.g. NVDA-scale, post-split; implementer may load a real daily window from `planning/data/` or use a flat anchor). All payoff/breakeven math exact; example premiums labelled illustrative.
- **What the learner sees:** A **position builder** on the left (four controls) and the **live payoff diagram + readout panel** on the right. As the learner sets the position, the payoff line, breakeven marker, and max-loss/max-gain labels assemble in real time. A final **challenge** asks them to build a specific position; an **embedded P&L check** grades them; then a **summary reel** replays the lesson's signature animations.
- **ANIMATION (Phaser, `CapstonePayoffScene`, reuses `PayoffScene` + `PremiumBarScene` + `DeltaCurveScene`):**
  1. Each control change re-tweens the payoff line, the BE marker, and the shaded max-loss/max-gain regions.
  2. On the embedded check submit, a **price marker drops at the given expiry price**, a **vertical guide** runs to the payoff line, and the **P&L is read off and labelled** (green if profit, red if loss) relative to the breakeven.
  3. **Summary reel** (`~6s`): the **intrinsic-split** bar (mod 5), the **hockey-stick** payoff (mod 8), and the **delta-tangent** (mod 12) replay in sequence, each with its one-line takeaway, before the **"Finish Lesson"** button glows.
- **INTERACTIVE element:** Four controls the learner sets:
  - **Type** (Call / Put), **Side** (Long / Short), **Strike K** (slider around the ~$120 anchor), **Premium** (illustrative slider).
  - The panel shows, computed live and exactly: **Breakeven** (`K + prem` long call / `K − prem` long put; mirrored for shorts), **Max loss**, **Max gain**, **current moneyness** (from the anchor S), and **delta** (illustrative, from the curve).
  - **Challenge:** *"Build a **bullish** position with **defined (capped) risk**."* The builder accepts **Long Call** (and flags Short Put as *bullish but with large/undefined-feeling risk* — teaching the distinction). A green check confirms a long call; a hint nudges away from naked shorts.
  - **Embedded P&L check (the graded quiz piece):** *"Given your built position, if the stock is **[expiry price]** at expiry, is it **profitable**, and by how much?"* → the reveal drops the price marker, reads the payoff, and shows **P&L per share and ×100 per contract** against the breakeven, with an explanation tying back to `K ± premium`.
  - *Edge case:* if the learner builds a short call, the readout shows **"Max loss = unlimited"** and the challenge is marked "not defined-risk" — reinforcing module 11.
- **Levels / values to draw (worked example — Long Call, K=120, premium $6.00 → BE 126):**

  | Readout | Value | Formula |
  |---|---|---|
  | Breakeven | **126.00** | K + premium = 120 + 6 |
  | Max loss | **$600 / contract** | premium × 100 = 6 × 100 |
  | Max gain | **unlimited** | rising leg above 126 |
  | Moneyness at S=120 | **ATM** | S ≈ K |
  | Delta (illustrative) | **≈ 0.50** | ATM slope |
  | P&L if S=130 at expiry | **+$400 / contract** | (max(130−120,0) − 6) × 100 = (10 − 6) × 100 |
  | P&L if S=123 at expiry | **−$300 / contract** | (3 − 6) × 100 — above strike but **below** breakeven |

- **Caption / recap:** *"You built it and read it: a **long call**, strike **120**, premium **$6** → breakeven **126**, max loss **$600**, max gain **unlimited**, ATM with **δ≈0.5**. Profit needs the stock above **breakeven (126)**, not just above the strike — at 123 you're still **−$300**. That single chart ties together everything in this lesson: the right (not obligation), premium = intrinsic + time, the hockey-stick payoff, delta, and leverage. (Underlying anchor real; premium illustrative; all P&L math exact.)"*

---

## 7. PRD / platform traceability

| PRD / platform requirement | Satisfied by |
|---|---|
| Lesson is a sequence of **numbered modules** | §2 — 15 numbered modules + Congratulations (screen 16). |
| Module shows a **chart/diagram + overlay explaining the concept** (Teach analog) | §3 TEACH; per-module overlays/levels in §6 (contract card, premium bar, payoff curves). |
| **Where to buy / sell** (long vs short, exercise decision) | §6 modules 2, 8, 10, 14 — long/short payoffs, exercise vs sell-to-close, assignment. |
| **Quiz**: partial state → "is the condition fulfilled?" → **reveal** → right/wrong → **why** | §3 QUIZ; modules 3, 6, 9, 11, 14 — masked setup → question → reveal animation → grade vs ground-truth math → explanation incl. why-wrong. |
| **No AI-generated / fabricated "real" data** | §4 — real underlying anchors; all premiums/IV/theta/delta labelled **illustrative deterministic simulations**, never "verified". |
| **Interactive, not a wall of text** ("practice strategies") | §3 INTERACTIVE + light interactivity in every TEACH; module 12 sandbox; module 15 builder. |
| **Progress bar** showing position in lesson | §2 + §8 — segmented bar, `completedModules / 15`, ticks once per module. |
| **Streak = most modules completed in one sitting** | §8 — `currentSittingCount` → `bestStreak`. |
| **Dashboard resume** where left off | §8 — Firestore `progress.lastCompletedModule`; resume to `+1`. |
| **Google auth** gated dashboard | §8 — Firebase Google sign-in; user doc on first login. |
| **Congratulations screen** at the end | §2 + §9 — screen 16, platform-handled, not counted. |
| **Minimalist white / blue / green**, green=up·buy·long, red=down·sell·short, blue=annotations | §6 palette convention; §8 palette. |
| **Animated, interesting modules (Phaser)** | §6 every module's ANIMATION; §8 reusable scenes. |
| **Works on desktop + mobile** | §8 — relative coords, responsive canvas, touch-friendly sliders/toggles. |

---

## 8. Implementation notes (concise)

**Reusable Phaser scenes (build once, reuse across modules):**
- **`ContractCardScene`** (mod 1, 2) — the coupon→contract card morph, CALL/PUT verb swap, ×100 stamp, share-stack.
- **`PremiumBarScene`** (mod 5, 6, 7) — the stacked intrinsic (solid blue) / time-value (light blue) bar; `setS(S)`, `setType()`, `setTimeToExpiry()` drive it; theta decay is the same bar over a time axis.
- **`PayoffScene`** (mod 8, 9, 10, 11, 13, 15) — **the workhorse**. Plots P&L vs price for a position `{type, side, K, premium}`; draws the flat max-loss leg, the kinked leg, the **breakeven marker** (`K ± premium`), shaded max-loss/max-gain regions, and supports the **long↔short reflection** tween. Quiz modules mask the loss tail / breakeven and tween it in on reveal (mirrors Lesson 1's `CandleChart` mask-rectangle pattern).
- **`DeltaCurveScene`** (mod 12, 15) — overlays the smooth pre-expiry curve on the at-expiry hockey stick, rides a **tangent (=delta)**, and shows the δ×100 shares-equivalent badge.
- **`ExerciseTimelineScene`** (mod 4, 14) — American/European exercise bands, the draggable "exercise now" marker, time-value-forfeit shatter, and the assignment envelope.
- **`LeverageScene`** (mod 13) — twin stock/option columns driven by a % move dial, exact return math, −100% wipeout state.
- A **`CapstonePayoffScene`** (mod 15) composes `PayoffScene` + `PremiumBarScene` + `DeltaCurveScene` and runs the summary reel.

**How INTERACTIVE state is driven:** each scene exposes a small typed param object (e.g. `PayoffParams = { type:'call'|'put'; side:'long'|'short'; K:number; premium:number }`). React owns the controls (sliders/toggles); on change it calls `scene.setParams(next)`, and the scene re-tweens deterministically. All option math lives in one pure module `optionMath.ts` — `intrinsic(type,S,K)`, `breakeven(type,side,K,prem)`, `payoffAtExpiry(params,S)`, `pnlPerContract(...)`, `leverageReturn(...)` — and is **unit-tested** so the readouts and quiz grading share one source of truth. Illustrative premium/IV/theta/delta values come from a static `illustrative.ts` table, never random, so a module renders identically every time.

**Progress bar:** a segmented React bar with **15 ticks** bound to `completedModules`; fills tick N when module N is completed (TEACH/INTRO "Got it", INTERACTIVE "Done exploring", QUIZ submit). Filling tick 15 triggers the Congratulations screen (16, uncounted).

**Streak:** track `currentSittingCount` in memory, incrementing per completed module; reset on a session gap; persist `bestStreak = max(bestStreak, currentSittingCount)`. Displayed as a streak pill in the header ("most modules in one sitting").

**Dashboard resume:** Firestore `users/{uid}` → `{ progress: { lastCompletedModule, completedModules[] }, bestStreak, updatedAt }`. The dashboard "Resume" jumps to `lastCompletedModule + 1` (within this lesson's module set). Auth: Firebase Google sign-in; create the user doc on first login.

**Firestore shape (this lesson's writes):**
```
users/{uid} → {
  progress: { lastCompletedModule: number, completedModules: number[] },
  bestStreak: number,
  updatedAt: serverTimestamp()
}
```

**Responsive / relative coords:** all scenes lay out in **relative coordinates** (fractions of the canvas) so the same diagram reads on phone and desktop; the canvas scales to its container. Controls are large-hit-area, touch-friendly sliders and toggles; payoff/premium labels reflow above/below on narrow screens.

**Palette:** minimalist **white** background; **blue** for annotations, axes, strike/breakeven markers and formulas; **green = up / profit / long / buy**; **red = down / loss / short / sell**; lighter-blue translucency for the time-value segment and the pre-expiry curve. Matches Lessons 1–3 for a consistent learner experience.

---

## 9. Congratulations screen (screen 16 — platform-handled, not counted)

After module 15 fills the bar to **15/15**, the platform shows the standard **Congratulations** screen (same component as Lessons 1–3):

- A celebratory **white** card with a green check, headline *"Lesson 4 complete — you can read an option contract."*
- A one-line recap of the through-line: *"Right (not obligation) on 100 shares · premium = intrinsic + time · hockey-stick payoffs & breakevens (K ± premium) · delta & leverage vs the underlying · exercise / sell-to-close / assignment."*
- The session's **streak** ("most modules in one sitting") and the updated progress.
- Buttons: **Back to Dashboard** (writes final `progress`/`bestStreak` to Firestore) and, if present in the shell, **Next Lesson**.
- A brief green confetti burst (Phaser or CSS), consistent with the other lessons' end screens.
