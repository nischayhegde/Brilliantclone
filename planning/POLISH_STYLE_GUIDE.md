# Comprehension Polish — Shared Style Guide (all lessons)

This is the **single source of truth** for the "make modules easier for newer/younger
traders" pass. Every agent working a lesson MUST follow it so the five lessons stay one
consistent voice and never lose accuracy.

Goal: a curious 16-year-old with zero finance background reads a module and *gets it* the
first time — through plainer language and one vivid real-world analogy per idea — **without
dumbing down the actual mechanics or breaking any math.**

---

## 1. Voice & reading level

- **Plain, warm, confident** — the PRODUCT.md voice: "lucid, trustworthy, warm." A great
  teacher, not a textbook and not a hype-bro.
- **Short sentences.** Aim ~12–18 words. Break a 2-line sentence into two.
- **Lead with the idea, then the mechanics.** First a human sentence; then the precise term.
- **Define jargon on first use, in-line, casually.** "the spread (the gap between the two
  prices)" — never assume they know `bid`, `ask`, `theta`, `IV`, `float`, `intrinsic`, etc.
- **Second person, active voice.** "You pay the spread twice" > "The spread is paid twice."
- **Keep the real terms.** They're learning the vocabulary — simplify the *explanation*, not
  the terminology. Always teach the correct word; just make it land.
- **No emoji. No exclamation spam. No "get rich" energy.** Encouraging, never salesy.

### Reading-level checklist (apply to every string you touch)
- Could a smart beginner who's never traded follow this sentence? If not, rewrite.
- Is there a number or term that arrives without a plain-English hook? Add the hook.
- Can I cut a word without losing meaning? Cut it (then check again).

---

## 2. Analogies — inline, one per concept

Weave **one** strong analogy into the existing `intro` or `caption` prose (no new UI slot).
Concrete, everyday, instantly visual. Introduce with a light touch ("Think of it like…",
"It's the same as…", "Picture…"). One per module — don't stack metaphors; don't repeat the
same analogy two modules in a row.

**Use this shared analogy vocabulary** (so the course is consistent — pick the matching one,
adapt the wording):

| Concept | Analogy |
|---|---|
| Bid / ask / spread | A currency-exchange or ticket booth: it *buys* from you cheap and *sells* to you dear. That gap is its cut — the spread. |
| Mid price | The fair midpoint between the booth's buy and sell price. |
| Limit order | Leaving a note: "I'll pay exactly $X" — then waiting your turn in line. |
| Market order | Walking up and grabbing whatever's on the shelf right now, at today's price. |
| Matching engine / FIFO | A deli counter with take-a-number tickets: best price served first, ties go to whoever lined up earliest. |
| Walking the book / slippage | Buying every seat to a show: the cheap seats sell out, so you climb to pricier rows. Your *average* seat costs more than the cheapest one. |
| Depth: deep vs thin book | A lake vs a puddle. Drop the same rock (a big order): the lake barely ripples; the puddle splashes everywhere. |
| Bid-ask bounce | A price "flickering" between two shelf-tags even though nothing really changed. |
| Short selling | Borrowing a friend's bike to sell today, planning to buy an identical one back cheaper later and return it. You keep the difference. |
| Borrow fee / carry | A daily rental fee on the shares you borrowed (like renting a tool) — plus you cover any dividends the lender misses. |
| Capped gain / unlimited loss | Betting against a balloon: it can only deflate to empty (your win is capped), but it can inflate forever (your loss isn't). |
| Margin call / forced buy-in | The lender taps you on the shoulder: "post more cash or I close this for you" — usually at the worst moment. |
| Short squeeze | Everyone who borrowed-and-sold rushing for the same tiny exit at once — their scramble to buy *is* what shoves the price up. |
| Option = the contract | A coupon (or a refundable deposit): the *right*, never the obligation, to buy/sell at a set price by a deadline. |
| Call vs put | Call = a coupon to **buy** cheap. Put = a coupon to **sell** at a locked-in high price. |
| Premium = intrinsic + time | A concert ticket's price = face value (real, "intrinsic") + a scalper's hype markup ("time value") that fades as showtime nears. |
| Theta / time decay | An ice cube melting — the "time value" puddle shrinks, and faster the closer you get to the deadline. |
| Delta | A gas pedal's sensitivity: deep-in-the-money ≈ pedal floored (moves 1:1 with the stock); far-out ≈ barely pressed. |
| Leverage | A magnifying glass on both your gains *and* your losses. |
| Straddle / strangle | Insurance that pays whether the storm hits from the north or the south — you just need a *storm* (a big move, either direction). |
| IV crush | Surge-pricing an umbrella right before the forecast, then the storm fizzles: you can be "right it rained a little" and still lose. |

If a concept here isn't listed, invent an analogy in the *same spirit* (concrete, everyday,
honest). Never use an analogy that misrepresents the mechanics.

