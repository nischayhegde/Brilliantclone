# Lesson 3 — "Short Selling: Profiting When Stocks Fall"

> Borrow high, sell, buy back lower, return the shares. This lesson teaches the full short-sale lifecycle, the borrow costs (margin, daily stock-loan fee, owed dividends), the brutal payoff **asymmetry** (capped gain vs. theoretically unlimited loss), margin-call / forced buy-in / recall risk, and the short-squeeze feedback loop — anchored to real history (GameStop Jan 2021, Volkswagen Oct 2008) and at least one real *winning* short.
>
> **INTEGRITY NOTE.** This lesson mixes two clearly-labeled kinds of artifact:
> - **REAL-STOCK ANCHORS** — genuinely true historical events rendered from real Yahoo chart windows (`interval=1d`, explicit `period1`/`period2` unix). These are the price charts in Modules 2, 9, 11, 12, 13, 14, and the capstone scenario in Module 15. Round numbers (GME spiking toward **~$483** intraday on **2021-01-28**; VW briefly the world's most valuable company in **Oct 2008**) are real and stated as round anchors. The implementer fetches the exact candles from the URLs given; **no fabricated OHLC is presented as "verified."**
> - **ILLUSTRATIVE SIMULATIONS** — the borrow-fee math, margin/collateral gauges, account-equity erosion, the short-squeeze cascade dynamics, and all example premiums/rates are **deterministic illustrative simulations of correct mechanics and math**. They are labeled "illustrative simulation" wherever they appear and are never presented as a real market snapshot. The *math* in every simulation (P&L, net of costs, payoff, breakeven) is exactly correct.

---

## 1. How this document is organized

- **§2 Lesson structure** — the 15-module spine table (every module: idx · type · title · the one key idea it lands), how the lesson paces easiest → hardest, and how the segmented progress bar advances `completedModules / 15`.
- **§3 Module mechanics (mapped to PRD + platform)** — what each module *type* does: TEACH, INTERACTIVE, QUIZ (reusing Lesson 1's masked → answer → reveal → grade → explain mechanic exactly), and CAPSTONE/RECAP.
- **§4 Data sourcing & integrity method** — the Yahoo chart API approach for the real charts, the bundled JSON in `planning/data/`, two-pass verification, and an explicit statement of which figures are illustrative simulations.
- **§5 Pacing / parameter philosophy** — how concept order, price/fee/payoff choices, and chart timeframes were chosen so the shapes and math read clearly easiest → hardest.
- **§6 The modules (THE CORE)** — one subsection per module: type & title; instrument + timeframe/parameter context (real Yahoo window with URL & bundled filename, or "illustrative simulation" with the exact parameter set); a "What the learner sees" narrative; the ANIMATION; the INTERACTIVE element with live readouts; a markdown table of the exact levels/markers/values; a caption tying numbers to the lesson; and for QUIZ modules the masked question, options, correct answer, reveal, and a "why right / why wrong" explanation. All payoff / breakeven / net-of-cost math is exactly correct.
- **§7 PRD / platform traceability** — every PRD & platform requirement → where it is satisfied.
- **§8 Implementation notes** — the reusable Phaser scenes, how INTERACTIVE state is driven, the segmented progress bar, the streak counter, dashboard resume, the Firestore shape, responsive behavior, and palette.

---

## 2. Lesson structure

Lesson 3 is **15 modules**, ordered so intuition precedes mechanics, mechanics precede risk, and risk precedes the real history that makes the risk visceral:

| # | Type | Title | The one key idea it lands |
|---|---|---|---|
| 1 | INTRO | Betting Against a Stock | You can profit when a stock **falls** — sell shares you don't own yet, buy them back cheaper. |
| 2 | TEACH | The Short Lifecycle: Borrow, Sell, Cover, Return | Borrow (locate) → sell high → **buy to cover** lower → return shares; P&L = sell − cover per share. |
| 3 | INTERACTIVE | Borrow Fee & the Margin Account | Shorting needs a **margin** account; proceeds + extra margin are collateral; a daily **borrow fee** accrues and you owe **dividends**. |
| 4 | QUIZ | Did the Short Make Money? | **Net** P&L = (sell − cover)·shares − borrow fee − owed dividends; gross can be eaten by costs. |
| 5 | TEACH | The Asymmetry: Capped Gain, Unlimited Loss | Max gain capped at +100% (stock → 0); max loss **theoretically unlimited** (price → ∞). |
| 6 | QUIZ | Long vs Short: Which Risk Is Worse? | Long loss is capped at your stake; short loss is unbounded because price can rise without limit. |
| 7 | TEACH | Margin Calls & Forced Buy-In | Maintenance margin must hold; breaching it triggers a **margin call** then forced **buy-in**; lender **recall** can also force a cover. |
| 8 | TEACH | Anatomy of a Short Squeeze | Rising price forces shorts to buy → pushes price higher → forces more covering: a reflexive spike fueled by high **short interest** / **days-to-cover**. |
| 9 | TEACH | Case Study — GameStop, January 2021 | A real squeeze: GME spiked toward **~$483** intraday on 2021-01-28 as shorts were forced to cover. |
| 10 | QUIZ | Squeeze or Settle? Read the Setup | High short interest + low float + a bullish catalyst is squeeze fuel — the signal to *not* be short. |
| 11 | TEACH | Case Study — Volkswagen, October 2008 | A real losing short: a corner/squeeze briefly made VW the **world's most valuable company**; even pros got destroyed. |
| 12 | TEACH | A Short That Worked | A stock that genuinely fell hard rewards a disciplined short — sell high, cover low, pocket the decline net of borrow. |
| 13 | QUIZ | Will This Short Pay Off? | Transfer test on a masked **real** chart: does the short follow through (win) or reverse (lose)? |
| 14 | INTERACTIVE | Manage a Live Short | Put it together: enter, watch borrow accrue, set a stop/cover plan, survive (or not) an adverse path, margin call, recall. |
| 15 | CAPSTONE | Capstone & Recap: The Short Seller's Scorecard | Tie it all together — lifecycle, costs, asymmetry, margin/recall, squeeze — and grade a final short/pass decision. |

**Pacing (easiest → hardest).** Module 1 plants pure intuition (a needle that moves *opposite* a long) before any vocabulary. Modules 2–4 add the concrete lifecycle and the cost math, ending in a graded numeric quiz. Modules 5–6 introduce the conceptual heart — the asymmetric payoff — first as a teach, then a quiz that forces the learner to *feel* the unbounded tail. Modules 7–8 add the failure modes (margin/recall) and the mechanism (squeeze). Modules 9–11 are the real history that proves the danger; Module 12 restores balance with a real *winning* short; Module 13 makes the learner judge a fresh real chart. Module 14 is the full sandbox; Module 15 recaps and scores.

**Progress bar.** A segmented bar at the top has **15 ticks** bound to `completedModules / 15`. Each module ticks exactly one segment on completion (a TEACH on "Got it", an INTERACTIVE on "Continue", a QUIZ after the reveal+explanation is dismissed, the CAPSTONE after the final grade). The bar persists across sessions from Firestore.

**End of lesson.** Module 15 is the recap/capstone. After it, the platform shows the **Congratulations screen** (screen 16 — *not* a counted module), described in §8.

---

## 3. Module mechanics (mapped to PRD + platform)

**TEACH** (Modules 2, 5, 7, 8, 9, 11, 12). An animated concept draw-in followed by sequenced overlay annotations. Phaser draws the chart/diagram candle-by-candle or step-by-step, then blue annotation labels/lines fade in on a timeline. A persistent caption states the trade thesis / the one idea. A **"Got it"** button advances. (Lesson 1 TEACH analog: animated candle draw-in + overlay markers showing where to buy/sell.)

**INTERACTIVE** (Modules 1, 3, 14). A sandbox the learner manipulates with **live-updating readouts** and **no pass/fail** — exploration that builds intuition. The learner drags sliders / scrubs a timeline / places order levels; the Phaser scene recomputes derived values every frame and redraws meters, needles, and P&L lines. A **"Continue"** button advances once they've engaged.

**QUIZ** (Modules 4, 6, 10, 13). Reuses **Lesson 1's mechanic exactly**:
1. Show a **masked / partial state** (a chart revealed only to a split date, or a numeric setup with the answer hidden).
2. Pose a **Yes/No** or **A/B/C** question (framed as a trading decision).
3. On submit, **animate the REVEAL** (tween away the mask / draw the hidden candles / subtract the cost chips).
4. **GRADE** Right / Wrong against **ground truth** (the real revealed data, or the exact math).
5. Show a teaching **EXPLANATION**, including *why a tempting wrong answer is wrong*.
The correct answer for chart quizzes is **whatever the real data actually did** — never forced to a target.

**CAPSTONE / RECAP** (Module 15). A multi-step scored review: a summary reel replays the lesson's signature animations, then a final scenario asks the learner to decide **short / pass** and size it, grading the decision against the asymmetry + squeeze-fuel checklist and tallying their earlier trades into a "short seller's report card."

---

## 4. Data sourcing & integrity method

### Real charts (Modules 2, 9, 11, 12, 13, 14, 15 scenario) — ✅ fetched & verified (2026-06-23)
- **Source:** Yahoo Finance public chart API —
  `https://query2.finance.yahoo.com/v8/finance/chart/{TICKER}?period1={unixStart}&period2={unixEnd}&interval=1d`
  (requires a browser `User-Agent` header; returns real OHLC + timestamps; free, no key). Parse `chart.result[0].timestamp` + `indicators.quote[0].{open,high,low,close}`. Same approach as Lesson 1.
- **Bundled JSON:** each real chart is saved under `planning/data/` with the filename given in its module, so the app can load the identical candles offline (or re-fetch the same window/URL at build time — both yield the same verified candles).
- **Two-pass verification — DONE.** Every window below was fetched from its exact Yahoo URL, the anchor candles (entry, peak, cover, split-point resolution) located in the printed OHLC, and the labels re-checked against the candles. The confirmed prices/dates are now back-filled into each module table (no more `~approx` where the narrative quotes a number), and each module carries a `> Verification:` blockquote in Lesson-1 style.
- **Split-adjustment handling (important).** Yahoo's chart `quote` OHLC is **split-adjusted to today's share structure**, so windows that predate a later split do **not** read in the prices traders saw at the time. Two of our charts are affected; the bundled JSON has been converted to **true nominal (split-unadjusted)** prices so the chart shows the famous levels directly:
  - **GME** had a **4-for-1 forward split on 2022-07-22** → bundled prices = Yahoo × 4 (so the **$483.00** intraday peak on 2021-01-28 is visible, not the adjusted $120.75).
  - **LCID** had a **1-for-10 reverse split on 2025-09-02** → bundled prices = Yahoo ÷ 10 (so the real **$57.75** Nov-2021 high is visible, not the adjusted $577.50).
  - GME/LCID/PTON/HOOD/VW carry a `meta._nominalNote` flag in their bundled JSON documenting any conversion.
- **Two tickers were rejected for corrupted Yahoo data and replaced** (the no-fabricated-data rule cuts both ways — we will not bundle a "real" chart whose absolute prices are wrong):
  - **Carvana (CVNA)** → **replaced by Peloton (PTON)** for M12. Yahoo's CVNA series is mis-scaled by ~4.79× **with no split to explain it** (its 2021-08-10 ATH prints as $75.37 vs the documented **$360.98**), so its bundled candles would display fake prices. PTON's data is clean (ATH prints exactly **$171.09** on 2021-01-14) and its 2021→2022 collapse is an equally famous winning short.
  - **Bed Bath & Beyond (BBBY)** → **replaced by Robinhood (HOOD)** for M13. Yahoo's BBBY series is also off-scale (its 2021-01 peak prints $94.98 vs the documented ~$54). HOOD's data is clean (the 2021-08-04 spike prints exactly **$85.00** high / **$70.39** close) and the IPO-pop-then-fade is the same "failed spike keeps falling → short wins" lesson.
- **Genuinely-true anchors used (verified):** GME's parabolic squeeze to **$483.00 intraday on 2021-01-28** (close $193.60); Volkswagen's **late-October 2008** squeeze that briefly made it the world's most valuable company (Yahoo daily caps the peak at €635 on 2008-10-27 — see M11 note; the documented intraday print was ~€1,005 on 2008-10-28). These are real, widely-documented events.

### Illustrative simulations (Modules 1, 3, 4, 5, 6, 7, 8, 10 setup; the fee/margin overlays in 14)
- The **intro P&L needle** (M1), the **borrow-fee / collateral math** (M3), the **net-P&L quiz** (M4), the **payoff lines** (M5, M6), the **account-equity / margin-call gauge** (M7), the **squeeze cascade** (M8), and the **fee/margin overlays** layered on real price paths (M14) are **deterministic illustrative simulations of correct mechanics and math**.
- They carry real **qualitative** anchors: borrow rates are framed as "easy-to-borrow ~0.3%/yr vs. hard-to-borrow names that can run to double digits or higher"; squeeze fuel is framed by real GME-style numbers (short interest exceeding the float, days-to-cover > 5). No precise fabricated snapshot (e.g., "GME's borrow rate was exactly X% on date Y") is labeled "verified." Every example rate/premium is explicitly an **example**.
- All math inside the simulations — per-share P&L, net of borrow fee and dividends, payoff at any price, breakeven, days-to-cover = short interest ÷ avg daily volume — is **exactly correct** and recomputed live.

---

## 5. Pacing / parameter philosophy

- **Concept order** mirrors how a careful desk would onboard a new short seller: *intuition (M1) → mechanics (M2) → cost of carry (M3–4) → the defining risk (M5–6) → how you actually blow up (M7–8) → proof from history (M9–11) → the disciplined win (M12) → judge it yourself (M13) → run it live (M14) → score it (M15).* Risk is taught **before** the alluring real case studies so the GME chart lands as a warning, not a temptation.
- **Round, legible numbers in simulations.** The lifecycle and quiz use clean figures (short 100 sh at $50, cover at $44; borrow $0.50/sh total; $0.20/sh dividend) so the arithmetic is checkable in the learner's head and the *method* is unmistakable. The asymmetry payoff uses entry $30 and a triple to $90 so "+100% ceiling vs. −200% and counting" reads instantly.
- **Chart timeframes** for the real anchors are chosen at `interval=1d` with windows ~1.3× the event so there is lead-in context plus the full resolution: GME Nov-2020→Mar-2021 captures the quiet heavily-shorted base **and** the parabolic spike; VW Aug-2008→Jan-2009 captures the spike-and-collapse; the winning-short windows capture the breakdown, the decline, and a cover point. Split points in the quizzes sit exactly where the setup is recognizable but unresolved.
- **Asymmetry is the spine.** Every later module re-references the capped-gain / unlimited-loss rule (the squeeze is *how* the unlimited tail gets realized; the margin call is *when*; VW is *who it happened to*), so the single most important idea is reinforced five times in different guises.

---

## 6. The modules (THE CORE)

---

### Module 1 — INTRO · "Betting Against a Stock"
- **Type / instrument:** INTRO / INTERACTIVE · **illustrative simulation** (a stylized price line + a P&L needle; no real ticker — intuition before mechanics).
- **Learning goal:** Plant the core intuition — you can profit when a stock **falls** by *selling first and buying back later* — before any vocabulary.
- **What the learner sees:** A familiar maxim, "**Buy low, sell high**," sits on a rising green arrow. The arrow flips upside-down and rewrites itself to "**Sell high, buy low**." Below, a stylized price line and a large **profit meter**. As the price line falls, the meter fills green; as it rises, the meter drains red — the *opposite* of what a long position would do.
- **Animation (Phaser, `IntroFlipScene`):**
  1. (0–0.6 s) Green up-arrow with "Buy low, sell high" draws left→right (ease-out).
  2. (0.6–1.2 s) The arrow rotates 180° about its center; the words crossfade to "Sell high, buy low" (the words *high* and *low* swap positions with a quick tween).
  3. (1.2–2.0 s) A 30-candle red-tilted price line draws in; a vertical "**Profit**" meter on the right fills bottom-up in green, synced so a falling line = rising meter.
  4. A persistent blue caption: "A short seller wins when the price goes **down**."
- **Interactive element:** A single horizontal **"future price" slider** (or draggable end-point on the line). Dragging the future price **down** raises the green profit needle and prints "+$" gains; dragging it **up** pushes the needle into red and prints "−$" losses. A small toggle "Show a LONG instead" mirrors the needle so the learner sees the two move in exact opposition. **Edge cases:** at the far-left (price → $0) the needle hits a soft cap labeled "+100% (stock can't go below $0)"; dragging far right keeps the loss needle growing with no floor and a faint "…no ceiling" hint — foreshadowing M5. Live readouts: *Entry $50 · Future price $X · Short P&L per share = 50 − X.*
- **Markers / values to draw (illustrative):**

  | Element | Value |
  |---|---|
  | Reference entry (sell) price | $50.00 |
  | Future price range (slider) | $0 → $100 |
  | Short P&L per share | 50 − (future price) |
  | Green ceiling label | +$50/sh (+100%) at price $0 |
  | Red (no floor) | grows past −$50 as price > $100 |

- **Caption:** "Flip your instinct: a short's profit per share is **sell price − future price**. Drag the price down and you win; drag it up and — notice — the loss just keeps going."

---

### Module 2 — TEACH · "The Short Lifecycle: Borrow, Sell, Cover, Return"
- **Type / instrument:** TEACH · **REAL chart** — a stock that fell hard. **Lucid Group (LCID)**, `1d`, **2021-10-01 → 2022-03-15** (post-SPAC peak of **$57.75** collapsing to **~$21** — a clean, well-known decline ideal for a textbook short).
  - **Data:** `https://query2.finance.yahoo.com/v8/finance/chart/LCID?period1=1633046400&period2=1647302400&interval=1d`
  - **Bundled:** `data/short_lifecycle_LCID.json` ✅ verified
  - ⚠️ **Split note:** LCID did a **1-for-10 reverse split on 2025-09-02**, so Yahoo's split-adjusted quote shows ~10× these prices (e.g. $577.50 for the peak). The bundled JSON has been converted to **true nominal (÷10)** so the chart reads in the prices traders actually saw ($57.75 high). Verified anchors below are nominal.
- **Learning goal:** Walk the four-step lifecycle and the P&L formula: **borrow (locate) → sell now at a high price → later BUY TO COVER at a lower price → return the borrowed shares.** Profit = **sell price − buy-back price** per share.
- **What the learner sees:** A 4-step conveyor over the real LCID chart. (1) A **lender** hands over share tokens ("locate / borrow"). (2) The learner **sells** them at the high (**$57.75**, the 2021-11-17 peak) for cash. (3) Time passes; the chart **falls** through winter. (4) The learner **buys to cover** cheaper (**$21.31**, the 2022-03-14 low) and **returns** the borrowed tokens to the lender; the leftover cash is the profit.
- **Animation (Phaser, `ShortLifecycleScene` over `CandleChart`):**
  1. Real LCID candles draw in left→right (green up / red down) as the backdrop.
  2. Step 1 (lender → you): a lender icon slides 100 blue "share" tokens into the learner's tray; label "**Borrow / locate**."
  3. Step 2 (sell): tokens convert to a green cash stack at the marked sell candle; a red **SELL** marker drops at **$57.75** (2021-11-17).
  4. Step 3 (wait): a clock sweeps; the candles already drawn dim except the falling segment, which pulses.
  5. Step 4 (cover + return): at the marked cover candle a smaller green cash stack is spent to buy tokens back (a **COVER** marker at **$21.31**, 2022-03-14), tokens fly back to the lender, and the **leftover cash** stack is highlighted as **Profit**.
  6. Blue caption ties it together with the formula.
- **Interactive element:** The learner **scrubs / clicks through** the four steps and can **drag the SELL marker and the COVER marker** to any two candles on the real chart. The per-share P&L readout updates live: **P&L/sh = (sell − cover)**, and total = P&L/sh × 100 shares. **Edge case:** if they drag COVER *above* SELL (a price that rose), the profit stack turns red and the readout shows a loss — a gentle preview that shorts can lose. Live readouts: *Sell $S · Cover $C · Per-share = S − C · 100 sh = (S − C)·100.*
- **Markers / values to draw (real-window anchors; round):**

  | Step | Marker | Verified nominal price |
  |---|---|---|
  | Borrow | lender hands 100 shares | — |
  | **Sell (entry)** | red SELL on the post-peak high | **$57.75** (2021-11-17) |
  | Wait | decline through winter 2021→2022 | — |
  | **Cover (exit)** | green COVER on the spring low | **$21.31** (2022-03-14) |
  | Return | shares back to lender | — |
  | Profit / share | (sell − cover) | **$36.44/sh** |
  | Total (100 sh) | (sell − cover)·100 | **$3,644** |

- **Caption:** "Borrow → **sell high ($57.75)** → wait as it falls → **buy to cover low ($21.31)** → return the shares. You keep the difference: **$36.44/share × 100 = $3,644** (before borrow costs — those come next)."

> *Verification: pass — LCID `1d` 2021-10-01→2022-03-14 re-fetched from Yahoo. Window peak high **$57.75 on 2021-11-17** and window-end low **$21.31 on 2022-03-14** confirmed against the candles (gross $36.44/sh). Prices shown are **true nominal**: Yahoo's split-adjusted series reads ~10× higher ($577.50 / $213.14) because of LCID's 1-for-10 reverse split on 2025-09-02 — the bundled JSON divides by 10 so the chart shows the real 2021-22 prices. LCID's $57.75 high matches the widely-documented Lucid all-time high.*

---

### Module 3 — INTERACTIVE · "Borrow Fee & the Margin Account"
- **Type / instrument:** INTERACTIVE · **illustrative simulation** (fee math exact; example rates labeled illustrative).
- **Learning goal:** Shorting requires a **margin account**; the **sale proceeds + extra margin act as collateral**. A **daily borrow fee** (stock-loan rate) accrues — higher for hard-to-borrow names — and the short seller **owes the lender any dividends**.
- **What the learner sees:** A **collateral gauge** fills from the sale proceeds plus a margin top-up (broker requirement). A **daily ticking meter** nibbles the borrow fee each day. A calendar shows an **ex-dividend date**; when it passes, a "**you owe the lender**" chip deducts the dividend from the account.
- **Animation (Phaser, `BorrowFeeScene`):**
  1. A green "Sale proceeds" bar ($5,000) fills the collateral gauge and stays locked; a blue "+50% extra margin" segment ($2,500) stacks on top, and a brace spans **both** segments labeled "Collateral the broker holds (≈150% of proceeds = $7,500)" — making it explicit that the proceeds are **not** free cash and the extra margin is posted *on top* of them.
  2. A days dial spins; each day a thin red sliver is shaved off an "Account" bar (the borrow fee), with a running "Borrow cost so far" counter.
  3. A dividend date flag pops; a red chip labeled "Dividend owed to lender" subtracts.
  4. A blue summary line resolves: **Net = Gross short P&L − (fee × days) − dividends owed.**
- **Interactive element:** Three controls — (a) a **borrow-rate slider** with two snap presets: **Easy-to-borrow ≈ 0.3%/yr** and **Hard-to-borrow ≈ 30%/yr** (free-drag in between; rates labeled "example"); (b) a **holding-days slider** (1–90); (c) a **dividend toggle** (off / $0.20 per share). The scene recomputes every frame: it shows the **daily fee**, the **cumulative fee**, the **dividend owed**, and subtracts both from a fixed gross short P&L to display **NET**. **Edge case:** crank rate to 30%/yr and days to 90 on a high-priced borrow and the fee can exceed the gross profit — the NET goes red, teaching that carry can sink an otherwise-right short. Live readouts below.
- **Fee math (exact; illustrative inputs).** Borrow fee per day = `position market value × annualRate / 365`. Example with 100 sh shorted at $50 (market value $5,000):

  | Input | Easy-to-borrow | Hard-to-borrow |
  |---|---|---|
  | Annual borrow rate (example) | 0.30% | 30% |
  | Daily fee = 5000 × rate / 365 | ≈ $0.041/day | ≈ $4.11/day |
  | Over 30 days | ≈ $1.23 | ≈ $123.29 |
  | Dividend owed (if 1 div × $0.20 × 100 sh) | $20.00 | $20.00 |
  | Extra margin posted (Reg-T initial, +50% of proceeds; **proceeds also held**) | +$2,500 (total collateral $7,500 = $5,000 proceeds + $2,500) | +$2,500 (total collateral $7,500 = $5,000 proceeds + $2,500) |

- **Caption:** "Your sale cash isn't free money — the broker **holds it plus extra margin as collateral**, charges a **daily borrow fee** (tiny for easy names, brutal for hard-to-borrow ones), and bills you for **any dividends** the lender misses. These costs come out of your gross profit."

---

### Module 4 — QUIZ · "Did the Short Make Money?"
- **Type / instrument:** QUIZ (A/B/C) · **illustrative simulation** (math exact).
- **Learning goal:** **Net short P&L = (sell − cover) × shares − borrow fee − owed dividends**; gross profit can be eaten by costs.
- **Masked setup shown:** The numbers are given; the **net figure is hidden** behind a masked panel. *"You short **100 shares at $50** and **cover at $44**, holding **30 days**. Total borrow cost over those days = **$0.50/share** ($50). You owed **$0.20/share** in dividends ($20). What was your **NET** profit?"*
- **Question:** "Pick the correct **net** profit."
- **Options:**
  - **A) $600** — gross only, ignoring costs *(tempting trap)*
  - **B) $530** — gross minus borrow minus dividend *(correct)*
  - **C) $480** — over-subtracts (double-counts a cost)
