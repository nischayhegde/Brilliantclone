# Lesson 5 — "Straddles & Strangles: Trading Volatility"

> Combine two single-leg options from Lesson 4 into a **non-directional volatility bet**. The learner builds **long straddles** (long call + long put, same strike) and **long strangles** (long OTM call + long OTM put), nails the **V** and **flat-bottomed** payoff shapes and their **breakevens** (`K ± totalPremium` / `Kc + prem`, `Kp − prem`), learns **when** these trades are used (earnings / binary events), and internalizes the lesson's hard truth — the **IV-crush trap**, where the stock moves and you *still lose* because you must clear a breakeven, not merely "move." It closes with the **short** straddle/strangle mirror and a capstone earnings trade.
>
> **INTEGRITY NOTE.** Lesson 5 is a **simulation-driven** lesson (like Lessons 2 and 4). There is **no fetched candle chart** that is load-bearing for the math. Every payoff diagram, premium, implied-volatility (IV) number, breakeven, and P&L figure in this spec is an **ILLUSTRATIVE SIMULATION** — a deterministic, arithmetically exact rendering of correct option mechanics. These numbers are *examples chosen to read clearly*, and the app must label them as illustrative; none is presented as a "verified" market snapshot. The **real anchors** are *qualitative*: (a) the math itself (breakevens, payoff summation, max-loss) is exactly correct and would hold for any real option chain; (b) named earnings events used for color (e.g., a real ticker's known quarterly earnings date) are genuinely true at the qualitative level — that the company reports on that date and that single-name implied volatility is empirically elevated into earnings and collapses (IV crush) right after. We never fabricate a precise option-chain snapshot ("AAPL Jan-100 call traded at exactly $4.12") and call it verified. Where a real underlying *price* is used as an anchor (e.g., "a $100 stock"), it is a round illustrative anchor, not a claim about a specific historical close.

---

## 1. How this document is organized

- **§2 Lesson structure** — the 15-module spine (one row per module: #, type, title, the one idea it lands), how the lesson paces easiest → hardest, and how the segmented progress bar advances `completedModules / 15` (one tick per module). The final module (15) is a capstone/recap, followed by the platform-handled **Congratulations screen** (screen 16, *not* counted as a module).
- **§3 Module mechanics (mapped to PRD + platform)** — what each module **TYPE** does: **INTRO**, **TEACH**, **INTERACTIVE**, **QUIZ** (reusing Lesson 1's masked → answer → reveal → grade → explain mechanic exactly), and **CAPSTONE/RECAP**.
- **§4 Data sourcing & integrity method** — why this lesson is simulation-driven, what is illustrative vs. a real qualitative anchor, and the deterministic-simulation rules (exact math, labeled examples).
- **§5 Pacing / parameter philosophy** — how the strike/premium/IV/move choices were picked so the V, the flat-bottomed valley, the breakevens, and the IV-crush trap all read clearly and build on Lesson 4.
- **§6 The modules (THE CORE)** — one subsection per module: type & title; the instrument/strike/premium context (always labeled *illustrative simulation* with the exact parameter set); a "What the learner sees" narrative; the **animation** (Phaser draw sequence, timing/easing, palette); the **interactive element** (exactly what is manipulated and how the scene responds, with live readouts and edge cases); a **markdown table** of the exact levels/payoff anchors/ladders to draw; a caption tying numbers to the lesson; and for **QUIZ** modules the masked setup, question text, options, correct answer, reveal animation, and "why right / why wrong."
- **§7 PRD / platform traceability** — every PRD & platform requirement → where it is satisfied.
- **§8 Implementation notes (concise)** — the reusable Phaser scenes (`PayoffScene`, `LegStackScene`, `IVCrushScene`, `EventCandleScene`), how INTERACTIVE state is driven, the segmented progress bar, the streak counter, dashboard resume, the Firestore progress shape, responsive/relative-coords, and the palette.

---

## 2. Lesson structure

Lesson 5 is **15 modules**, paced strictly easiest → hardest. It does **not** use the Lesson-1 "12 pattern pairs" structure; instead it is a single arc that (1) motivates the non-directional idea, (2) constructs the long straddle and its breakevens, (3) constructs the long strangle and its breakevens, (4) contrasts the two on cost-vs-move, (5) grounds them in earnings/binary events, (6) delivers the IV-crush trap, (7) introduces the short mirror, and (8) ties it all together in a free Volatility Lab and an earnings-trade capstone.

### Module spine

| # | Type | Title | The one idea it lands |
|---|---|---|---|
| 1 | INTRO | Betting on Motion, Not Direction | You can bet on **volatility itself** — profit from a big move *either* way, lose if it sits still. |
| 2 | TEACH | Recap: Stacking Two Lesson-4 Payoffs | A straddle is **long call + long put** (Lesson 4 hockey sticks) summed vertically into a new shape. |
| 3 | TEACH | The Long Straddle | Long call + long put at the **same strike** (ATM); cost = sum of premiums; **V-shaped**, max loss = total premium at `K`. |
| 4 | TEACH | Straddle Breakevens | Breakevens are `K + totalPremium` and `K − totalPremium`; you must move *more* than the premium. |
| 5 | QUIZ | Find the Straddle Breakevens | Compute `K ± totalPremium`; pinning at `K` is the **worst** case (full premium loss). |
| 6 | TEACH | The Long Strangle | Long OTM call `Kc` + long OTM put `Kp`; **cheaper** but needs a **bigger** move; **flat-bottomed** valley. |
| 7 | TEACH | Strangle Breakevens | Breakevens are `Kc + totalPremium` and `Kp − totalPremium`; max loss is the flat band between strikes. |
| 8 | QUIZ | Straddle vs Strangle: Cost vs Move | Cheaper strangle ⇒ **farther** breakevens ⇒ needs a **bigger** move than the pricier straddle. |
| 9 | TEACH | When You'd Use Them: Earnings & Binary Events | Long vol is placed ahead of **earnings / binary events** — big move expected, direction unknown. |
| 10 | TEACH | The IV-Crush Trap | IV is **fat before**, **collapses after**; you can lose **even when the stock moves** if the move is smaller than priced in. |
| 11 | QUIZ | The Stock Moved — Did You Win? | Profit requires **clearing a breakeven**, not just "moving"; small move + IV crush = loss. |
| 12 | TEACH | The Other Side: Short Straddle & Short Strangle | Sell both legs, collect premium, profit if the stock stays **quiet inside the breakevens**; large/undefined risk. |
| 13 | QUIZ | Quiet or Wild? Pick the Right Trade | Long vol for an expected **big move**; short vol for an expected **pin** (respect the short's large risk). |
| 14 | INTERACTIVE | Volatility Lab: Tune the Whole Trade | Strikes, premiums, IV, and realized move **jointly** decide P&L; breakevens are the win/lose line. |
| 15 | CAPSTONE | Capstone & Recap: Trade an Earnings Event | Build a full pre-earnings vol trade, run the event, and grade the outcome against the breakevens & IV crush. |

→ then **Congratulations screen** (screen 16, platform-handled, **not** a module).

### Pacing: easiest → hardest

The arc deliberately introduces only one new idea per step and reuses the prior step's artifact:

1. **Modules 1–2 (idea + bridge).** First the *concept* (motion not direction) with a single profit meter; then the explicit *bridge to Lesson 4* (a straddle is literally two single-leg payoffs summed). No breakeven math yet.
2. **Modules 3–5 (the long straddle, fully).** Build the V → place its breakevens → *quiz* the breakevens. The simplest structure (one strike) is mastered before any second strike appears.
3. **Modules 6–8 (the long strangle, fully, then compare).** Re-use the just-learned breakeven rule on a *two-strike* structure → place its breakevens → *quiz* the cost-vs-move tradeoff that distinguishes the two. The comparison quiz is harder because it requires reasoning about *both* structures at once.
4. **Modules 9–11 (why, and the trap).** Ground the trades in earnings, then introduce the conceptually hardest real-world idea — **IV crush** — and immediately *quiz* the counterintuitive "moved but lost" case.
5. **Modules 12–13 (the mirror).** Flip to the short side (sell both legs) and *quiz* the higher-order judgment call: long vol vs short vol vs flat.
6. **Modules 14–15 (synthesis).** A free **Volatility Lab** where the learner can engineer both winners and "moved-but-lost" losers, then a graded **capstone** earnings trade that touches every idea.

### Progress bar

A segmented bar at the top has **15 ticks**, bound to `completedModules / 15`. It advances exactly **one tick when a module is completed** (INTRO/TEACH on "Got it"; INTERACTIVE on "Done exploring"; QUIZ after the reveal+explanation is dismissed; CAPSTONE after the scorecard). The capstone (module 15) fills the final tick; the **Congratulations screen** then appears as screen 16 and is **not** counted in the `/15` denominator.

---

## 3. Module mechanics (mapped to PRD + platform)

Lesson 5 uses five module types. All animation is **Phaser**; all surrounding chrome (header, progress bar, streak, buttons, captions, scorecards) is **React**; palette is minimalist **white / blue / green** with **green = up / buy / long / profit**, **red = down / sell / short / loss**, **blue = annotations, breakevens, labels, axes**.

### INTRO (module 1)
A motivational micro-lesson. Animated concept draw-in plus one light interactive (a slider) that lets the learner *feel* the idea before any formal definition. No pass/fail. "Got it" advances. Maps to the PRD's "animated, interesting modules" and sets the mental model for the rest of the lesson.

### TEACH (modules 2, 3, 4, 6, 7, 9, 10, 12)
> PRD analog of Lesson 1's *Teach*: "show the user the concept with an overlay explaining it."

1. **Animated concept draw-in** (Phaser): the payoff curve / leg stack / IV balloon draws in.
2. **Sequenced overlay annotations** appear in order (blue): strikes, breakevens, max-loss band, captions — each timed so the learner reads one fact at a time.
3. A small **embedded interactive** (slider/toggle) lets the learner perturb the just-taught object and watch live readouts (cost, breakevens, required move). This is exploration, **not** graded.
4. **"Got it"** advances and ticks the progress bar.

### INTERACTIVE (module 14)
A free sandbox with **no pass/fail**. The learner manipulates many inputs at once (structure, strikes, premiums, IV, realized move/direction) and the scene live-updates every readout (cost, both breakevens, P&L, "cleared a breakeven?" flag). Designed so the learner can intentionally build both a winning trade and a "moved-but-lost" trade. "Done exploring" advances.

### QUIZ (modules 5, 8, 11, 13) — **reuses Lesson 1's mechanic exactly**
> PRD: "ask the user if the condition is fulfilled, then reveal … show if they were right or wrong, with an explanation telling them why they were wrong."

1. **Masked / partial state.** Show the setup with the *outcome hidden*: a payoff diagram with breakevens not yet placed, or a pre-event chart with the post-event candle + P&L masked behind a blue panel.
2. **Question** with discrete options (**A/B/C** or **Yes/No**).
3. On submit, **animate the reveal** (snap breakevens into place / drop the mask to expose the post-event candle and deflated premiums).
4. **Grade Right / Wrong** against the exact, arithmetically-correct ground truth.
5. **Teaching explanation** — *why the right answer is right*, and crucially *why the tempting wrong answer is wrong* (e.g., "you assumed any move wins; it doesn't — 104 is inside 93–107"). The wrong-but-tempting option is always made instructive.

### CAPSTONE / RECAP (module 15)
A multi-step scored scenario that ties the lesson together: the learner *builds* a full pre-earnings volatility trade (structure, strikes, premiums, long/short), commits, runs the event, and receives a **scorecard** that grades the P&L and explains it via the breakevens and IV crush. Contains an **embedded check** ("did your trade win, and why?"). On completion it ticks the final segment and hands off to the Congratulations screen.

---

## 4. Data sourcing & integrity method

**This lesson is simulation-driven; there is no load-bearing fetched chart.** Unlike Lessons 1 and 3 (real Yahoo OHLC windows), Lesson 5 teaches *option mathematics and trade structures*, which do not require real candles to be correct. Accordingly:

- **All premiums, IV levels, strikes, breakevens, and P&L are illustrative, deterministic simulations.** They are computed by exact formulas (below) and chosen as clean round numbers so the shapes and arithmetic read clearly. The app must visibly **label these "illustrative example"** wherever a specific number appears. No fabricated option-chain snapshot is ever presented as "verified."
- **The math is the real anchor and is exactly correct.** Every payoff, breakeven, and max-loss in §6 satisfies:
  - **Long call payoff at expiry:** `max(S − K, 0) − callPremium`.
  - **Long put payoff at expiry:** `max(K − S, 0) − putPremium`.
  - **Long straddle payoff (single strike K):** `max(S − K, 0) + max(K − S, 0) − totalPremium` = `|S − K| − totalPremium`. Vertex (max loss) at `S = K`, depth `−totalPremium`. Breakevens `K ± totalPremium`.
  - **Long strangle payoff (`Kp < Kc`):** `max(S − Kc, 0) + max(Kp − S, 0) − totalPremium`. Flat bottom = `−totalPremium` for all `Kp ≤ S ≤ Kc`. Breakevens `Kc + totalPremium` (up) and `Kp − totalPremium` (down).
  - **Short = mirror:** negate the long payoff. Short straddle: profit peak `+totalPremium` exactly at `S = K`, sloping away linearly; same breakevens; **unbounded** loss above, large (bounded at S→0) loss below. Short strangle: profit plateau `+totalPremium` flat across `Kp..Kc`; same breakevens; unbounded loss above, large loss below.
  - **Contract multiplier:** US equity options are ×100, so a premium of `7` = `$700` per contract. The spec states per-share math first and notes the ×100 dollar figure where useful.
- **Qualitative real anchors (true, not fabricated-precise):**
  - **Earnings IV behavior.** It is genuinely, empirically true that single-name implied volatility is elevated heading into a scheduled earnings report and that it **collapses (IV crush)** in the session immediately after the report. This qualitative fact is real; the specific IV percentages used are illustrative.
  - **Named events.** Where a ticker's earnings date is mentioned for color (e.g., "into a mega-cap's quarterly print"), it refers to a real company that genuinely reports quarterly. We use it qualitatively (the event exists and moves the stock); we do **not** attach a fabricated precise option chain to it.
  - **Liquidity color.** Statements like "a mega-cap's options are penny-wide while an illiquid small-cap's are wide" are true qualitative anchors carried over from Lesson 4's order-book context; no precise quote is invented.
- **Two-pass check (adapted).** Pass 1: author computes every breakeven/max-loss/P&L from the formulas above. Pass 2: an independent re-derivation re-computes each module's numbers from `K`, premiums, and the stated move, confirming the breakevens, the inside/outside classification, and every quiz answer are arithmetically exact. (Verification notes appear under each quiz, mirroring Lesson 1's blockquotes.)

---

## 5. Pacing / parameter philosophy

The parameters are chosen as a single consistent **`$100` underlying** with clean integer premiums so the whole lesson is mentally checkable and the shapes are symmetric and legible:

- **One underlying anchor: `S₀ = 100`.** Using a round $100 stock throughout means breakevens land on memorable numbers (93, 107, 92, 108) and the V/valley are symmetric on screen. (Labeled an illustrative anchor, not a specific historical close.)
- **Straddle premiums: call = 4, put = 3, total = 7.** Asymmetric leg premiums (4 vs 3) are deliberate so the learner sees the **total** premium drives the breakevens, not either leg alone, while the sum (7) stays a clean number. Breakevens 93 / 107 are symmetric about 100.
- **Strangle strikes: `Kp = 95`, `Kc = 105`; total premium = 3.** OTM strikes ±5 from spot give an obvious flat bottom spanning 95–105, and a lower cost (3 vs 7) makes the **cheaper-but-needs-a-bigger-move** tradeoff vivid: strangle nearest breakeven is `108`/`92` (8 from spot) vs the straddle's `107`/`93` (7 from spot).
- **Move sizes chosen to teach the trap.** The IV-crush quiz uses a **+4% move to 104**, deliberately *inside* the straddle's 93–107 band, so the learner confronts "the stock moved and I still lost." The capstone lets the learner dial moves on both sides of the breakevens.
- **IV expressed via premium fatness.** Rather than a Black-Scholes engine, IV is modeled as a **premium-inflation multiplier**: high pre-event IV puffs the total premium tall; IV crush deflates the *extrinsic* portion to near zero, leaving only intrinsic value. This keeps the math transparent (`P&L = intrinsic_after − premium_paid`) while faithfully reproducing the real "moved but lost" outcome.
- **Concept order mirrors construction complexity.** One strike (straddle) before two strikes (strangle); long before short; static payoff before dynamic IV; single-input sliders before the multi-input lab. Every breakeven formula is explicitly tied back to Lesson 4's single-leg breakevens so the learner sees the new shapes as *sums* of familiar ones.

---

## 6. The modules (THE CORE)

> Palette key for every module: **green** = up move / buy / long / profit zone; **red** = down move / sell / short / loss zone; **blue** = annotations, axes, strike & breakeven markers, captions. Background white. All numbers are **illustrative simulations** with the exact math shown.

---

### Module 1 — INTRO · "Betting on Motion, Not Direction"

- **Type / title:** INTRO · *Betting on Motion, Not Direction*.
- **Learning goal:** Establish the core mental model — you can bet on **volatility itself**. You profit from a big move in *either* direction and lose if the stock sits still. This is the opposite of the directional single-leg trades from Lesson 4.
- **Instrument context (illustrative simulation):** Generic underlying anchored at `S₀ = 100`. No real chart. A single abstract "profit meter" — no strikes or premiums shown yet (those arrive in module 3).
- **What the learner sees:** A coiled, vibrating stock line at the center of a white panel. Two ghosted outcome arrows fan out — a **green up arrow** and a **red down arrow** — and a "no-move" outcome sits dead center. A single **profit meter** (a vertical gauge on the right) lights up brightly when either arrow is followed far, and dims toward empty when the stock stays put. A one-line caption: *"Some trades win when the stock moves — up OR down. They lose only if it stays still."*
- **Animation (Phaser, `IntroVibeScene`):**
  1. **0.0–0.8s:** the price line draws in left-to-right (blue), then begins a small-amplitude vibration (sine jitter, ~3px) — "coiled."
  2. **0.8–1.6s:** a green up-arrow grows upward and a red down-arrow grows downward simultaneously (ease-out); as each extends, the profit meter (right) fills **green** in lockstep — *both* directions light it.
  3. **1.6–2.2s:** the arrows retract; the line settles flat at 100; the meter **drains to near-empty** with a soft red flash at the bottom — "no move = you lose."
  4. Loops once, then yields control to the interactive.
- **Interactive element:** A single horizontal **future-price slider** (range 70 → 130, default 100). As the learner drags it **far up** *or* **far down**, the profit meter rises in *both* directions; dragging it back toward 100 sags the meter into a red "loss" zone near the center. Live readout under the meter: a qualitative badge — **"BIG MOVE → profit"** (green) when |S − 100| is large, **"too quiet → loss"** (red) when |S − 100| is small. Edge case: exactly at 100 shows the deepest red "worst case — no move." This is a *preview* of the V; no numbers/breakevens yet.
- **Levels / markers table:**

  | Marker | Value | Color | Note |
  |---|---|---|---|
  | Anchor price `S₀` | 100 | blue | center of the meter's sag |
  | Up outcome | S far above 100 | green | meter rises |
  | Down outcome | S far below 100 | red→green | down move still *profits* the bet |
  | No-move outcome | S ≈ 100 | red | meter empty (worst case) |

- **Caption (ties numbers to lesson):** *"This is a volatility bet: it doesn't care which way — it cares how far. The next modules build the exact trade that pays off like this meter."*

---

### Module 2 — TEACH · "Recap: Stacking Two Lesson-4 Payoffs"

- **Type / title:** TEACH · *Recap: Stacking Two Lesson-4 Payoffs*.
- **Learning goal:** Make the bridge explicit — a straddle is **literally a long call + a long put** from Lesson 4, summed. Two hockey-stick payoffs added vertically produce a new combined shape (the V), and the combined **cost = call premium + put premium**.
- **Instrument context (illustrative simulation):** `K = 100`; long call premium `= 4`; long put premium `= 3`. Payoff axis: x = stock price at expiry `S` (range ~80–120), y = profit/loss per share.
- **What the learner sees:** Two faint Lesson-4 payoff lines fade in separately: the **long-call** hockey stick (flat at `−4` for `S < 100`, then sloping up 1-for-1 above 100, crossing zero at 104) and the **long-put** hockey stick (flat at `−3` for `S > 100`, sloping up 1-for-1 below 100, crossing zero at 97). Then they **sum vertically** into a single **V** whose vertex sits at `S = 100, y = −7`. A side ledger shows `cost = 4 + 3 = 7`.
- **Animation (Phaser, `LegStackScene`):**
  1. **0.0–1.0s:** long-call line draws in (green tint, semi-transparent), labeled "long call (−4)."
  2. **1.0–2.0s:** long-put line draws in (green tint, semi-transparent), labeled "long put (−3)."
  3. **2.0–3.2s:** for a sweep of x-values, a vertical "+" connector animates adding the two y-values; the resulting **combined V** is traced in solid green, vertex landing at (100, −7) with a small bounce ease.
  4. **3.2–3.8s:** the two leg lines dim to ghosts; the V stays solid; the ledger animates `4 + 3 = 7`.
- **Interactive element:** Two **toggle switches** — **[Call on/off]** and **[Put on/off]**. With only the call on, the screen shows a single up-sloping hockey stick; only the put on shows the down-sloping one; **both on** rebuilds the V live, redrawing the combined curve and updating the cost ledger (`0`, `4`, `3`, or `7`). Edge case: both off shows a flat zero line with cost 0 and a hint "turn on both legs to build a straddle."
- **Levels / markers table:**

  | Object | Formula | Value(s) to draw |
  |---|---|---|
  | Long call payoff | `max(S−100,0) − 4` | flat −4 below 100; +1 slope above; zero-cross at 104 |
  | Long put payoff | `max(100−S,0) − 3` | flat −3 above 100; +1 slope below; zero-cross at 97 |
  | Combined (sum) | `|S−100| − 7` | V with vertex (100, −7) |
  | Combined cost | `4 + 3` | 7 (= $700 ×100) |

- **Caption:** *"A straddle is nothing new — it's two Lesson-4 legs stacked. Add the hockey sticks and you get a V that's down 7 at the strike and climbs in both directions."*

---

### Module 3 — TEACH · "The Long Straddle"

- **Type / title:** TEACH · *The Long Straddle*.
- **Learning goal:** Define the **long straddle** precisely: long 1 call + long 1 put at the **same strike** (usually **ATM**), same expiry. **Cost = call + put premium.** It is **non-directional / long-volatility**: it profits from a big move either way. **Max loss = total premium**, occurring if the stock **pins at `K`** at expiry. Payoff is a **V**.
- **Instrument context (illustrative simulation):** ATM strike `K = 100` (anchored to a $100 underlying), call premium 4, put premium 3, total premium 7. Same x/y payoff axes as module 2.
- **What the learner sees:** At the ATM strike, both legs draw and **merge into one clean V**. The bottom of the V sits at `K = 100` at depth `−7` (the total premium). Two upward ramps extend symmetrically in both directions (slope +1 per $1 of stock move). A definition card reads: *"Long straddle = long call + long put, same strike, same expiry. Cost 7. Max loss 7 at $100."*
- **Animation (Phaser, `PayoffScene`):**
  1. **0.0–0.6s:** blue axes draw; the ATM strike line at `S = 100` drops in (dashed blue) labeled "K = 100 (ATM)."
  2. **0.6–1.6s:** call and put legs draw and visibly **merge** into the green V (vertex easing to (100, −7)).
  3. **1.6–2.2s:** a red dot pulses at the vertex labeled **"max loss −7 (pins at K)"**; the two arms extend with small green arrowheads ("profits if it moves").
  4. **2.2–2.8s:** the cost ledger sums `4 + 3 = 7` and a `×100 = $700` chip fades in beside it.
- **Interactive element:** Three sliders — **K** (90–110), **call premium** (1–8), **put premium** (1–8). The V redraws live: vertex moves horizontally with `K` and its depth updates to `−(call+put)`; both arms re-anchor. A **cost readout** sums the legs in real time (per-share and ×100). Edge case: raising either premium deepens the V and (preview) widens the eventual breakevens; a hint chip notes "more premium = deeper V."
- **Levels / markers table:**

  | Marker | Formula | Value | Color |
  |---|---|---|---|
  | Strike `K` (ATM) | anchor | 100 | blue dashed |
  | Call premium | input | 4 | green leg |
  | Put premium | input | 3 | green leg |
  | Total premium (cost) | `4 + 3` | 7 ( = $700 ) | blue ledger |
  | V vertex / max loss | `(K, −total)` | (100, −7) | red dot |
  | Up arm slope | `+1` per $1 | green | |
  | Down arm slope | `+1` per $1 | green | |

- **Caption:** *"You pay 7 up front. The worst case is the stock pinning at 100 — both options expire worthless and you lose the full 7. Everything past the arms is profit."*

---

### Module 4 — TEACH · "Straddle Breakevens"

- **Type / title:** TEACH · *Straddle Breakevens*.
- **Learning goal:** The two breakevens of a long straddle are **`K + totalPremium`** (upside) and **`K − totalPremium`** (downside). The stock must move by **more than the total premium** in either direction to profit. Connect to Lesson 4: a single long call breaks even at `K + callPremium`; here the *whole* premium (both legs) must be recovered, so the breakevens sit wider.
- **Instrument context (illustrative simulation):** `K = 100`, total premium 7 ⇒ breakevens **93** and **107**.
- **What the learner sees:** Two breakeven markers slide out **symmetrically** from `K` to `K ± 7` (93 and 107). The profit zones **beyond** them shade **green**; the V's interior (between 93 and 107) shades **red** — the loss zone. A "required move" badge reads **"±7 points = ±7% from 100"** to reach either breakeven.
- **Animation (Phaser, `PayoffScene` breakeven overlay):**
  1. **0.0–0.8s:** the V (from module 3) is present; two blue breakeven ticks spawn at the vertex.
  2. **0.8–1.6s:** they **slide apart** along the arms to 93 and 107 (ease-in-out), dropping vertical dashed blue guide lines to the x-axis with labels "BE 93" and "BE 107."
  3. **1.6–2.2s:** the interior region 93→107 fills translucent **red** (loss); the exterior fills translucent **green** (profit), animating outward from the breakevens.
  4. **2.2–2.6s:** a badge animates "move > 7 to profit."
- **Interactive element:** A single **total-premium slider** (2–14). Dragging it **wider** pushes both breakevens apart (`100 ± prem`) and deepens the V; **narrower** pulls them together. A **"required move %"** readout updates live (`prem / 100 × 100%`). Edge case: at premium 0 the breakevens collapse onto `K` (degenerate) with a hint "a free straddle would break even on any move — but options aren't free."
- **Levels / markers table:**

  | Marker | Formula | Value |
  |---|---|---|
  | Upper breakeven | `K + total` | 100 + 7 = **107** |
  | Lower breakeven | `K − total` | 100 − 7 = **93** |
  | Loss zone (red) | `93 ≤ S ≤ 107` | interior of V |
  | Profit zone (green) | `S < 93` or `S > 107` | exterior arms |
  | Required move | `total / S₀` | 7 / 100 = **7%** |

- **Caption:** *"Breakevens = strike ± total premium. With cost 7 on a $100 stock, you need a 7% move (to 93 or 107) just to get to zero — and more than that to win."*

---

### Module 5 — QUIZ · "Find the Straddle Breakevens"

- **Type / title:** QUIZ · *Find the Straddle Breakevens*.
- **Learning goal:** Compute both breakevens as `K ± totalPremium` and recognize that **pinning at `K` is the worst case** (max loss = total premium).
- **Instrument context (illustrative simulation):** ATM straddle, `K = 100`, **call premium 4, put premium 3** (total **7**).
- **Masked setup:** A V payoff is shown with its **vertex at (100, −7)** but the **breakeven markers are hidden** (the x-axis crossing points are masked by a blue panel). The arms are drawn but unlabeled where they cross zero.
- **Question text:** *"This ATM straddle has strike 100, a call premium of 4, and a put premium of 3 (total 7). What are the two breakevens, and what is the most you can lose?"*
- **Options:**
  - **A.** Breakevens **96 and 104**; max loss **7** at S = 100.
  - **B.** Breakevens **93 and 107**; max loss **7** (= $700) at S = 100. ✅
  - **C.** Breakevens **93 and 107**; max loss **0** — a straddle can't lose because it profits either way.
- **Correct answer:** **B.**
- **Reveal animation:** On submit, the masked panel slides away and the two blue breakeven ticks **snap** to 93 and 107 with their guide lines; the vertex flashes a red **"max loss −7"** label. If the learner picked **C**, the vertex's red dot pulses hard to show the V *does* dip below zero. If they picked **A**, ghost ticks briefly appear at 96/104 then visibly slide outward to 93/107 to show the error magnitude.
- **Why right / why wrong:**
  - **B is right.** Breakevens = `K ± totalPremium` = `100 ± 7` = **93 and 107**. The stock must close beyond 93 or 107 to profit. If it pins at 100, **both** legs expire worthless and you lose the **full 7** premium (×100 = **$700**) — that's the max loss, at the vertex.
  - **A is wrong (tempting):** it uses only *one* leg's premium (±4 → 96/104) instead of the total. The breakevens depend on the **total** premium (7), not either leg alone — you paid for both options.
  - **C is wrong (tempting):** "profits either way" is the *direction* intuition, but a straddle still **costs** money. A small/zero move loses the premium; the V clearly dips to −7. Profiting requires *clearing a breakeven*, not merely "either-way" optimism.
- **Levels / markers table (ground truth):**

  | Quantity | Formula | Value |
  |---|---|---|
  | Total premium | `4 + 3` | 7 |
  | Upper BE | `100 + 7` | 107 |
  | Lower BE | `100 − 7` | 93 |
  | Max loss | `−total` at `S=K` | −7 (−$700) |

> *Verification: pass — re-derived from K=100, premiums 4+3=7. Breakevens 100±7 = 93/107 exact; max loss = total premium = 7 at S=100 exact. Distractor A (96/104) corresponds to using a single 4-premium; distractor C contradicts the V dipping to −7. Answer B is arithmetically correct.*

---

### Module 6 — TEACH · "The Long Strangle"

- **Type / title:** TEACH · *The Long Strangle*.
- **Learning goal:** Define the **long strangle**: long 1 **OTM call** (higher strike `Kc`) + long 1 **OTM put** (lower strike `Kp`), same expiry. It is **cheaper** than a straddle but needs a **bigger** move to pay off. Payoff is a **flat-bottomed valley** between `Kp` and `Kc` at `−totalPremium`, then two ramps.
- **Instrument context (illustrative simulation):** Underlying anchor 100; `Kp = 95`, `Kc = 105`; OTM put premium `= 1.25`, OTM call premium `= 1.75`, **total = 3** — *all per-leg values are illustrative examples, tagged the same way as the straddle's call 4 / put 3 split* (the lesson elsewhere describes the strangle by its total of 3; the per-leg split appears here for parity). (Cheaper than the straddle's 7 because both legs are OTM.) A faint **straddle V** (cost 7) is ghosted behind for contrast.
- **What the learner sees:** An OTM **call** hockey stick (kink at `Kc = 105`) and an OTM **put** hockey stick (kink at `Kp = 95`) sum into a **valley with a flat bottom** spanning 95→105 at `y = −3`, then two ramps rising outside the strikes. The ghosted straddle V (deeper, more expensive) sits behind it so the learner sees: the strangle is **shallower (cheaper)** but has a **wider flat loss zone**.
- **Animation (Phaser, `PayoffScene` two-strike mode):**
  1. **0.0–0.6s:** axes; two blue dashed strike lines drop at 95 (`Kp`) and 105 (`Kc`).
  2. **0.6–1.4s:** OTM put leg (kink at 95) and OTM call leg (kink at 105) draw in (green, semi-transparent).
  3. **1.4–2.4s:** they sum into the solid green **valley**; the **flat bottom** (95→105) traces last, holding at `−3`, with a red translucent band filling it.
  4. **2.4–3.0s:** the straddle V ghosts in behind (thin grey-blue), with chips "strangle cost 3" vs "straddle cost 7."
- **Interactive element:** A **strike-spread slider** that moves `Kp` and `Kc` symmetrically apart/together around 100 (e.g., ±3 to ±12). As the strikes **spread wider**: the flat bottom **widens** and the total premium (cost) **drops** (further-OTM options are cheaper), shown live in the cost readout; as they **tighten** toward 100 the strangle approaches the straddle (cost rises, flat bottom shrinks). Live readouts: `Kp`, `Kc`, total premium, flat-bottom width. Edge case: when `Kp = Kc = 100`, a hint notes "now it's a straddle" and the V replaces the valley.
- **Levels / markers table:**

  | Marker | Formula / input | Value | Color |
  |---|---|---|---|
  | Put strike `Kp` | input | 95 | blue dashed |
  | Call strike `Kc` | input | 105 | blue dashed |
  | OTM put premium *(illustrative)* | input | 1.25 | green leg |
  | OTM call premium *(illustrative)* | input | 1.75 | green leg |
  | Total premium *(illustrative)* | `1.25 + 1.75` | 3 ( = $300 ) | blue ledger |
  | Flat bottom | `−total`, `Kp≤S≤Kc` | −3 across 95–105 | red band |
  | Straddle ghost | `|S−100|−7` | depth −7 | grey-blue |

- **Caption:** *"A strangle uses two out-of-the-money options, so it's cheaper (3 vs 7) — but its loss zone is a flat valley spanning 95–105. Cheaper to own, but the stock has to travel farther to escape."*

---

### Module 7 — TEACH · "Strangle Breakevens"

- **Type / title:** TEACH · *Strangle Breakevens*.
- **Learning goal:** The long-strangle breakevens are **`Kc + totalPremium`** (upside) and **`Kp − totalPremium`** (downside). **Max loss = total premium across the entire flat zone** between the strikes. Tie to Lesson 4: the upside breakeven is the OTM call's strike plus the *whole* premium; the downside is the OTM put's strike minus the whole premium.
- **Instrument context (illustrative simulation):** `Kp = 95`, `Kc = 105`, total premium 3 ⇒ breakevens **`105 + 3 = 108`** (up) and **`95 − 3 = 92`** (down).
- **What the learner sees:** Breakeven markers extend **outward** from `Kc` and `Kp` by the total premium: up to **108**, down to **92**. The **flat-bottom region (95→105)** shades **red** (uniform max loss of −3 everywhere inside), and the zones beyond 92 and 108 shade **green** (profit). A badge: *"to break even, move from 100 to 108 (up) or 92 (down) — 8 points either way."*
- **Animation (Phaser, `PayoffScene` breakeven overlay):**
  1. **0.0–0.6s:** the valley from module 6 is present; ticks spawn at the two kinks (95, 105).
  2. **0.6–1.4s:** the upper tick slides from 105 → **108** and the lower from 95 → **92** (outward, ease-out), dropping blue guide lines labeled "BE 108" / "BE 92."
  3. **1.4–2.0s:** the **whole flat bottom** (95→105) fills red and a single label "max loss −3 (anywhere between the strikes)" stretches across it.
  4. **2.0–2.4s:** the two exterior ramps shade green; badge "needs an 8-pt move" animates.
- **Interactive element:** Three controls — **`Kc`**, **`Kp`**, **total premium** — each adjustable. Both breakevens (`Kc + prem`, `Kp − prem`) and the flat max-loss band **recompute live**. A **"required move to nearest BE"** readout shows the distance from the 100 anchor to the closer breakeven. Edge case: if the learner sets premium so large that `Kp − prem < 0`, the down breakeven is clamped at 0 with a hint "a stock can't go below zero — downside breakeven floors out."
- **Levels / markers table:**

  | Marker | Formula | Value |
  |---|---|---|
  | Upper breakeven | `Kc + total` | 105 + 3 = **108** |
  | Lower breakeven | `Kp − total` | 95 − 3 = **92** |
  | Max-loss band | `−total`, `Kp..Kc` | −3 across 95–105 |
  | Nearest-BE move (from 100) | `min(108−100, 100−92)` | **8 points (8%)** |

- **Caption:** *"Strangle breakevens push out from the strikes: 108 up, 92 down. Inside the strikes you simply lose the 3 you paid — the loss is flat across 95–105."*

---

### Module 8 — QUIZ · "Straddle vs Strangle: Cost vs Move"

- **Type / title:** QUIZ · *Straddle vs Strangle: Cost vs Move*.
- **Learning goal:** The **strangle costs less** but its **breakevens are farther out**, so it needs a **bigger move**; the **straddle costs more** but breaks even on a **smaller** move. Reconcile "cheaper" with "needs a bigger move."
- **Instrument context (illustrative simulation):** Same underlying anchored at 100. **Straddle:** `K = 100`, cost **7**, breakevens **93 / 107**. **Strangle:** `Kp = 95`, `Kc = 105`, cost **3**, breakevens **92 / 108**.
- **Masked setup:** Both payoffs are shown overlaid on one axis (V + valley), but the **breakevens are masked** and a question asks which structure needs the bigger move. The costs (7 vs 3) are visible.
- **Question text:** *"A straddle at K=100 costs 7 (breakevens 93 / 107). A strangle with Kp=95, Kc=105 costs 3 (breakevens 92 / 108). Starting from 100, which one needs the BIGGER move to break even?"*
- **Options:**
  - **A.** The **straddle** — it costs more, so it must need a bigger move.
  - **B.** The **strangle** — its nearest breakeven (108 up / 92 down) is **8** from 100, vs the straddle's **7** (107 / 93). ✅
  - **C.** They need the **same** move, since both are centered on 100.
- **Correct answer:** **B.**
- **Reveal animation:** The mask drops; blue breakeven ticks snap to 93/107 (straddle) and 92/108 (strangle). Two horizontal **measuring arrows** animate from the 100 anchor to each structure's nearest breakeven: a **7-wide** arrow to 107 (straddle) and a longer **8-wide** arrow to 108 (strangle). A chip reads "cheaper (3) but farther (8)." If the learner picked **A**, the two arrows are shown side-by-side so the longer one is clearly the *cheaper* strangle. If **C**, the unequal arrow lengths (7 vs 8) are highlighted.
- **Why right / why wrong:**
  - **B is right.** Breakeven distance, not price tag, sets the required move. Strangle nearest BE = `105 + 3 = 108` (or `95 − 3 = 92`), **8** from 100. Straddle nearest BE = `100 + 7 = 107` (or 93), **7** from 100. So the **cheaper** strangle needs the **larger (8 vs 7)** move — exactly the cost-vs-move tradeoff.
  - **A is wrong (tempting):** "more expensive ⇒ bigger move" inverts the relationship. The straddle's higher cost buys breakevens that are *closer* to the spot (its strike is ATM), so it needs a *smaller* move.
  - **C is wrong (tempting):** both are centered on 100, but the strangle's strikes are *spread out* (95/105) before you even add premium, so its breakevens are pushed farther (92/108). Symmetric centering ≠ equal breakeven distance.
- **Levels / markers table (ground truth):**

  | Structure | Cost | Breakevens | Nearest-BE distance from 100 |
  |---|---|---|---|
  | Straddle (K=100) | 7 | 93 / 107 | **7** |
  | Strangle (95/105) | 3 | 92 / 108 | **8** |

> *Verification: pass — straddle BE 100±7 = 93/107 (distance 7); strangle BE 105+3 = 108 and 95−3 = 92 (distance 8). 8 > 7, so the cheaper strangle requires the larger move. Answer B correct; A inverts cost↔move; C ignores strike spread.*

---

### Module 9 — TEACH · "When You'd Use Them: Earnings & Binary Events"

- **Type / title:** TEACH · *When You'd Use Them: Earnings & Binary Events*.
- **Learning goal:** Long straddles/strangles are placed **ahead of earnings or binary events** (earnings reports, FDA decisions, court rulings, major product launches) when you expect a **big move but not the direction**.
- **Instrument context (illustrative simulation; real qualitative anchor):** A generic stock at 100 with a **scheduled earnings date** marker. For color, the module may name a real ticker that genuinely reports quarterly (e.g., a mega-cap printing earnings after the close) — used **qualitatively only**; the premiums shown remain illustrative.
- **What the learner sees:** A calendar strip zooms to an **earnings date** flag. The stock line **coils** (tightening range) into that date, then on the **event candle** it **whips** violently — first a green up-whip, replayed as a red down-whip — and the straddle's **V payoff overlays** to show that profit can come from **either** the up *or* the down whip, as long as it's big enough.
- **Animation (Phaser, `EventCandleScene`):**
  1. **0.0–0.8s:** a horizontal calendar draws; an **earnings flag** plants on a future date (blue).
  2. **0.8–1.6s:** the price line coils toward the flag (amplitude shrinks) — "the market waits."
  3. **1.6–2.2s:** at the flag, a large **green** event candle gaps up; the V overlay lights its **upper arm green** ("profit").
  4. **2.2–2.8s:** rewind; the same event candle replays **red** gapping down; the V lights its **lower arm green** ("also profit").
  5. **2.8–3.2s:** caption: "you don't pick the direction — you pick that it *moves*."
- **Interactive element:** A scenario picker — choose **[Earnings]** / **[FDA decision]** / **[Court ruling]** — and a structure **[Long straddle]** / **[Long strangle]**. The learner then **triggers the event** with a **direction toggle (up/down)** and a **size dial**. The event candle fires in the chosen direction/size and the chosen payoff resolves, with a live **P&L readout** and a green/red badge. Edge case: triggering a *tiny* move foreshadows module 10 — the readout shows a loss even on a real (small) move, with a hint "small move? see the next module."
- **Levels / markers table:**

  | Element | Value | Note |
  |---|---|---|
  | Underlying anchor | 100 | pre-event |
  | Event types | earnings / FDA / ruling | binary catalysts |
  | Straddle overlay | V, BE 93/107 | both arms can profit |
  | Strangle overlay | valley, BE 92/108 | both ramps can profit |
  | Up-whip outcome | green | profits if it clears a BE |
  | Down-whip outcome | red move → green P&L | profits if it clears a BE |

- **Caption:** *"These are event trades. You buy them when a catalyst (like earnings) is coming and you expect a big move but can't call the direction — the payoff wins on either whip."*

---

### Module 10 — TEACH · "The IV-Crush Trap"

- **Type / title:** TEACH · *The IV-Crush Trap*.
- **Learning goal:** Implied volatility is **high (premiums fat) BEFORE** the event and **COLLAPSES right after** (IV crush). A long straddle/strangle can **LOSE even when the stock moves**, if the **realized move is smaller than the priced-in (breakeven) move**. You must **clear a breakeven**, not just "move."
- **Instrument context (illustrative simulation; real qualitative anchor):** Straddle `K = 100`, total premium **7** (breakevens 93/107). Pre-event IV inflates the premium; post-event the **extrinsic** value collapses to ~0, leaving only **intrinsic** value. Real qualitative anchor: single-name IV genuinely spikes into earnings and crushes after — the specific premium/IV numbers are illustrative.
- **What the learner sees:** Before earnings, an **inflated "IV balloon"** puffs the premium bar tall (modeling the 7 you pay, fat with extrinsic value). At the event the balloon **pops** (IV crush) and the premium bar **deflates** sharply. The stock gaps **a little** (e.g., to 104). **Two distinct things are shown happening, and the spec keeps them separate:**
  - **(1) The expiry-math loss is pure breakeven logic — no IV needed.** Held to expiry, every option is worth *exactly* its intrinsic value, so the straddle is worth `max(104−100,0) + max(100−104,0) = 4`. You paid 7. P&L = `4 − 7 = −3`. That −3 happens **entirely because 104 is inside the 93–107 breakevens** — the 4-point move never cleared the 7-point breakeven move. At expiry there is **no leftover time/extrinsic value to be "gutted,"** so IV crush contributes *nothing* to this −3.
  - **(2) IV crush is a *separate, pre-expiry* phenomenon.** Right after the print, the position's **extrinsic value collapses to ~0**, so the option is immediately marked down to roughly its intrinsic value. A trader who *hoped to sell the straddle out for a small profit on the move* (rather than hold to expiry) discovers there is no time value left to sell — the crush locks in the loss **faster and deeper** than a naive "it moved, so IV stays fat" expectation. The animation shows the balloon (extrinsic) popping to make this visceral, but the learner must not conclude the crush *caused* the expiry −3.
  - Net: a **loss despite a real move** — and you couldn't even bail out for the time value you paid for, because the crush erased it the instant the event printed.
- **Animation (Phaser, `IVCrushScene`):**
  1. **0.0–0.8s:** a tall premium bar (height 7) draws, wrapped in a translucent blue **"IV balloon"** labeled "high IV — fat premium."
  2. **0.8–1.6s:** the earnings flag triggers; the **balloon pops** (particle burst) and the premium bar **deflates** to its intrinsic remainder.
  3. **1.6–2.4s:** the stock candle gaps **up to 104** (small green gap); the V overlay shows the dot landing at `S=104`, **inside** 93–107, in the **red** loss zone.
  4. **2.4–3.0s:** a P&L ledger animates: `intrinsic call 4 − premium 7 = −3` (per share); a red "moved, still lost" stamp.
- **Interactive element:** Two sliders — **pre-event IV (premium)** (which sets the total premium, 3–12) and **realized move** (−15% … +15%). The P&L resolves live: `P&L = max(S−K,0) + max(K−S,0) − premium` where `S = 100 × (1 + move)`. The learner discovers a **"moved but still lost" zone**: any realized move smaller than the premium (i.e., `|moveInPoints| < premium`) loses, even though the stock moved. A live badge flips **green "cleared BE"** vs **red "moved but lost."** Edge case: setting a huge premium with a modest move drives the red zone wide — visualizing why a richly-priced (high-IV) straddle is hard to win.
- **Levels / markers table (worked example):**

  | Quantity | Formula | Value |
  |---|---|---|
  | Premium paid (high IV) | input | 7 |
  | Realized move | input | +4% → S = 104 |
  | Call intrinsic at expiry | `max(104−100,0)` | 4 |
  | Put intrinsic at expiry | `max(100−104,0)` | 0 |
  | Total intrinsic | 4 + 0 | 4 |
  | P&L (at expiry) | `4 − 7` | **−3** (−$300) — *intrinsic only; no IV term* |
  | Cause of the −3 | `S` inside `[93,107]` | move (4) < breakeven move (7) — **pure breakeven logic** |
  | What IV crush adds | extrinsic → ~0 at the print | can't sell out for time value — **separate, pre-expiry** effect |
  | Verdict | `S` vs [93,107] | 104 inside ⇒ **loss** |

- **Caption:** *"IV crush is the trap: you paid 7 of fat, high-IV premium, the stock moved 4% to 104 — and you still lost 3 because 104 is inside the 93–107 breakevens — the 4% move didn't clear the 7-point breakeven move. And IV crush means you can't even sell out for the time value you paid for: right after the print the extrinsic value is gone. (Two separate facts: the −3 is pure breakeven math; the crush is why you can't escape it.) You must clear a breakeven, not just move."*

---

### Module 11 — QUIZ · "The Stock Moved — Did You Win?"

- **Type / title:** QUIZ · *The Stock Moved — Did You Win?*.
- **Learning goal:** You profit **only by clearing a breakeven**, not by the stock merely "moving." IV crush + a small move is the **classic losing straddle**.
- **Instrument context (illustrative simulation):** Long straddle, `K = 100`, total premium **7** (breakevens 93 / 107). After earnings the stock **gaps up 4% to 104** and **IV crushes**.
- **Masked setup:** A pre-event chart shows the coil into earnings with the straddle's breakevens (93/107) drawn. The **post-event candle and the P&L are masked** behind a blue panel.
- **Question text:** *"You own this straddle (K=100, total premium 7, breakevens 93 / 107). After earnings the stock gaps UP 4% to 104 and IV crushes. Did the straddle PROFIT?"*
- **Options:** **Yes** / **No**.
- **Correct answer:** **No.**
- **Reveal animation:** The mask drops to expose a **green gap-up candle to 104**; the premium bar **deflates** (IV crush particle pop); the P&L marker walks the V to `S=104` and lands in the **red** zone at **−3**; the 93/107 breakeven lines flash to show 104 sits **inside** them. A red "moved but lost" stamp animates. If the learner answered **Yes**, an extra callout draws the gap between 104 and the 107 breakeven (3 points short).
- **Why right / why wrong:**
  - **No is right.** 104 is **inside** the breakevens (93–107), so the position is a **loss** even though the stock moved. The arithmetic is **pure breakeven logic, no IV term needed**: held to expiry the straddle is worth its intrinsic value, `max(104−100,0) + max(100−104,0) = 4`, which is **less than the 7 paid**, so P&L = `4 − 7 = −3` per share (−$300). The loss is caused **entirely by the 4-point move failing to clear the 7-point breakeven move** — IV crush does *not* enter this expiry math (at expiry there is no extrinsic value left to crush). To profit, price had to clear **107** (up) or **93** (down). *(Where IV crush bites is the separate, pre-expiry escape route: right after the print the extrinsic value collapses to ~0, so you can't even sell the straddle out for any leftover time value — the loss is locked in immediately, not just at expiry.)*
  - **Yes is wrong (tempting):** the intuition "it moved 4%, so my volatility bet won" conflates **"moved" with "cleared a breakeven."** The move needed just to break even was **7 points** (the total premium); a 4-point move never reaches the 107 breakeven. (Note: 7 points is the *breakeven* move, which the lesson models as the premium — not literally the Black-Scholes "expected move," but the move you must make to get to zero.) And separately, **IV crush** removes any extrinsic value you might have hoped to sell, so you can't bail out for time value either. The lesson: **clear the breakeven, don't just move.**
- **Levels / markers table (ground truth):**

  | Quantity | Value |
  |---|---|
  | Breakevens | 93 / 107 |
  | Post-event price | 104 (+4%) |
  | Inside breakevens? | **Yes (93…107 band)** ⇒ loss |
  | Call intrinsic | 4 |
  | Premium paid | 7 |
  | P&L | **−3** (−$300) |

> *Verification: pass — S=104 ∈ [93,107] ⇒ loss. P&L = max(104−100,0)+max(100−104,0) − 7 = 4 − 7 = −3, exact (intrinsic-only expiry math; no IV term — at expiry there is no extrinsic value to crush). The −3 is caused solely by the 4-pt move not clearing the 7-pt breakeven move. Answer No is correct; Yes conflates "moved" with "cleared a breakeven." IV crush is a separate, pre-expiry effect that removes the extrinsic value you'd need to sell out early — it does not change the −3 expiry figure.*

---

### Module 12 — TEACH · "The Other Side: Short Straddle & Short Strangle"

- **Type / title:** TEACH · *The Other Side: Short Straddle & Short Strangle*.
- **Learning goal:** A **short** straddle/strangle is the **mirror**: **SELL both legs**, **collect** the premium, and **profit if the stock stays QUIET inside the breakevens**. It has **large/undefined risk** if the stock moves big — the inverse of the long.
- **Instrument context (illustrative simulation):** Short straddle `K = 100`, premium **collected = 7**, breakevens 93/107 (same as the long). Short strangle `Kp=95/Kc=105`, premium collected 3, breakevens 92/108.
- **What the learner sees:** The long **V / valley flips across the x-axis** into an **inverted tent**: a **profit region** (the collected premium, **green**) over the quiet zone, with **risk ramps falling away** on both sides (red). For the **short straddle**, the upside loss ramp is labeled **"unbounded"** (a stock can rise without limit); the downside loss is large but capped at the stock going to 0. The same breakevens (93/107) now divide **profit (inside)** from **loss (outside)** — the exact reverse of the long.
- **Animation (Phaser, `PayoffScene` short/mirror mode):**
  1. **0.0–0.8s:** the long V is shown, then **reflects** about the x-axis (flip tween) into the inverted tent.
  2. **0.8–1.4s:** the **inside** region (93→107) fills **green** (profit, peak = +7 only exactly at K for a straddle; flat +premium across strikes for a strangle); the **outside** fills **red**.
  3. **1.4–2.0s:** the upside ramp extends off-screen with an "**unbounded risk ↑**" arrow (red); a risk badge flips from "max loss = premium" to "**large / undefined risk**."
  4. **2.0–2.4s:** caption: "you keep the 7 only if it stays inside 93–107."
- **Interactive element:** A **Long ⇄ Short toggle** applied to a chosen **straddle/strangle**. Flipping it **inverts the payoff** live and flips a **risk badge**: long shows **"max loss = premium (defined)"**; short shows **"large / undefined risk."** The **profit zone = inside the breakevens** is highlighted green for the short, red for the long. Live readouts: premium (paid vs collected), breakevens, max profit, max loss/"unbounded." Edge case: on the short straddle, the up-side max-loss readout displays **"∞ (unbounded)"** and the down-side displays the finite worst case (`premium − K` at S→0, i.e., a large but bounded loss).
- **Levels / markers table:**

  | Structure | Premium | Profit zone | Max profit | Max loss |
  |---|---|---|---|---|
  | Long straddle | pay 7 | outside 93/107 | unbounded | −7 (at K) |
  | **Short straddle** | **collect 7** | **inside 93/107** | **+7 (at K)** | **unbounded up; large down** |
  | Long strangle | pay 3 | outside 92/108 | unbounded | −3 (flat 95–105) |
  | **Short strangle** | **collect 3** | **inside 92/108** | **+3 (flat 95–105)** | **unbounded up; large down** |

- **Caption:** *"Flip the trade and you flip the bet: a short straddle keeps the 7 you collected if the stock pins near 100 — but a big move now costs you, with unlimited risk to the upside. Quiet wins; wild ruins."*

---

### Module 13 — QUIZ · "Quiet or Wild? Pick the Right Trade"

- **Type / title:** QUIZ · *Quiet or Wild? Pick the Right Trade*.
- **Learning goal:** Choose **long vol** (straddle/strangle) when you expect a **big move**; choose **short vol** when you expect the stock to **stay quiet inside the breakevens** — and respect the short's **large risk**. Ties directly to the IV-crush lesson.
- **Instrument context (illustrative simulation):** Earnings approaching on a stock at 100. **IV is very rich** (premiums fat), and the learner's *expectation* is that the stock will **barely move (pin near the strike)**.
- **Masked setup:** A pre-event chart at 100 with a rich-IV badge and the breakevens (93/107) drawn; the **outcome is masked**. A scenario card states the expectation explicitly.
- **Question text:** *"IV is very rich heading into earnings, and you expect the stock to barely move — pinning near the 100 strike. Which trade fits best?"*
- **Options:**
  - **A.** **Long straddle** — buy volatility into the event.
  - **B.** **Short straddle** — sell the rich premium, accepting the large risk. ✅
  - **C.** **Stay flat** — do nothing.
- **Correct answer:** **B** (short straddle, with the caveat about its large risk). **Grading note:** unlike the other three quizzes, the "best" answer here is a *judgment*, not arithmetic. The grader should treat **B as the intended best-fit** answer for the stated confident "pin + rich IV" view, but **C ("stay flat") is graded as a defensible, risk-averse choice — not a hard wrong.** A learner who picks C sees an affirming message ("reasonable — the short straddle's unbounded risk makes sitting out genuinely sensible for many traders") rather than a red "incorrect" stamp, and is shown the edge they passed up. Only **A** is graded as a clear mismatch. This keeps the streak/scoring honest: no learner is told a risk-aware decision is factually wrong.
- **Reveal animation:** The mask drops to a **small, quiet** post-event candle pinning near 100; the premium bar **deflates** (IV crush). For **B**, the **green profit region** lights and a "+premium kept" chip animates (the short keeps the fat premium and benefits from the crush). For **A**, the **long** V is overlaid landing in its **red** interior (a small move + crush loses). For **C**, instead of a red "wrong" stamp, a **neutral-green "reasonable" note** affirms the risk-averse choice ("sitting out is sensible when the risk is unbounded") and a grey "missed-edge" callout shows the premium that could have been collected. A persistent red caveat banner reads **"short = large/undefined risk if the move is bigger than expected."**
- **Why right / why wrong:**
  - **B is right.** If you genuinely expect a **pin** and IV is **rich**, **selling** the straddle lets you (1) **keep the fat premium** if the stock stays inside 93–107, and (2) **benefit from IV crush**, which deflates the options you're short. That's the textbook "rich IV + expected quiet" trade. The caveat: a short straddle has **large/undefined risk** if the move is bigger than you expect, so it's only right when you *truly* expect quiet.
  - **A is wrong (tempting):** buying a long straddle into **rich IV** with an expected **small** move is the IV-crush trap from module 11 — you'd pay top dollar and lose to the small move + crush. Right structure for the *wrong* expectation.
  - **C is defensible, not wrong (graded soft):** staying flat avoids the short straddle's **unbounded** tail risk, which is a genuinely sound call for many real traders — so the quiz does **not** stamp C as "incorrect." It simply forfeits the clearest edge in the scenario (selling overpriced premium you expect to decay into the crush). It's the *risk-averse* answer rather than the *best-fit* answer for the stated confident "pin" view. The reveal affirms the prudence of C while pointing to the edge B would have captured — matching the trade to the view *and* respecting that "do nothing" is a legitimate response to large undefined risk.
- **Levels / markers table (ground truth):**

  | Expectation | Best structure | Why |
  |---|---|---|
  | Big move, direction unknown | Long straddle/strangle | profit outside breakevens |
  | Quiet pin, **rich IV** | **Short straddle/strangle** | keep premium + IV crush; *large risk* |
  | No conviction | Flat | avoid both tails |

> *Verification: pass — with a confident "pin near K + rich IV" view, the short straddle is the textbook best-fit (collect premium, benefit from crush) with the stated large-risk caveat. Long straddle (A) is the IV-crush trap and is the one clear mismatch. Flat (C) forfeits the edge but is risk-averse and defensible — graded soft (affirmed, not stamped wrong) because the short's unbounded risk makes "do nothing" legitimate. This is the lesson's one judgment quiz (vs the arithmetic of M5/M8/M11); Answer B, caveated, is the intended best-fit.*

---

### Module 14 — INTERACTIVE · "Volatility Lab: Tune the Whole Trade"

- **Type / title:** INTERACTIVE · *Volatility Lab: Tune the Whole Trade*.
- **Learning goal:** Synthesize everything — **strikes, premiums, realized move, and IV crush jointly determine P&L**, and **breakevens are the line between winning and losing.** Let the learner engineer both a winner and a "moved-but-lost" loser.
- **Instrument context (illustrative simulation):** Underlying anchor 100, full control of structure and parameters. All math exact per §4 formulas.
- **What the learner sees:** A combined dashboard: a live **payoff diagram** with breakevens, an **IV/premium balloon**, and a **realized-move dial**. As inputs change, a **P&L marker walks the payoff** and crosses the breakevens in real time. A readout panel lists **cost, both breakevens, P&L, and a "cleared a breakeven?" flag.**
- **Animation (Phaser, `PayoffScene` + `IVCrushScene` combined):** Continuous — there is no fixed timeline; every control change tweens the relevant artifact (payoff redraws, balloon inflates/pops, P&L dot slides). On "run event," the realized-move dial value drives the event candle and the P&L dot walks to its landing spot with an ease, flashing **green** (cleared a BE) or **red** (inside).
- **Interactive element (the full sandbox):**
  - **Structure toggle:** Straddle ⇄ Strangle; **Long ⇄ Short**.
  - **Strikes:** `K` (straddle) or `Kp`/`Kc` (strangle), constrained `Kp < Kc`.
  - **Premiums:** per-leg premiums (or a combined "IV richness" slider that scales the total premium).
  - **Pre-event IV:** sets premium fatness; **"run event"** crushes the extrinsic portion.
  - **Realized move / direction:** a dial setting `S` at "expiry."
  - **Live readouts:** `cost` (paid/collected), `upper BE`, `lower BE`, `P&L` (per-share and ×100), and a **bold flag**: **"CLEARED a breakeven → profit"** (green) or **"inside breakevens → loss"** (red). For short structures, a **risk badge** shows "unbounded up / large down."
  - **Edge cases:** `Kp ≥ Kc` is blocked with a hint; premium 0 collapses breakevens to the strikes; a down move that floors at S=0 caps the long's gain and the short's loss appropriately; the "moved-but-lost" badge appears whenever `|move| < requiredMove` for a long.
- **Levels / markers table (example presets the lab can load):**

  | Preset | Structure | Params | Cost | BEs | Result at the stated S |
  |---|---|---|---|---|---|
  | Clean winner | Long straddle | K=100, prem 7, S=112 | 7 | 93/107 | `12 − 7 = +5` (cleared 107) |
  | Moved-but-lost | Long straddle | K=100, prem 7, S=104 | 7 | 93/107 | `4 − 7 = −3` (inside) |
  | Cheap & wide, just clears | Long strangle | 95/105, prem 3, S=110 | 3 | 92/108 | `(110−105) − 3 = +2` (cleared 108) |
  | Cheap & wide, falls short | Long strangle | 95/105, prem 3, S=107 | 3 | 92/108 | `(107−105) − 3 = −1` (inside 108) |
  | Sell the quiet | Short straddle | K=100, prem 7, S=102 | +7 | 93/107 | `7 − |102−100| = +5` (kept premium) |

  *(All P&L computed by the exact §4 formulas; the lab recomputes whatever the learner sets.)*

- **Caption:** *"This is the whole trade in one place. Move the dials and watch the breakevens decide the outcome — build a winner, then build one where the stock moves and you still lose."*

---

### Module 15 — CAPSTONE · "Capstone & Recap: Trade an Earnings Event"

- **Type / title:** CAPSTONE / RECAP · *Capstone & Recap: Trade an Earnings Event*.
- **Learning goal:** Recap the whole lesson — straddle vs strangle shapes, breakevens (`K ± premium`, `Kc + prem` / `Kp − prem`) tied back to Lesson 4's single-leg breakevens, **when** these trades are used, and the **IV-crush trap** ("clear the breakevens, not just move") — inside one earnings scenario, then **grade** the learner's trade.
- **Instrument context (illustrative simulation; real qualitative anchor):** A stock at 100 with a **scheduled earnings date** (a real, genuinely-reporting ticker may be named for color, qualitatively only). Rich pre-event IV. The learner builds the trade; the event runs; all breakeven/payoff math is exact.
- **What the learner sees:** A **summary reel** first replays the lesson's key images — the straddle **V**, the strangle **flat-bottomed valley**, the **IV balloon pop**, and the **long/short mirror**. Then the learner is handed a build panel and a "run earnings" button. After committing and running, a **scorecard** appears explaining the P&L against the breakevens and IV crush.
- **Animation (Phaser, montage + `EventCandleScene` + `IVCrushScene`):**
  1. **Recap reel (0–4s):** V draws → morphs to valley → IV balloon inflates and pops → payoff flips to the short mirror — each with its one-line caption, all in the white/blue/green palette.
  2. **Build phase:** learner's chosen payoff renders live with its breakevens (blue) as they set parameters.
  3. **Event phase:** on "run earnings," the IV balloon pops, the event candle gaps the realized size/direction, and the P&L dot walks the payoff to its landing spot, flashing green/red against the breakevens.
- **Interactive element (build → commit → run → grade):**
  - **Pick structure:** straddle or strangle; **long or short**.
  - **Pick strikes & premiums** (or accept rich-IV defaults: straddle prem 7; strangle 95/105 prem 3).
  - **State your expectation** (big move / quiet pin), then **commit** and **run the earnings event** — the engine applies a realized move (it can randomize within a labeled range, or be set for a deterministic graded outcome) plus IV crush.
  - **Scorecard** grades: **Win/Loss**, the **P&L** (per-share and ×100), which **breakeven** was (or wasn't) cleared, and an **IV-crush note** if a long lost on a real-but-small move. The card explicitly restates the breakeven formula used.
  - **Embedded check (question):** *"Given the realized move and the IV crush, did your trade win — and why?"* with the reveal showing P&L vs **both** breakevens and the move-vs-priced-in-move comparison. (Same masked → reveal → grade → explain mechanic as the quizzes.)
  - **Edge case:** if the learner builds a **short** structure and the event delivers a **big** move, the scorecard fires the **"large/undefined risk"** outcome (a large loss), reinforcing module 12's caveat.
- **Levels / markers table (example graded run):**

  | Field | Example value |
  |---|---|
  | Structure | Long straddle, K=100, prem 7 |
  | Breakevens | 93 / 107 |
  | Pre-event IV | rich (premium fat) |
  | Realized move | +6% → S = 106 |
  | Cleared a BE? | **No** (106 < 107) |
  | Call intrinsic | 6 |
  | P&L | `6 − 7 = −1` (−$100) — *moved but lost* |
  | Lesson tag | "Clear the breakeven, not just move." |

- **Caption:** *"You built it, you ran the event — and the breakevens, not the headline 'it moved,' decided the result. That's volatility trading: structure, breakevens, and IV crush, together."*
- On completion, the final progress segment fills and the platform hands off to the **Congratulations screen** (below).

---

## 7. PRD / platform traceability

| PRD / platform requirement | Satisfied by |
|---|---|
| Numbered modules in a single lesson | §2 spine — **15 modules** (1 intro, 8 teach, 4 quiz, 1 interactive, 1 capstone). |
| Teach-style module: show concept + overlay explaining it | §3 TEACH; per-module animations + annotation tables in §6 (modules 2,3,4,6,7,9,10,12). |
| Quiz module: masked condition → answer → reveal → right/wrong → explanation (incl. *why wrong*) | §3 QUIZ; reused from Lesson 1; full masked setup / options / reveal / why-right-why-wrong in modules 5, 8, 11, 13 (and the capstone's embedded check). |
| Animated, interesting modules (Phaser) | §3 + every §6 module's **Animation** subsection; scenes in §8. |
| Real-data integrity / no fabricated "verified" data | §0 INTEGRITY note + §4 — simulation-driven; all numbers labeled illustrative; only qualitative anchors (earnings/IV-crush behavior) are real; math is exact. |
| Progress bar showing position in lesson | §2 — segmented 15-tick bar bound to `completedModules / 15`; §8. |
| Streak = most modules completed in one sitting | §8 — `currentSittingCount → bestStreak`. |
| Dashboard resume where left off | §8 — Firestore `progress.lastCompletedModule`; "Resume" → `lastCompletedModule + 1`. |
| Google-auth gated dashboard | §8 — Firebase Google sign-in; user doc created on first login. |
| Congratulations screen at the end | §2 + below — screen 16, platform-handled, **not** counted in `/15`. |
| Minimalist white/blue/green palette (green=up/buy/long, red=down/sell/short, blue=annotations), desktop + mobile | Palette key atop §6; applied in every module; responsive notes in §8. |
| Builds on prior lesson (Lesson 4 single options) | Modules 2–7 explicitly sum/extend Lesson-4 single-leg payoffs and tie breakevens back to single-leg breakevens. |

---

## 8. Implementation notes (concise)

- **Reusable Phaser scenes (build these once, reuse across modules):**
  - **`PayoffScene`** — the workhorse. Renders a profit/loss payoff diagram from a list of legs `[{type:'call'|'put', side:'long'|'short', K, premium}]`. Computes the piecewise payoff `Σ legPayoff(S) − Σ paid + Σ collected`, draws the curve (green), shades profit (green) / loss (red) regions, drops blue strike & **breakeven** markers, and exposes a `walkPnLMarker(S)` method (the dot that slides along the curve). Handles V (straddle), flat-bottomed valley (strangle), and the inverted mirrors (shorts). Used by modules 2,3,4,6,7,8,12,14,15.
  - **`LegStackScene`** — animates two single-leg hockey sticks summing vertically into a combined curve (module 2; reused as the merge animation in module 3).
  - **`IVCrushScene`** — the IV "balloon" inflate → pop → premium-bar deflate, splitting premium into intrinsic vs extrinsic and crushing extrinsic to ~0 (modules 10, 14, 15).
  - **`EventCandleScene`** — calendar/earnings flag, the coil-into-event, and the gap **event candle** (green up / red down) that drives the realized move (modules 9, 15).
  - **`IntroVibeScene`** — the coiled, vibrating line + dual arrows + profit meter (module 1).
  - These share a tiny `payoffMath.ts` module (pure functions: `straddlePnL`, `stranglePnL`, `breakevens`, `requiredMove`) so the **same exact formulas** back the animations, the live readouts, and the quiz grading.
- **INTERACTIVE state driving:** React owns the control state (sliders/toggles/dials) in a `useReducer` store; on every change it calls into `payoffMath.ts` and passes the result to the active Phaser scene via the scene's `update(params)` method (no React re-mount of the canvas). Readouts (cost, breakevens, P&L, "cleared a breakeven?" flag) are plain React, recomputed from the same pure functions so UI and canvas never diverge.
- **Quiz mechanic:** a shared `<QuizModule>` React wrapper renders the masked `PayoffScene`/`EventCandleScene`, the option buttons, and on submit calls `scene.reveal()` (drops the mask / snaps breakevens / pops the IV balloon), then grades against `payoffMath` ground truth and shows the explanation block (right + why-wrong). Identical flow to Lesson 1's quiz wrapper.
- **Progress bar:** segmented bar with **15 ticks** bound to `completedModules`; increments once per module completion event; re-renders from the persisted count so a reload restores the fill.
- **Streak:** track `currentSittingCount` in memory, incremented per completed module, reset on a session gap; persist `bestStreak = max(bestStreak, currentSittingCount)`. ("Most modules completed in one sitting.")
- **Dashboard resume:** Firestore `users/{uid}` → `{ progress: { lastCompletedModule, completedModules[] }, bestStreak, updatedAt }`. The dashboard "Resume" button jumps to `lessons/5/modules/{lastCompletedModule + 1}`. Per-lesson progress can be namespaced (e.g., `progress.byLesson["5"].lastCompletedModule`) so Lesson 5 resume is independent of Lessons 1–4.
- **Auth:** Firebase Google sign-in (existing platform shell on `feat/platform-shell`); the user doc is created on first login.
- **Responsive / relative coords:** every scene lays out in normalized [0,1] coordinates scaled to the container, so the V, the valley, breakeven lines, and the IV balloon read correctly on phone and desktop; font sizes and hit-areas use min/max clamps for touch.
- **Palette:** white background; **green** = up move / buy / long / profit zone; **red** = down move / sell / short / loss zone; **blue** = axes, strike & breakeven markers, captions, IV balloon outline. (Matches the Brilliant-style minimalist chrome used across the platform.)
- **No bundled candle JSON needed** for this lesson (unlike Lessons 1/3). All data is generated deterministically from the parameter sets in §6 via `payoffMath.ts`; the only static assets are the illustrative preset tables (e.g., module 14's presets), which can ship as a small JSON constants file.

---

## Congratulations screen (screen 16 — platform-handled, not a counted module)

After the capstone (module 15) fills the 15th progress segment, the platform shows the standard **Congratulations screen**:

- A celebratory headline — *"You finished Lesson 5: Straddles & Strangles."* — over a clean white panel with a subtle green confetti burst (Phaser particle one-shot).
- A **recap chip row** summarizing the big takeaways: **(1)** straddle = V, breakevens `K ± premium`; **(2)** strangle = flat-bottomed valley, breakevens `Kc + prem` / `Kp − prem`, cheaper but needs a bigger move; **(3)** used into earnings/binary events; **(4)** IV crush — *clear the breakeven, not just move*; plus the **short mirror** (collect premium, profit on quiet, large risk).
- The learner's **stats**: modules completed (15/15), **best streak this lesson**, and quiz accuracy.
- Buttons: **"Back to dashboard"** (writes final progress to Firestore and returns to the auth-gated dashboard) and **"Next lesson"** (if a subsequent lesson exists).
- This screen is **screen 16** and is **not** counted in the `/15` module denominator or the progress bar.