---

## 3. Accuracy contract — DO NOT BREAK (this is non-negotiable)

The product's entire trust premise is "real data + exactly-correct math." Simplifying copy
must never make it wrong.

- **Never change any number, price, date, ticker, or formula** in the copy or in
  `scene.params`. Every figure (premium, breakeven, slippage, P&L, %, strike, days) must stay
  identical. If you restate math in plainer words, the result must be arithmetically the same.
- **Keep every integrity disclaimer.** Phrases like "Simulated depth — math exact",
  "illustrative", "(Premium illustrative; math exact)", "real, unedited price history" MUST
  remain (reword lightly if you like, but keep the meaning). Never imply precision the data
  doesn't have.
- **Keep the semantic color language**: green = up/buy/long/bid/profit, red =
  down/sell/short/ask/loss, blue = annotations/limit/mid, amber = the active/interactive path.
  Don't describe colors in a way that contradicts the scene.
- **Don't weaken risk warnings.** "Unlimited loss," "no floor," "demands a stop" must stay as
  serious as they are — just say them more plainly.
- The math source files (`book.ts`, `optionMath.ts`, `payoffMath.ts`, `candles.ts`) are
  **read-only**. Do not edit them.

---

## 4. Structural invariants — keep wiring & tests green

`src/lessons/registry.test.ts` will fail the build if structure breaks. So:

- **Do not change**: a module's `id`, `type`, `scene.kind`, the per-lesson module **count**,
  contiguous ids `1..N`, quiz `options[].id` values, or `quiz.correctId`.
- **Safe to rewrite (this is your job)**: `kicker`, `title` (keep the concept recognizable —
  you may make titles friendlier), `intro`, `caption`, `quiz.prompt`, `quiz.options[].label`,
  `quiz.explainRight`, `quiz.explainWrong`, `challenge.prompt`, `challenge.instructions`,
  `challenge.submitLabel`, `cta`.
- A `quiz`'s `correctId` must still point at an existing option id; explanations must stay
  non-empty and must still match which option is right/wrong.
- Keep `intro`/`caption` roughly within their current length (they render in a
  `max-w-xl`, ~`text-sm` block above/below the canvas). Shorter is better. Don't balloon them.

---

## 5. Scene / animation work (the "better animations" half)

Only the lessons listed in §7 do scene rewrites, and only for the named modules. For those:

- Scenes extend `ModuleScene` (`src/engine/ModuleScene.ts`). Reuse its helpers:
  `label`, `panel`, `button`, `slider`, `dashedLine`, `fadeIn`, `loop`, `dur`, `chipBehind`,
  and the `fs()` font-scaler. **Read that file before editing any scene.**
- **Author in DESIGN space 760×460.** Never do resize math; the canvas is FIT-scaled.
- **Reduced motion is mandatory.** Use `this.dur(ms)` for tween durations and `this.loop(...)`
  for ambient/looping motion (both collapse to instant/none under
  `prefers-reduced-motion`). Use `this.fadeIn(...)` for entrances. Never ship motion that has
  no reduced-motion fallback.
- **Motion is intentional, calm, and teaches.** Ease-out (e.g. `Cubic.out`, `Quad.out`,
  `Sine.easeInOut` for breathing). No bounce, no elastic, no spin-for-fun. Restraint — the
  content is the spectacle (PRODUCT.md). A good entrance: stagger elements in, draw a line
  progressively, pulse the one thing the learner should look at.