- **Correct answer:** **B) $530.**
- **Reveal animation:** On submit, the **gross P&L bar** draws to **$600** (= (50 − 44) × 100). Then a red "**Borrow −$50**" chip slides in and subtracts; then a red "**Dividend −$20**" chip subtracts; the bar lands on **$530**, and the masked net figure unveils to match.
- **Why right / why wrong:**
  - **B ($530) is right:** Gross = (50 − 44) × 100 = **$600**. Borrow cost = $0.50/sh × 100 = **$50**. Dividend owed = $0.20/sh × 100 = **$20**. Net = 600 − 50 − 20 = **$530**.
  - **A ($600) is the tempting trap:** it's the gross — it *ignores the cost of the borrow*. The whole point of M3 is that the borrow fee and owed dividends are **real cash you pay**, so the headline (sell − cover) overstates the win.
  - **C ($480)** subtracts too much (e.g., counting the borrow twice or treating the dividend as $0.70/sh) — a reminder to subtract **each** cost exactly once.
- **Caption:** "A short can be 'right' on direction and still lag — borrow fees and owed dividends turn a **$600** gross into a **$530** net. Always trade the **net**."

---

### Module 5 — TEACH · "The Asymmetry: Capped Gain, Unlimited Loss"
- **Type / instrument:** TEACH · **illustrative simulation** (payoff math exact).
- **Learning goal:** The central lesson — a short's **max gain is capped** (the stock can only fall to $0, = **+100%**) while its **max loss is theoretically unlimited** (price can rise without bound). The long position is the **mirror**: loss capped, gain unlimited.
- **What the learner sees:** A payoff diagram with **future price on the x-axis** and **P&L on the y-axis**. The **short** payoff line is drawn: it **flattens to a hard ceiling at +100%** as price → $0, and **climbs steeply into negative territory without bound** as price rises. The **long** payoff is drawn mirrored across the axis for contrast — its loss floors at −100% (price $0) while its gain rises without limit.
- **Animation (Phaser, `PayoffScene`):**
  1. Axes draw; entry price $30 marked with a blue vertical line (the breakeven, where P&L = 0).
  2. The **short** line (red) sweeps left→right: from the left it presses up against a green dashed "**+100% ceiling**" at price $0; through breakeven $30 it's zero; to the right it dives below zero and **keeps going**, the tail extending off the panel edge with a small "↓ no floor" arrow.
  3. The **long** line (green) sweeps in mirrored: floored at a red dashed "**−100%**" at price $0, rising without limit to the right with an "↑ no ceiling" arrow.
  4. Blue callouts: "Short: gain capped at +100%, loss **unlimited**." / "Long: loss capped at −100%, gain **unlimited**."