- **Preserve the scene contract exactly** so wiring/tests/footers keep working:
  - Keep the **class name + `export default`** and the constructor signature.
  - Read the **same `params`** keys (don't rename/remove params the `index.ts` passes).
  - Keep all **bus** interactions intact for that module type: challenges must still call
    `this.report(correct, title, detail)` on `onSubmit()`; quizzes still react to `onReveal()`;
    interactives still drive their readouts. Call `this.emitReady()` where the old scene did.
  - Keep the **exact math** (same helper calls, same results). The visual can change; the
    numbers cannot.
- A scene rewrite should make the concept *more* legible: add a real-world visual metaphor or
  a clearer animated cause→effect, not just eye-candy. If you can't make it clearly better,
  improve copy + light entrance motion instead and leave the mechanic alone.
- Keep text legible: route font sizes through `fs()` / keep ≥13px design size; use `bg: true`
  labels over busy graphics; verify contrast (body ≥ 4.5:1).

---

## 6. Worked examples (anchor your voice to these)

**Order Book M11 caption — "The Spread Is a Cost"**

- BEFORE: "Cross to buy: pay ½ spread vs mid. Cross to sell: pay it again. Round-trip = the
  full spread. On a $400 stock a penny spread (400.00 / 400.01) is ≈0.0025% — noise. On a $5
  stock a dime spread is ≈2% — you start 2% in the hole."
- AFTER: "Think of the booth's cut: buying, you pay a little over the fair mid; selling, you
  give a little back. Do both (a round-trip) and you've paid the whole spread. On a $400 stock
  a 1¢ spread is ≈0.0025% — basically free. On a $5 stock a 10¢ spread is ≈2% — you start the
  trade already 2% behind." *(numbers unchanged, jargon unpacked, analogy inline)*

**Options M6 caption — "Theta"**

- BEFORE: "Time value bleeds to zero by expiry — that's theta, and it speeds up near the end.
  At expiry the option is worth exactly its intrinsic value…"
- AFTER: "An option's 'time value' melts like an ice cube — slowly at first, then faster as
  the deadline nears. That melt is called theta. At expiry the cube is gone: the option is
  worth only its intrinsic value (the real, in-the-money part)…" *(keeps theta + intrinsic,
  adds the melt analogy)*

**Short Selling M5 caption — "Asymmetry"**

- BEFORE: "This is THE reason shorting is dangerous: the best case is the stock going to zero
  (+100%, and that's all), but the worst case has no limit…"
- AFTER: "Picture betting against a balloon. It can only deflate to empty — that's your best
  case, a capped +100%. But it can inflate forever, and your loss inflates right along with it.
  That one-sided risk is what makes shorting dangerous." *(same facts, vivid + plain)*

Match this register everywhere: plain hook → correct term → exact numbers preserved.

---

## 7. Per-lesson assignments

Each agent owns ONE lesson folder. **Do not edit files outside your lesson folder**, and in
particular **never touch `src/engine/**` (shared)** — `CandleChartScene` is shared by two
lessons and must not change.

- **reading-charts** (`src/lessons/reading-charts/index.ts`): COPY ONLY — all 24 modules.
  (Its only scene is the shared, frozen `CandleChartScene`; do not modify it.) The patterns
  repeat in pairs (teach → trade-it challenge); vary the wording so it doesn't feel templated,
  and on the first of each pattern give the one-line "what it looks like / why it happens"
  analogy. Keep all prices/dates/targets exact.

- **order-book** (`src/lessons/order-book/**`): copy for all 15 + scene rewrites for
  **M9 WalkBookScene** (slippage = climbing to pricier rows of seats), **M11 SpreadCostScene**
  (the booth's cut). Optional 3rd: **M7 MatchingEngineScene** (deli take-a-number queue).

- **short-selling** (`src/lessons/short-selling/**`, but NOT the shared `CandleChartScene`):
  copy for all 15 + scene rewrites for **M5 PayoffScene** (balloon asymmetry),
  **M8 SqueezeLoopScene** (the crowd at one tiny exit). Optional 3rd: **M3 BorrowFeeScene**
  (daily rental meter) or **M1 IntroFlipScene**.

- **options** (`src/lessons/options/**`): copy for all 15 + scene rewrites for
  **M6 ThetaDecayScene** (melting ice cube), **M4 PremiumBarScene** (face value + hype markup).
  Optional 3rd: **M14 LeverageScene** (magnifying glass). NOTE: `PayoffScene` is shared by
  M3/M9/M10/M11 and `DeltaCurveScene` by M13 — only do additive entrance-motion polish there,
  don't restructure them (high blast radius).

- **volatility** (`src/lessons/volatility/**`): copy for all 15 + scene rewrites for
  **M10 IVCrushScene** (umbrella surge-pricing then the storm fizzles) and **M1 IntroVibeScene**
  (a stronger "bet on motion, not direction" hook). NOTE: `PayoffScene` is shared by
  M2–M8/M12/M13 — only additive entrance-motion polish there; do not restructure it.

Keep scene rewrites to the named modules (≈2–3 per lesson) and make those genuinely better.

---

## 8. Before you finish (every agent)

1. Re-read each string you changed against the §1 checklist and the §3 accuracy contract.
2. Run `npm run typecheck` — must be clean.
3. Run `npm test` — all tests must pass (proves wiring/structure intact).
4. Report: modules whose copy you simplified, scenes you rewrote (with the analogy used), and
   confirm typecheck + tests are green.