- **Interactive element:** The learner **drags the future price** along the x-axis. To the **left** it hits the **hard +100% ceiling at $0** (the needle can't exceed it). To the **right** the **loss keeps growing past −100%, −200%, −300%** with **no stop**, viscerally showing the unbounded downside. A toggle overlays the long line so they can compare at the same price. Live readout: *Future price $X · Short P&L% = (30 − X)/30 · Long P&L% = (X − 30)/30.*
- **Payoff values to draw (short, entry $30; illustrative):**

  | Future price | Short P&L per share | Short P&L % | Note |
  |---|---|---|---|
  | $0 | +$30 | **+100%** (ceiling) | stock can't go lower |
  | $15 | +$15 | +50% | |
  | $30 | $0 | 0% | breakeven (entry) |
  | $60 | −$30 | −100% | a loss equal to your entry price per share |
  | $90 | −$60 | −200% | and still climbing |
  | $120 | −$90 | −300% | **no ceiling** |

  > **Note on the "%":** here P&L% is expressed as a percent of the **entry price per share** (`Short P&L% = (entry − price)/entry`), parallel to the long line, so the two payoffs read as mirror images. A short's true capital at risk is the **posted margin**, not the entry notional — so "−100%" means *a loss equal to 100% of the entry price per share*, **not** "you lost 100% of your margin." The point the diagram makes is unchanged: the gain stops at +100% while the loss has **no floor**.

- **Caption:** "This is *the* reason shorting is dangerous: the best case is the stock goes to zero (**+100%, and that's all**), but the worst case has **no limit** — a stock can double, triple, 10×, and your loss grows right with it."

---

### Module 6 — QUIZ · "Long vs Short: Which Risk Is Worse?"
- **Type / instrument:** QUIZ (A/B) · **illustrative simulation** (math exact).
- **Learning goal:** Going long risks at most your stake (price floors at $0); shorting risks **more than your stake** because price can rise unboundedly.
- **Masked setup shown:** *"You will take **one** position on the same stock at **$30 × 100 shares**: either **LONG** or **SHORT**. The stock then **triples to $90**. Which position suffers the larger loss — and which side has theoretically **unlimited** downside?"* (Both payoff tails are hidden until answer.)
- **Question:** "Which is the worse position here, and which has unlimited downside?"
- **Options:**
  - **A) The LONG — longs can lose everything, so the long is worse and unbounded.** *(tempting trap)*
  - **B) The SHORT — it loses $6,000 here, and the short has theoretically unlimited downside.** *(correct)*
- **Correct answer:** **B) The SHORT.**
- **Reveal animation:** Both payoff lines animate. The **long-loss floor stops at −100%** (a red dashed line: a long at $30 only *loses* if price falls, and even at $0 the loss floors at −$3,000; here, with price rising to $90, the long actually *gains* $6,000). The **short-loss tail** extends off-screen past −$6,000 with a flashing "**no ceiling**" warning. The numeric P&Ls print: **Long P&L = +$6,000**, **Short P&L = −$6,000 (and growing if it rises further)**.
- **Why right / why wrong:**
  - **B is right:** With the stock tripling to $90, the **short** loses **(90 − 30) × 100 = $6,000** and would keep losing if price rose further — its downside is **unbounded** because there is no upper limit on price. The long here actually *profits* $6,000; a long only loses if price *falls*, and that loss is **capped** at the **$3,000** paid (price can't go below $0).
  - **A is the tempting trap:** it confuses "you can lose your whole investment" (true of a long, but **capped** at the stake) with "unlimited loss." The long's max loss is the finite $3,000 you put in; the short's loss has **no cap at all**. Losing everything ≠ losing without limit.
- **Caption:** "A long's worst case is **−100%** (you lose what you put in). A short's worst case is **−∞** (price can rise forever). Same stock, opposite risk shapes — that asymmetry is why shorts demand a stop."

---

### Module 7 — TEACH · "Margin Calls & Forced Buy-In"
- **Type / instrument:** TEACH · **illustrative simulation** for the account gauge; the adverse **price path may reuse a real squeeze window** (GME Jan-2021, see M9 data) as the backdrop.
- **Learning goal:** Maintenance margin must be kept; if the position moves against you the broker issues a **MARGIN CALL**, and failing it triggers a forced **BUY-IN / liquidation**. **Recall risk:** the lender can demand the shares back at any time, also forcing a cover.
- **What the learner sees:** As price **rises**, an **equity-vs-maintenance gauge erodes**. It crosses a red **maintenance line**; a "**MARGIN CALL**" banner flashes. If unmet, an **auto buy-in candle** covers the short at the worst moment. A separate "**lender recall**" alert can also force a cover even when margin is fine.
- **Animation (Phaser, `MarginGaugeScene` over the real price path):**
  1. A rising (red) price path advances day-by-day; alongside it an "**Equity**" bar shrinks as unrealized loss grows, with a red dashed "**Maintenance margin**" line.
  2. When equity crosses below maintenance, the gauge flashes and a yellow "**MARGIN CALL**" banner slides in: "Add cash or cover."
  3. If the call is unmet for the demo's grace window, a bold red "**FORCED BUY-IN**" candle marks an automatic cover at the (bad) market price; realized loss locks in.
  4. A separate scripted "**Lender recall**" toast appears on a different day, forcing a cover regardless of margin — blue caption: "You don't fully control the exit."
- **Interactive element:** The learner **sets starting account equity** (a slider) and **watches an adverse price path** advance. At the margin-call moment they choose one of three buttons: **Add cash** (gauge refills, position survives, but capital is committed), **Cover early** (lock a smaller loss now), or **Do nothing** (the path continues and triggers the **forced buy-in** at the market — the worst outcome). Live readouts: *Price $X · Unrealized P&L · Equity $E · Maintenance $M · Margin = E/M.* **Edge case:** set equity very low and even a small adverse move triggers an immediate call — showing how leverage shortens your runway.
- **Gauge values (illustrative; mechanics exact):**

  | Item | Example value |
  |---|---|
  | Short proceeds (100 sh @ $30) | $3,000 |
  | Initial margin (Reg-T, +50%) | $1,500 of your cash |
  | Maintenance requirement (e.g., 30% of current value) | 0.30 × (current price × 100) |
  | Margin call triggers when | equity < maintenance |
  | Forced buy-in | broker covers at market if call unmet |
  | Recall | lender demands shares → forced cover anytime |

- **Caption:** "Rising price drains your equity toward the **maintenance line**. Cross it and the broker **calls** you; ignore the call and it **buys you in** at the market — usually the worst price. And a **recall** can force you out even when your margin is fine. The exit isn't entirely yours."

---

### Module 8 — TEACH · "Anatomy of a Short Squeeze"
- **Type / instrument:** TEACH · **illustrative simulation** of the feedback loop (framed by the real anchors in M9 / M11).
- **Learning goal:** A rising price forces shorts to **cover (buy)**, which pushes price **higher**, forcing **more covering** — a reflexive spike. High **SHORT INTEREST** and **DAYS-TO-COVER** are the fuel.
- **What the learner sees:** A **feedback-loop diagram** comes alive: **price up → margin pressure → shorts buy to cover → more buying → price up again**, drawn as an accelerating spiral. A **short-interest bar** and a **days-to-cover dial** show how much fuel is loaded.
- **Animation (Phaser, `SqueezeLoopScene`):**
  1. Four nodes arranged in a ring: "Price ↑", "Margin pressure", "Shorts buy to cover", "More buying." A blue arrow travels the ring.
  2. Each lap the arrow travels **faster** and the "Price ↑" node's bar jumps **higher** (the spiral tightens), illustrating reflexivity.
  3. A "**Short interest**" bar (left) and a "**Days-to-cover**" dial (right) sit beside the ring; both are shown high.
  4. Blue caption defines days-to-cover and why it matters.
- **Interactive element:** Two controls — a "**short interest %**" slider (10% → 140%+ of float) and an "**available float**" slider (large → tiny). The learner sets them, then **nudges price up once** with a button. The simulation runs the covering cascade: the higher the short interest and the smaller the float, the **more violent** the resulting spike (more laps, taller bars, faster arrow). Live readouts: *Short interest = SI% · Float = F shares · Avg daily volume = V · **Days-to-cover = (SI% × F) / V** · Simulated peak move = +Z%.* **Edge case:** SI > 100% of float (as in GME) makes the cascade explode — there are literally more shares sold short than exist to easily buy back.
- **Days-to-cover formula (exact):** `daysToCover = sharesShort / averageDailyVolume`. Illustrative example: 50M shares short ÷ 8M avg daily volume = **6.25 days** to cover — high, meaning shorts can't exit quickly, so any up-move snowballs.
- **Markers / values (illustrative):**

  | Lever | Low-fuel setup | High-fuel (GME-style) |
  |---|---|---|
  | Short interest (% of float) | 10% | **140%** |
  | Float | large | **small** |
  | Days-to-cover | ~1 | **> 5** |
  | Simulated spike on a nudge | mild | **parabolic** |

- **Caption:** "A squeeze is a **feedback loop**: shorts *must* buy to cover, and their buying is the very thing that drives price higher, forcing still more covering. **High short interest + low float + high days-to-cover** = a loaded spring."

---

### Module 9 — TEACH · "Case Study — GameStop, January 2021"
- **Type / instrument:** TEACH · **REAL chart**. **GameStop (GME)**, `1d`, **2020-11-01 → 2021-03-01**.
  - **Data:** `https://query2.finance.yahoo.com/v8/finance/chart/GME?period1=1604188800&period2=1614556800&interval=1d`
  - **Bundled:** `data/gme_squeeze_2021.json` ✅ verified
  - ⚠️ **Split note (handled):** GME did a **4-for-1 forward split on 2022-07-22**, so Yahoo's split-adjusted quote shows ¼ of the famous prices (the peak reads $120.75). The bundled JSON has been converted to **true nominal (×4)** so the chart shows the iconic **$483.00** intraday peak on 2021-01-28 directly.
- **Learning goal:** A real squeeze in action — GME, heavily shorted with very high short interest, spiked toward **~$483 intraday on 2021-01-28** as shorts were forced to cover: a textbook reflexive squeeze that crushed short sellers.
- **What the learner sees:** The real GME daily chart draws candle-by-candle through Nov-2020 → Feb-2021. Annotations mark the quiet **heavily-shorted base** (single digits to low-teens through late 2020), the **ignition** (mid-to-late January), and the **parabolic spike toward ~$483**. A short-seller's **P&L line plunges** as price rockets.
- **Animation (Phaser, `CandleChart` + `SqueezeAnnotateScene`):**
  1. Candles draw left→right; the long flat base is dimmed.
  2. A blue bracket labels the base: "**Heavily shorted** — short interest reportedly exceeded the float."
  3. The ignition candles (mid-Jan) pulse; a blue "**Ignition**" tag appears.
  4. The late-Jan candles draw near-vertically; a red "**~$483 intraday (2021-01-28)**" callout pins the peak.
  5. A red **short P&L line** (for a hypothetical short placed at the base) is overlaid plunging deeper as price climbs, ending with a "**margin call / forced cover**" marker.
- **Interactive element:** The learner **places a hypothetical short** at a pre-spike level (drag an entry marker onto a base candle, e.g., ~$20), then **scrubs forward day by day**. The **mounting loss** is annotated live ((entry − current) × shares, going sharply negative), and a **margin-call trigger point** lights up where the loss would have breached maintenance. Live readouts: *Entry $E · Current $X · Loss = (E − X)·100 · Peak loss at ~$483 ≈ (E − 483)·100.* **Edge case:** scrubbing to the 2021-01-28 peak shows a catastrophic per-100-share loss — entry $20 → loss ≈ (20 − 483) × 100 = **−$46,300** on a $2,000 short — the unlimited-loss tail from M5 made real.
- **Real anchors to draw (verify exact on fetch; round):**

  | Marker | Date | Verified nominal price |
  |---|---|---|
  | Heavily-shorted base | Nov–Dec 2020 | **$10.50–$22.35** |
  | Ignition | ~mid-Jan 2021 | ~$30–$40 → rising |
  | **Parabolic peak (intraday)** | **2021-01-28** | **$483.00** (close $193.60) |
  | Hypothetical short entry (interactive) | learner-placed | ~$20 |

- **Caption:** "GME was the spring from Module 8 fully loaded — short interest reportedly **over 100% of the float**. When it ignited, shorts *had* to cover into a stock that barely existed to buy, and it ran to **$483.00 intraday**. A short placed near the base didn't just lose 100% — it lost multiples of the stake."

> *Verification: pass — GME `1d` 2020-11-02→2021-02-26 re-fetched from Yahoo. The Nov–Dec 2020 base ranges **$10.50–$22.35** and the all-time intraday peak is **$483.00 on 2021-01-28** (that day's close $193.60 — a huge red rejection wick), exactly matching the widely-documented squeeze. Prices are **true nominal**: Yahoo's split-adjusted series reads ¼ of these ($120.75 peak) because of the 4-for-1 split on 2022-07-22; the bundled JSON multiplies by 4. A hypothetical short from the ~$20 base to the $483 peak loses ≈(20−483)×100 = **−$46,300** per 100 shares — the unlimited-loss tail made literal.*

---

### Module 10 — QUIZ · "Squeeze or Settle? Read the Setup"
- **Type / instrument:** QUIZ (Yes/No) · **REAL squeeze anchor** (GME-style); the reveal uses the real GME chart window from M9.
- **Learning goal:** High short interest + low float + an upward catalyst is **squeeze fuel** — recognizing it tells a short seller when **not** to be short.
- **Masked setup shown:** A split-point chart (GME-style) is shown to just before ignition, with a **stats panel**: *"Short interest ≈ **140% of float** · Days-to-cover **> 5** · **Low float** · Retail buying is **surging** (bullish catalyst). **You are short here.** Does price **squeeze sharply higher** from here?"* The right half of the chart is masked.
- **Question (Yes/No):** "Will this squeeze higher?"
- **Options:**
  - **YES — it squeezes sharply higher; this is loaded squeeze fuel.** *(correct)*
  - **NO — it will drift lower because it's overvalued.** *(tempting trap)*
- **Correct answer:** **YES — it squeezes.**
- **Reveal animation:** The masked right half tweens away to reveal the **parabolic squeeze** (the real GME late-January run toward ~$483). A "**will drift lower**" (No) pick triggers the **short-loss tail exploding** downward in red with a margin-call flash; the "**squeeze higher**" (Yes) pick shows the price spike with a green "correct" check and the short P&L plunging.
- **Why right / why wrong:**
  - **YES is right:** When short interest **exceeds the available float** and days-to-cover is high, **forced covering must buy more shares than easily exist** — so any up-move snowballs into a squeeze. This is exactly the GME dynamic. The bullish catalyst + low float lights the fuse.
  - **NO ("it'll drift lower") is the tempting trap:** a short seller *wants* it to fall and may anchor on "it's overvalued, it must drop." But valuation doesn't matter in the short term when the **mechanics force buying**. Staying short into that fuel is precisely **how the unlimited-loss tail (M5) gets realized** — the position can be right on fundamentals and still be obliterated.
- **Caption:** "When more shares are sold short than exist to buy back, the exit door is too small for the crowd. **That setup is when a smart short steps aside** — being 'right' on value won't save you from the squeeze."

---

### Module 11 — TEACH · "Case Study — Volkswagen, October 2008"
- **Type / instrument:** TEACH · **REAL event / chart**. **Volkswagen** ordinary shares (`VOW.DE` — this is the squeezed line; **do not** use `VOW3.DE`, the preferred shares, which tracked a different, much lower path and were checked & rejected), `1d`, **2008-08-01 → 2009-01-15**.
  - **Data:** `https://query2.finance.yahoo.com/v8/finance/chart/VOW.DE?period1=1217548800&period2=1231977600&interval=1d`
  - **Bundled:** `data/vw_squeeze_2008.json` ✅ verified (VOW.DE; no split)
  - ⚠️ **Daily-vs-intraday note:** Yahoo's `VOW.DE` daily series is real and loads cleanly (base low €192.30 on 2008-08-04 → daily-high peak **€635.00 on 2008-10-27**, a 3.3× ramp, then collapsing back to ~€238 by mid-Jan 2009). But the famous **intraday** print of **~€1,005 on 2008-10-28** (when VW briefly became the world's most valuable company) does **not** appear in the daily high — Yahoo's daily candle for that era caps lower. So render this as a **real-event illustration**: the bundled daily candles are genuine (use them for the spike-and-collapse shape), and a labeled callout cites the documented ~€1,005 intraday figure. Do **not** fabricate a €1,005 candle.
- **Learning goal:** A real **losing** short: even "sophisticated" shorts can be destroyed. Hedge funds short VW were caught when Porsche's stake plus options left almost no free float; the scramble to cover briefly made VW the most valuable company on earth before the squeeze unwound.
- **What the learner sees:** VW's late-2008 price **spike** draws in, with a blue callout "**Briefly the world's most valuable company**." A **market-cap balloon** inflates past peer companies, then **deflates** as the squeeze unwinds and price collapses back.
- **Animation (Phaser, `CandleChart` + `MarketCapBalloonScene`):**
  1. Real VW candles draw in; the sudden late-October near-vertical spike is emphasized.
  2. A "**Free float almost gone**" blue annotation explains the corner (Porsche stake + options left little tradable stock).
  3. A market-cap balloon labeled "VW" inflates and floats **above** labeled peer balloons (a "world's most valuable company" tag), then **deflates** as the price collapses in the following sessions.
  4. A red short-seller P&L marker spikes negative at the peak, then partially recovers as price falls — but "**too late for those forced to cover at the top**."
- **Interactive element:** The learner toggles **VW (2008)** and **GME (2021)** on a **shared time-normalized x-axis** (both re-based to day 0 = pre-ignition, y = % from base). Toggling each on/off overlays the two **spike-and-collapse signatures** so the learner sees the **common squeeze shape across eras and continents**. Live readout: *% above base at peak (VW) vs. (GME); both > +X00%.*
- **Real anchors (round; verify/label on fetch):**

  | Marker | When | Verified value (VOW.DE daily) |
  |---|---|---|
  | Quiet base / building short interest | Aug–Oct 2008 | low **€192.30** (2008-08-04); hedge funds short VW |
  | Free float squeezed | late Oct 2008 | Porsche stake + options leave little tradable stock |
  | **Parabolic peak (daily high)** | **2008-10-27** | **€635.00** (3.3× the base); documented intraday ~**€1,005** on 2008-10-28 |
  | Collapse / unwind | Nov 2008 → Jan 2009 | falls back to **€238.10** by 2009-01-14 |

- **Caption:** "VW is GME thirteen years earlier: a heavily-shorted stock with **almost no free float**, a forced scramble to cover, and a spike so extreme it briefly made VW **the most valuable company in the world** — wiping out professional shorts. The squeeze signature is the same across eras."

> *Verification: pass (with caveat) — VOW.DE `1d` 2008-08-01→2009-01-14 re-fetched from Yahoo. Base low **€192.30 (2008-08-04)**, daily-high peak **€635.00 (2008-10-27)**, post-squeeze low **€238.10 (2009-01-14)** all confirmed against the candles; no split affects the window. Caveat: Yahoo's daily high (€635) understates the documented **intraday ~€1,005 (2008-10-28)** peak, so M11 is framed as a real-event illustration using the genuine daily candles plus a cited intraday figure — never a fabricated candle. (VOW3.DE preferred shares were checked and rejected: they track a different, lower line — €112 peak — and are not the squeezed ordinary shares.)*

---

### Module 12 — TEACH · "A Short That Worked"
- **Type / instrument:** TEACH · **REAL chart** — a stock that genuinely fell hard. **Peloton (PTON)**, `1d`, **2021-11-01 → 2022-12-30** (the pandemic-darling collapse: from the low-$90s to a **$6.66** low — a famous, clean, successful short).
  - **Data:** `https://query2.finance.yahoo.com/v8/finance/chart/PTON?period1=1635724800&period2=1672444800&interval=1d`
  - **Bundled:** `data/short_winner_PTON.json` ✅ verified (no split; data is true nominal)
  - *Why PTON, not Carvana: Yahoo's CVNA series is mis-scaled by ~4.79× with no split to explain it (see §4), so its candles would display fake prices. PTON's data is clean — its ATH prints exactly $171.09 (2021-01-14) — and its decline is an equally iconic winning short.*
- **Learning goal:** The other side of the ledger — a stock that truly fell rewards a **disciplined** short: sell high, cover low, pocket the decline **net of borrow costs**. Exit discipline matters: cover too early and you leave profit on the table; cover too late and a bounce can erase gains.
- **What the learner sees:** A real **down-trending** PTON chart draws in (it enters the window at a **$92.95** high on 2021-11-01, gaps down ~35% on the Nov-4 earnings miss, and grinds lower all year). The **short entry** (~$50, shorting the November breakdown), the **falling price**, the **buy-to-cover** (~$8, near the **$6.66** Oct-2022 low), and the **net profit (after borrow fee)** are annotated as one clean, successful trade.
- **Animation (Phaser, `CandleChart` + `WinningShortScene`):**
  1. Real candles draw in (mostly red — a sustained downtrend).
  2. A red **SELL/short** marker drops at the November breakdown entry; a green **COVER** marker at the autumn-2022 low region.
  3. A green "**Profit**" ribbon fills between entry and cover; a small red "**− borrow fee**" sliver is subtracted to show the **net**.
  4. Blue caption states the disciplined-trade thesis and the exit-discipline tradeoff.
- **Interactive element:** The learner **sets the cover point** along the real decline (drag a COVER marker to any candle) and watches the **profit curve** redraw. Covering **too early** (high on the path) shows a smaller realized profit ("money left on the table"); covering **too late** risks landing on a **bounce** candle, shrinking the gain. A "borrow fee" toggle subtracts the carry for the holding period to show **net**. Live readouts: *Entry $E · Cover $C · Days held D · Gross = (E − C)·100 · Net = Gross − fee(D).* **Edge case:** if the learner drags COVER onto a relief-bounce candle, the readout drops, illustrating why a plan beats greed.
- **Verified-window anchors (PTON nominal):**

  | Marker | When | Verified / illustrative price |
  |---|---|---|
  | Window high | 2021-11-01 | **$92.95** (verified) |
  | **Short entry** (on the breakdown) | mid-Nov 2021 | ~$50 (illustrative point on the real path) |
  | Sustained decline | Nov 2021 → Oct 2022 | falling |
  | Window low (**buy-to-cover zone**) | 2022-10-03 | **$6.66** (verified) |
  | Gross / share (entry − cover) | — | ~$42/sh (≈ $4,200 per 100 sh) |
  | Full-range decline (high → low) | — | **−92.8%** ($92.95 → $6.66) |

- **Caption:** "When the thesis is right and price *keeps falling*, a short pays — short the breakdown near $50, cover near $8, keep the decline minus borrow. The skill isn't just *getting short*; it's **choosing the exit**: too early leaves profit behind, too late lets a bounce take it back."

> *Verification: pass — PTON `1d` 2021-11-01→2022-12-30 re-fetched from Yahoo (no split; quote = true nominal). Window high **$92.95 (2021-11-01)** and window low **$6.66 (2022-10-03)** confirmed against the candles — a −92.8% slide. PTON's data integrity was confirmed via its all-time high printing exactly **$171.09 on 2021-01-14** (the documented Peloton ATH). Carvana was rejected for this slot because Yahoo's CVNA series is mis-scaled ~4.79× with no split to justify it (ATH prints $75.37 vs the real $360.98).*

---

### Module 13 — QUIZ · "Will This Short Pay Off?"
- **Type / instrument:** QUIZ (Yes/No) · **REAL chart** with a genuine split-point resolution. **Robinhood (HOOD)**, `1d`, **2021-07-29 → 2021-12-30** (the IPO-week call-option frenzy that spiked HOOD to $85 then faded — a true two-way decision point; answer = ground truth).
  - **Data:** `https://query2.finance.yahoo.com/v8/finance/chart/HOOD?period1=1627516800&period2=1640908800&interval=1d`
  - **Bundled:** `data/short_quiz_HOOD.json` ✅ verified (no split; data is true nominal)
  - **Reveal candles up to the split date 2021-08-06 (close $55.01), rolling over off the spike; hide everything after.** The split sits at the recognizable-but-unresolved point; the answer is graded against the actual revealed candles.
  - *Why HOOD, not Bed Bath & Beyond: Yahoo's BBBY series is off-scale (its 2021-01 peak prints $94.98 vs the documented ~$54), so its candles would display fake prices. HOOD's data is clean — the 2021-08-04 spike prints exactly $85.00 high / $70.39 close — and the IPO-pop-then-fade is the same lesson.*
- **Learning goal:** Transfer test — judge whether a short **completes** (price keeps falling, short wins) or **backfires** (reverses up, short loses) using a masked real chart, reinforcing that the trade can go either way and that a reversal is the unbounded-loss scenario.
- **Masked setup shown:** Real HOOD candles shown to the split date — a quiet IPO base in the high-$30s/low-$40s, a violent two-day spike to an **$85.00** intraday high on 2021-08-04 (close $70.39) on a call-option frenzy, then the first rollover candles back to **$55.01** by 2021-08-06. *"HOOD just blew off the top and is rolling over off the spike. **You are short here.** Does price **continue lower** (short wins)?"* The post-split candles are masked.
- **Question (Yes/No):** "You're short at this decision point — does it continue lower (short wins)?"
- **Options:**
  - **YES — the failed IPO spike keeps falling and the short wins.** *(correct — confirmed by the real candles)*
  - **NO — it reverses and re-ignites higher; the short loses (unbounded).** *(cautionary contrast)*
- **Correct answer:** **YES — the short wins.** *(Confirmed against the fetched candles: from the 2021-08-06 split close of $55.01, HOOD fell almost without a meaningful bounce to a **$16.68** low on 2021-12-29, ending the window at $18.20 — a −66.9% decline. The exhausted spike rolled straight over.)*
- **Reveal animation:** Reuse Lesson 1's reveal: candles shown to the 2021-08-06 split, then the **hidden half tweens in** exposing the long slide to ~$17; a **P&L line resolves green (short wins)** and a green check grades a YES answer. A NO answer shows the same reveal with a red cross and the "you missed a winning short" note.
- **Why right / why wrong:**
  - **YES is right:** the spike was a **liquidity-driven blow-off** (IPO + a flood of call-buying), not a fundamental re-rating. Once the forced/options-driven buying exhausted, there was no demand to hold $70 and the stock broke its post-spike support decisively — the short's thesis was confirmed by follow-through to ~$17.
  - **NO is the cautionary contrast:** picking NO isn't "stupid" — a fresh spike *can* re-ignite, and **a short's loss is unbounded if it reverses** (M5), which is exactly why a **stop above the $85 spike high** is mandatory even on a winning-looking setup. Here the data went the short's way, but the discipline (stop above the high) is what makes the trade survivable when it doesn't.
- **Caption:** "Reading a fresh chart is the whole game. A failed blow-off often keeps falling — HOOD did, sliding from $55 to ~$17 — but a short that *reverses* has no loss limit, so even a 'winning' setup demands a stop above the spike. The answer is whatever the **real market** did, not what the setup 'should' do."

> *Verification: pass — HOOD `1d` 2021-07-29→2021-12-30 re-fetched from Yahoo (no split; quote = true nominal). The IPO-week spike high is **$85.00 on 2021-08-04** (close **$70.39**), exactly matching the documented frenzy. At the chosen split **2021-08-06 (close $55.01)** the setup is recognizable-but-unresolved; the hidden half collapses to a **$16.68** low (2021-12-29) and a $18.20 window-end close, so `correctAnswer = YES (short wins)`, **−66.9%** from the split — confirmed against the candles, not forced. Bed Bath & Beyond was rejected for this slot (Yahoo BBBY series off-scale: 2021-01 peak prints $94.98 vs documented ~$54).*

---

### Module 14 — INTERACTIVE · "Manage a Live Short"
- **Type / instrument:** INTERACTIVE · **REAL price path** with **illustrative fee/margin overlays**. Reuse a real window — default **PTON 2021–22** (`data/short_winner_PTON.json`) for a trending path, with the **GME 2021** window (`data/gme_squeeze_2021.json`) selectable as the "adverse path" mode to expose a margin call + recall.
- **Learning goal:** Put it all together — enter a short, watch borrow fees accrue, set a stop/cover plan, and **survive (or not)** an adverse path including a possible **margin call** and **recall**.
- **What the learner sees:** A real price path **advances day by day**. The **borrow meter ticks** (cumulative fee), the **margin gauge breathes** (equity vs. maintenance), and the **stop/cover orders the learner placed fire when hit**, with the **running net P&L** drawn live.
- **Animation (Phaser, composite — `CandleChart` + `BorrowFeeScene` + `MarginGaugeScene`):**
  1. Candles reveal one day per tick; a borrow-fee counter increments each day.
  2. The margin gauge rises/falls with unrealized P&L; if the adverse (GME) path is selected, it crosses maintenance and flashes **MARGIN CALL**.
  3. Learner-placed **stop (buy-to-cover)** and **target** lines sit on the chart; when a candle hits one, an order **fires** with a marker and the position closes (or reduces).
  4. A scripted **recall** event can fire on the adverse path, forcing a cover regardless of the plan.
  5. Running **net P&L** line draws live (gross minus cumulative borrow).
- **Interactive element:** Before running, the learner sets **entry size** (shares), a **stop (buy-to-cover) level**, and a **target**. On the adverse path, at the margin-call moment they choose **add cash** vs. **cover** vs. **do nothing** (do-nothing → forced buy-in). They then **run the path** and see **net P&L after all borrow costs**. Live readouts: *Day d · Price $X · Shares · Gross P&L · Cumulative borrow · **Net P&L** · Equity vs. maintenance.* **Edge cases:** a stop placed too tight gets clipped by normal noise on the trending path (whipsaw); no stop on the adverse path → forced buy-in at the worst price; a recall fires even when the plan looked safe.
- **Parameter set (illustrative overlays on a real path):**

  | Control | Range / default |
  |---|---|
  | Entry size | 50 / **100** / 200 shares |
  | Stop (buy-to-cover) | drag a line above entry |
  | Target (cover for profit) | drag a line below entry |
  | Borrow rate (example) | easy ~0.3%/yr ↔ hard ~30%/yr |
  | Path | **PTON 2021–22 (trending)** or GME 2021 (adverse) |
  | Margin-call choice | add cash / cover / do nothing |

- **Caption:** "Now you run it: size it, set a **stop above** and a **target below**, and survive the path. Borrow fees nibble every day; an adverse path can **margin-call** you or get you **recalled**. The traders who last are the ones with a plan **before** the candle prints."

---

### Module 15 — CAPSTONE · "Capstone & Recap: The Short Seller's Scorecard"
- **Type / instrument:** CAPSTONE (recap reel + scored scenario with an embedded check) · **REAL anchors cited** (GME 2021 **$483.00**, VW Oct 2008); the scenario chart is a **real Yahoo window** (reuse one of the bundled charts — default `data/short_winner_PTON.json`, or `data/short_quiz_HOOD.json` for a two-way decision).
- **Learning goal:** Recap the whole lesson — lifecycle, costs, the **capped-gain / unlimited-loss asymmetry**, margin/recall risk, and the squeeze — and stress that the asymmetry **plus** squeeze risk is why shorting demands strict discipline.
- **What the learner sees:** A **summary reel** replays the lifecycle conveyor (M2), the asymmetric payoff line (M5), and the GME/VW spikes (M9/M11). Then a **final scorecard** tallies the learner's earlier trades (the M2 lifecycle, M4 net quiz, M6/M10/M13 quizzes, M14 managed short) into one "**short seller's report card**" before the congrats handoff.
- **Animation (Phaser, `RecapReelScene`):**
  1. Three quick replays: the borrow→sell→cover→return conveyor; the +100% / −∞ payoff line; the GME and VW spikes side-by-side on the normalized axis.
  2. A "**Short Seller's Checklist**" assembles line-by-line: ☑ Borrow + locate ☑ Net of fee & dividends ☑ Stop above (unlimited downside) ☑ Avoid high short-interest / low-float squeeze fuel ☑ Respect margin & recall.
  3. The report card fills with the learner's prior results.
- **Interactive element (final scenario + embedded check):** Given a name's **short interest**, **borrow rate**, and a **real chart** at a decision point, the learner decides **SHORT / PASS** and, if shorting, **sizes** it (shares + stop). The recap **grades the decision** against the **asymmetry + squeeze-fuel checklist**:
  - Choosing to short a **low short-interest, normal-float, genuinely-deteriorating** name with a stop above = good (matches the M12 winning-short profile).
  - Choosing to short a **140%-short-interest, low-float, catalyst-driven** name = flagged as squeeze fuel (the M9/M10 trap).
  - The **embedded check** "**Was this a short worth taking?**" reveals the chart's outcome and explains using **short interest, days-to-cover, borrow cost, and the unlimited-loss rule**.
  Live readouts: *Short interest · Days-to-cover · Borrow cost over plan · Size & stop · Grade.*
- **Recap anchors / values:**

  | Recap item | Value / anchor |
  |---|---|
  | Lifecycle | borrow → sell → cover → return; P&L = sell − cover |
  | Net rule | net = gross − borrow fee − owed dividends |
  | Asymmetry | +100% ceiling vs. −∞ floor |
  | Squeeze fuel | SI% of float, days-to-cover; **GME ~$483 (2021-01-28)**, **VW Oct 2008** |
  | Discipline | stop above entry; avoid loaded springs; mind margin & recall |

- **Caption:** "The short seller's edge isn't being bearish — it's **discipline against an asymmetric, squeeze-prone bet**: borrow and net out the carry, always keep a stop above (the downside has no floor), and step aside when the spring is loaded. Score your read, and you've finished the lesson."

After Module 15 is graded and dismissed, the platform shows the **Congratulations screen** (§8).

---

## 7. PRD / platform traceability

| PRD / platform requirement | Satisfied by |
|---|---|
| Numbered modules in one lesson | §2 — 15 numbered modules (1–15) |
| Teach-style module: show concept + overlay explanation | §3 TEACH; Modules 2, 5, 7, 8, 9, 11, 12 (animated draw-in + sequenced blue annotations) |
| Quiz-style module: masked state → question → reveal → right/wrong → why | §3 QUIZ (reuses Lesson 1 mechanic); Modules 4, 6, 10, 13 with options, reveal, and why-right/why-wrong |
| Interactive/animated, interesting modules | §3 INTERACTIVE; Modules 1, 3, 14 (sandboxes with live readouts) + all Phaser animations |
| Real-stock charts from a public API (no synthetic candles) | §4 — Yahoo chart API windows + bundled JSON for Modules 2, 9, 11, 12, 13, 14, 15 scenario |
| Integrity: real events only, no fabricated "verified" data | §0 INTEGRITY note + §4 — real anchors (GME ~$483, VW Oct 2008) vs. clearly-labeled illustrative simulations |
| Segmented progress bar (completedModules / total) | §2 + §8 — 15-tick bar bound to `completedModules / 15` |
| Streak = most modules completed in one sitting | §8 — `currentSittingCount → bestStreak` |
| Google-auth gated dashboard with resume | §8 — Firebase Google sign-in; resume to `lastCompletedModule + 1` |
| Congratulations screen after the last module | §6 (after M15) + §8 — screen 16, not counted |
| Phaser animation + React chrome | §8 — Phaser scenes for canvases; React for chrome/buttons/progress |
| Minimalist white/blue/green palette (green=up/buy/long, red=down/sell/short, blue=annotations) | §8 palette; applied throughout §6 animations |
| Responsive desktop + mobile | §8 — relative coords, container-scaled canvas |
| Variable module count (not hard-coded 24) + new module types (INTRO/INTERACTIVE/CAPSTONE) | §8 "Platform-shell compatibility" — progress bar binds to `lesson.moduleCount` (15); renderer + completion rule registered per type |
| No-fabricated-data integrity (real anchors verified before ship) | §0 INTEGRITY note + §4 two-pass method + §8 "Pre-ship verification to-do" (fetch-and-verify every real window; back-fill exact anchors; M13 `correctAnswer` = real candles) |

---

## 8. Implementation notes (concise)

**Reusable Phaser scenes for this lesson.**
- `CandleChart` (reused from Lesson 1) — draws `{t,o,h,l,c}` arrays; green up-candles, red down-candles, white background, blue annotation lines/markers. Used as the backdrop in Modules 2, 9, 11, 12, 13, 14, 15.
- `IntroFlipScene` (M1) — the arrow flip + opposite-moving P&L needle.
- `ShortLifecycleScene` (M2) — the borrow→sell→cover→return conveyor with draggable SELL/COVER markers over `CandleChart`.
- `BorrowFeeScene` (M3, M14) — collateral gauge + daily fee ticker + dividend chip; pure-math overlay.
- `PayoffScene` (M5, M6) — the short/long payoff lines with the +100% ceiling and unbounded tail; reused for the M6 quiz reveal.
- `MarginGaugeScene` (M7, M14) — equity-vs-maintenance gauge, margin-call banner, forced buy-in candle, recall toast.
- `SqueezeLoopScene` (M8) — the accelerating feedback-loop spiral + short-interest bar + days-to-cover dial.
- `SqueezeAnnotateScene` / `MarketCapBalloonScene` (M9, M11) — base/ignition/peak annotations and the inflating-deflating market-cap balloon.
- `WinningShortScene` (M12) — entry/cover markers + profit ribbon − borrow sliver on a real downtrend.
- `RecapReelScene` (M15) — replays the above and assembles the checklist + report card.
- A shared **Quiz reveal** controller renders a mask rectangle at the split date (chart quizzes) or over the answer (numeric quizzes) and tweens it away on submit, then draws the grade + explanation panel.

**How INTERACTIVE state is driven.** Each interactive module holds its parameters (slider/marker values) in React state; on change it calls a pure compute function (e.g., `shortPnL(sell, cover, shares)`, `borrowFee(value, rate, days)`, `daysToCover(short, vol)`, `payoffPct(entry, price, side)`) and pushes the results into the Phaser scene via a registry/event so the canvas redraws live. All math is the exactly-correct formulas in §6 — no fabricated outputs. Readouts render in React chrome beside the canvas.

**Progress bar.** Segmented bar with **15 ticks** bound to `completedModules`; a module marks complete (TEACH "Got it", INTERACTIVE "Continue", QUIZ after reveal+explanation dismissed, CAPSTONE after final grade), advancing one tick. State persists from Firestore so the bar is correct on reload.

**Streak.** Track `currentSittingCount` in memory, incrementing per module completed; reset on a session gap. Persist `bestStreak = max(bestStreak, currentSittingCount)` to Firestore ("most modules completed in one sitting").

**Dashboard resume.** Firebase **Google** sign-in; create the user doc on first login. Dashboard "Resume" jumps to `lastCompletedModule + 1` (i.e., the first un-done module of Lesson 3).

**Firestore shape.**
```
users/{uid} → {
  progress: { lastCompletedModule: number, completedModules: number[] },
  bestStreak: number,
  updatedAt: serverTimestamp
}
```
(Per-lesson progress can be namespaced, e.g., `progress.lesson3.{lastCompletedModule, completedModules[]}`, consistent with the platform's multi-lesson shell.)

**Responsive.** The chart/diagram canvas scales to its container; all annotations, gauges, and payoff axes use **relative coordinates** so every module reads on phone and desktop. Sliders and draggable markers have touch-sized hit areas.

**Palette.** Minimalist **white** background; **green** = up / buy-to-cover-profit / long / "+100% ceiling"; **red** = down / sell-short / loss / the unbounded tail; **blue** = annotations, labels, necklines, and callouts. Consistent with Lessons 1–2.

**Congratulations screen (screen 16, not a counted module).** On dismissing the Module-15 grade, the platform shows a full-screen celebration: a headline "**You've mastered Short Selling**," a one-line recap ("Borrow high, sell, cover low — and respect the asymmetry"), the learner's **short seller's report card** (their M2 / M4 / M6 / M10 / M13 / M14 / M15 results), their **best streak** this lesson, and a confetti / green-accent animation. The primary action returns to the **dashboard** (now showing Lesson 3 at 15/15); a secondary action offers the next lesson. This screen is **not** counted in `completedModules / 15`.

**Platform-shell compatibility (variable module count + new module types).** Lesson 1 was 24 modules of only `TEACH` / `QUIZ`; Lesson 3 is **15 modules** mixing `INTRO`, `TEACH`, `INTERACTIVE`, `QUIZ`, and `CAPSTONE`. The shell must therefore:
- Drive the progress bar from the lesson's **declared module count** (`lesson.modules.length`), **not** a hard-coded 24 — the segmented bar binds to `completedModules / lesson.moduleCount` (here `/15`).
- Register a renderer/completion rule for **every** module type, not just TEACH/QUIZ:
  - `INTRO` & `INTERACTIVE` → sandbox renderer; complete on **"Continue"** (no pass/fail).
  - `TEACH` → concept renderer; complete on **"Got it."** Note: M2 and M12 are typed `TEACH` but embed **draggable SELL/COVER interactives** (richer than Lesson 1's static TEACH overlays), so the TEACH renderer must tolerate an optional interactive layer — the type label `TEACH` now implies "concept + optional exploration," and completion is still the **"Got it"** button.
  - `QUIZ` → masked → reveal → grade → explain controller (the Lesson 1 mechanic); complete after the reveal+explanation is dismissed.
  - `CAPSTONE` → recap-reel + scored-scenario renderer; complete after the final grade.
- Treat the **module type enum** as extensible so adding `INTRO` / `INTERACTIVE` / `CAPSTONE` does not break Lesson 1's TEACH/QUIZ-only flow. (Confirm this against the `feat/platform-shell` skeleton before wiring Lesson 3.)

**Verification — ✅ COMPLETED (2026-06-23).** Every real window was fetched from its exact Yahoo URL, the anchor candles located in the printed OHLC, and the labels re-checked against the candles; exact prices/dates are back-filled into each module table and each module carries a `> Verification:` blockquote. Results:
- **Clean & confirmed:** **GME** (peak **$483.00** on 2021-01-28, close $193.60; bundled ×4 nominal), **LCID** (peak **$57.75** 2021-11-17 → low **$21.31** 2022-03-14; bundled ÷10 nominal), **PTON** (high **$92.95** 2021-11-01 → low **$6.66** 2022-10-03, −92.8%), **HOOD** (spike **$85.00** 2021-08-04 → split 2021-08-06 $55.01 → low **$16.68**; `correctAnswer = YES, short wins`).
- **VW (VOW.DE):** daily candles confirmed (base €192.30 → daily peak €635.00 2008-10-27 → €238.10); rendered as a **real-event illustration** because Yahoo's daily high understates the documented ~€1,005 intraday print (2008-10-28). No fabricated candle.
- **Two replacements for data integrity** (Yahoo series mis-scaled with no split to justify it — would have displayed fake prices): **Carvana (CVNA) → Peloton (PTON)** for M12; **Bed Bath & Beyond (BBBY) → Robinhood (HOOD)** for M13. See §4.
- **Split handling baked into the bundled JSON:** GME ×4 (4:1 split 2022-07-22) and LCID ÷10 (1:10 reverse split 2025-09-02) so the charts read in the prices traders saw; each affected file carries a `meta._nominalNote`.
- **Bundled files (all in `planning/data/`):** `gme_squeeze_2021.json`, `short_lifecycle_LCID.json`, `vw_squeeze_2008.json`, `short_winner_PTON.json`, `short_quiz_HOOD.json`. No fabricated OHLC is presented as "verified."
