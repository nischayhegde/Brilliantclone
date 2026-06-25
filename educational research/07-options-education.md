# Options-Specific Education Resources for Beginner Traders (2025–2026)

> Research brief for the product team building an interactive trading/options **education** app (Brilliant.org-style, animated manipulable scenes, real verified data, exact math). This document maps the landscape of resources amateur/beginner traders actually use to learn **options** specifically, what each teaches, how credible it is, and — most importantly — where an interactive, visualization-first product can win.

---

## Why this category matters

Options are widely considered the single hardest jump for a self-directed retail learner. A stock has roughly one variable that matters (price). An option has at least four interacting forces at once — direction, **time decay**, **implied volatility**, and **probability** — plus mechanics that have no stock equivalent (strikes, expirations, assignment, exercise, 100-share contract multipliers, multi-leg spreads). Beginners routinely "get the direction right and still lose money," which is deeply discouraging and is the #1 driver of churn out of options.

This is exactly the gap an interactive education product is built to close. The resources below are the incumbents; the patterns in how the *best* of them teach (payoff diagrams, live risk graphs, "what-if" sliders, probability framing) are the blueprint.

Two structural facts frame everything in 2025–2026:

1. **0DTE (zero-days-to-expiration) options now make up ~50–60% of all SPX options volume** (up from ~5% in 2020). Daily expirations have made short-dated, high-gamma trading a mainstream beginner entry point — for better and worse.
2. **Premium-selling / "theta gang" income strategies (the wheel, cash-secured puts, covered calls, credit spreads) have become the dominant beginner mental model**, popularized by Reddit and tastylive, displacing the older "buy a call and hope" approach.

---

## The Resource Landscape (overview table)

| Resource | Type | Cost | Skill level | Credibility | Core options focus |
|---|---|---|---|---|---|
| **OIC / OptionsEducation.org** (OCC) | Self-paced courses, webinars, podcasts | Free | Beginner → advanced | Very high (industry/clearinghouse) | Mechanics, Greeks, IV, every strategy, risk |
| **Cboe Options Institute** | Courses, live classes, learning portal, tools | Free | Beginner → advanced | Very high (the exchange itself) | Options 101, payoff diagrams, index options, 0DTE, decision theory |
| **tastylive / tastytrade** | Video courses + daily live TV + brokerage | Free (broker-funded) | Beginner → intermediate | High (founders = Cboe veterans) | IV, probability, premium selling, the wheel, 0DTE |
| **Option Alpha** | Structured video curriculum + no-code bots | Free (with linked broker) | Beginner → advanced | High | Mechanics, probabilities, automation, premium selling |
| **projectfinance / projectoption (Chris Butler)** | YouTube + paid data course + modeling tool | Free YT; ~$247 course; tool subscription | Beginner → intermediate | High (ex-tastytrade, ~480K subs) | Clear visual fundamentals, P/L curves, backtested strategy data |
| **InTheMoney (Adam)** | YouTube | Free | Beginner | Medium-high (popular, accessible) | LEAPS, IV, rolling, Robinhood/Webull mechanics |
| **OptionsPlay** | Strategy-selection software + education | ~$40/mo (via StockCharts) | Beginner → intermediate | Medium-high (Tony Zhang, CNBC) | Strategy selection, covered calls, credit spreads, scoring/ranking |
| **Power Cycle Trading (Larry Gaines)** | Paid bootcamps, alerts, indicators | Paid (courses/packages, often $$$) | Intermediate | Medium (marketing-heavy) | Spreads, covered calls, breakouts, volatility |
| **Simpler Trading (John Carter)** | Paid courses, indicators, chat rooms | Paid ($247–$649+ tiers) | Intermediate | Medium (marketing-heavy) | Squeeze setups, directional options, income, 0DTE SPX |
| **Reddit r/options + r/thetagang** | Community + wikis | Free | Beginner → advanced | Mixed (great wiki, noisy comments) | The wheel, premium selling, real-world mistakes |
| **OptionStrat / Options Profit Calculator** | Interactive payoff/Greeks visualizers | Free + ~$20/mo Pro | All levels | High (tool, not advice) | Payoff diagrams, Greeks, POP, IV scenarios |
| **Books (McMillan, Natenberg, Sincere)** | Reference texts | ~$20–$80 | Beginner → expert | Very high (canonical) | Everything, from intro to pricing theory |

---

## Tier 1 — Authoritative, free, "neutral" education

### 1. The Options Industry Council (OIC) — OptionsEducation.org
- **URL:** https://www.optionseducation.org/ (e-learning: OCC Learning at https://www.optionseducation.org/theoptionseducationcenter/occ-learning)
- **What it is:** The education arm of **OCC** (Options Clearing Corporation — the entity that clears *every* U.S. listed options trade). Running since **1992**. Completely independent and **not** trying to sell a trading style.
- **What it teaches:** A multi-course "OIC Options Academy: Key Concepts and Strategies" curriculum — Options 101, the Greeks, **implied volatility**, every standard strategy (covered calls, protective puts, spreads, iron condors), corporate actions (splits/assignment), and **the wheel**. Recent (2026) content explicitly covers **0DTE risk profiles**, the **"Rule of 16,"** options **skew**, **IV ↔ Greek interactions**, and second-order Greeks (Vanna, Charm, Vomma).
- **Format & cost:** Self-paced eLearning, on-demand + live webinars, podcasts, videos, quizzes/knowledge checks, progress tracking, a downloadable **Options Strategies Quick Guide** (payoff graphs for each strategy), and a **digital Strategy Guide**. **100% free.** Live instructor email support on trading days (8am–4pm CT).
- **Skill level & credibility:** Beginner → advanced. **Among the most credible sources in the entire space** — it's the clearinghouse itself.
- **Why beginners use it:** Trustworthy, jargon-defined, no sales pitch, strong risk emphasis. Main drawback: no community/mentorship and a "textbook" feel.

### 2. Cboe — The Options Institute
- **URL:** https://www.cboe.com/en/optionsinstitute/
- **What it is:** Education division of **Cboe** (the exchange that invented listed options), founded **1985** — celebrated **40 years** in 2025. Originally trained floor traders; **in 2020 it formally expanded to retail**.
- **What it teaches:** "Options 101" (calls, puts, strikes, core concepts, ~30 min), "Why Trade Options," How Call/Put Options Work, **how a trade actually happens behind the scenes**, index options, **0DTE resources**, multi-leg/hedging/risk management, and a signature **"Decision Theory"** course (risk + decision-making under uncertainty). Heavy use of **payoff/payout diagrams**.
- **Format & cost:** Free **Learning Portal** with on-demand courses + learning paths, live/in-person classes, glossaries, and **interactive learning tools**. Content in multiple languages (EN, ES, Hindi, Russian, Dutch; German/French added 2H 2025).
- **Skill level & credibility:** Beginner → advanced. **Highest possible authority** (the exchange).
- **Why beginners use it:** Free, structured "where are you in your journey?" onboarding, clean mechanics, and an institutional reputation. Note: OIC and Cboe Options Institute overlap conceptually but are *separate* programs (OCC vs. Cboe).

---

## Tier 2 — Free, opinionated, methodology-driven (the most-used by beginners)

### 3. tastylive / tastytrade
- **URLs:** https://www.tastylive.com/learn-courses · Beginner course: https://learn.tastylive.com/courses/beginner-options-course
- **What it is:** A financial media network + options-focused brokerage founded by **Tom Sosnoff & Scott Sheridan (former Cboe floor traders)**. Investopedia rates tastytrade a top broker for free options education; it's frequently named **best overall** free options course.
- **What it teaches:** Flagship **Beginner Options Course (40 lessons, free)** taught by **Mike Butler** — basics, the Greeks (delta/theta/vega), strategies, risk management, trade entry, and management. Dedicated **Implied Volatility** course. Its whole philosophy is **high-probability, premium-selling, defined-risk trading**, managing positions around **IV, probability of profit (POP), and extrinsic value** — plus the wheel and small-account/0DTE content.
- **Format & cost:** Structured video courses + quizzes, **plus daily live programming** (e.g., "Options Trading Concepts LIVE," "Mike and his Whiteboard," "Tasty Bites"). **Free** (funded by the brokerage).
- **Skill level & credibility:** Beginner → intermediate. High credibility; the main caveat is it's a brokerage with a consistent "sell premium" bias.
- **Why beginners use it:** Free, structured, *and* you watch real traders apply the concepts live — bridging theory and execution. The live-trading context is its differentiator vs. OIC/Cboe.

### 4. Option Alpha
- **URLs:** Courses https://optionalpha.com/courses/beginner-course · Bots https://optionalpha.com/bots · Fast Track https://optionalpha.com/fast-track
- **What it is:** A long-running free education brand (>a decade) + a **no-code options automation platform**. Investopedia names it **"best content for beginners."**
- **What it teaches:** **160+ free videos** across Beginner → Intermediate → Advanced **guided tracks** — options basics/terms, pricing, the Greeks, **statistics/probabilities**, many strategies, trade **adjustments**, **portfolio management**, and rolling/hedging near expiration. Advanced track focuses on building a repeatable, mechanical system that generates "alpha."
- **Format & cost:** Guided video curriculum (no membership needed). The **platform + bots are free when you connect a TradeStation or Tradier brokerage account**. Bots are built with **natural-language "recipes" (decisions/actions), scanners, monitors, triggers, and auto-exits — no coding.**
- **Skill level & credibility:** Beginner → advanced. High credibility for systematic, rules-based retail trading.
- **Why beginners use it:** Clear progressive tracks + the unique angle of **automating** mechanical strategies so emotion is removed. Strong fit for the "premium selling as a system" crowd.

### 5. projectfinance / projectoption (Chris Butler)
- **URLs:** https://projectoption.com/ · About: https://projectoption.com/about · Course: https://projectoption.com/data-driven-options-strategies
- **What it is:** YouTube channel (**~480K subscribers, 36M+ views**) + paid course + a web modeling tool, run by **Chris Butler** (13 yrs in options, ex-tastytrade). His long-form **"Options Trading for Beginners"** video has **~18M views** and is one of the most-recommended single resources for "options finally clicking."
- **What it teaches:** YouTube = clear, **visual** fundamentals (what options are, P/L payoff shapes, the Greeks, spreads). Paid **"Options Strategy Data Lab / Data-Driven Options Strategies"** (~$247, sometimes closed for enrollment) = **backtested**, data-driven strategy research across ~18 years of data, plus a **LEAPS growth strategy** and directional vs. market-neutral approaches tradable in small accounts ($2,500–$5,000).
- **Format & cost:** Free YouTube; paid course (one-time, lifetime access); **OptionLens** subscription modeling tool (P/L curves, T+ time lines, **IV what-if modeling**, IV rank/percentile, IV screener across 300+ tickers).
- **Skill level & credibility:** Beginner → intermediate. High — known for clarity and **data over hype**.
- **Why beginners use it:** Arguably the clearest *visual* explainer on YouTube; the data-driven framing counters gambling-style content.

### 6. InTheMoney (Adam)
- **URL:** https://www.youtube.com/@InTheMoneyAdam
- **What it is:** Beginner-favorite YouTube channel started 2018 by a young trader, "Adam" (grown to ~440K+ subscribers, 24M+ views).
- **What it teaches:** Plain-English breakdowns of options strategies from beginner to advanced, **implied volatility**, **how to roll options**, **LEAPS**, and platform tutorials (**Robinhood, Webull**). Known for making complex concepts digestible.
- **Format & cost:** Free YouTube videos + occasional live streams.
- **Skill level & credibility:** Beginner. Medium-high — very accessible, entertaining, broker-tutorial-heavy (good for the youngest cohort that starts on Robinhood).
- **Why beginners use it:** Approachable tone, real-platform walkthroughs, and "explain it like I'm new" pacing.

---

## Tier 3 — Tools that double as teachers (visualization-first)

### 7. OptionStrat
- **URLs:** https://optionstrat.com/ · Features: https://optionstrat.com/features · Tutorial: https://optionstrat.com/tutorials/options-builder
- **What it is:** A modern **options strategy builder / profit calculator / flow analyzer** — web + mobile.
- **What it teaches (implicitly, by doing):** The **risk graph** is the centerpiece — stock price on X, P/L on Y, answering "if the stock is at X on date Y, what do I make/lose?" Shows **two lines: P/L at expiration (solid) vs. P/L today (curved)** — and the gap between them *is* **theta** (time decay made visible). 50+ prebuilt strategy templates (verticals, iron condors, butterflies, straddles, calendars, diagonals). Displays **breakevens, max profit/loss, probability of profit, and combined (net) Greeks** for multi-leg trades, plus **IV what-if** (model IV crush/expansion) and an **optimizer** that searches thousands of trades for max-return or max-probability.
- **Format & cost:** **Free tier** (builder, full P/L visualization, basic scenarios, POP) + **Pro (~$20/mo)** (live Greeks overlay, full IV/time/price sliders, saved strategies/alerts). Uses real OPRA data (15-min delayed free).
- **Why it matters to our product:** This is the closest existing analog to "learn by manipulating a live payoff scene." It proves demand for **drag-the-strike, see-the-curve-change** interaction — but it's a *trading tool*, not a teaching curriculum. **That's the wedge.**

### 8. Options Profit Calculator & similar free visualizers
- **What they are:** Free web payoff-diagram calculators (e.g., optionsprofitcalculator.com) widely used by beginners to *see* a strategy's shape before trading.
- **Why beginners use them:** Free, instant payoff diagrams and breakevens without a brokerage. Limited Greeks/IV depth vs. OptionStrat, but lowest-friction entry to "what does this trade look like?"

### 9. OptionsPlay (with Tony Zhang)
- **URLs:** https://stockcharts.com/optionsplay/ · Strategy Center: https://help.stockcharts.com/charts-and-tools/research-tools/optionsplay-strategy-center.md
- **What it is:** A **strategy-selection engine** (integrates into StockCharts; Tony Zhang is a frequent CNBC *Options Action* contributor).
- **What it teaches:** Helps users pick **which** strategy fits a view + risk tolerance. The **Strategy Center** ranks setups by an "OptionsPlay score," auto-calculates the **Greeks**, filters for liquidity, avoids earnings traps, and computes max gain/loss, breakevens, and **probability of success** for covered calls, short puts, debit/credit spreads, and iron condors. The **Explorer** gives three P&L graphs with **plain-English** descriptions of each scenario. Supports 9 strategies from beginner to advanced. Daily curated trade ideas + exclusive educational articles/webinars.
- **Format & cost:** ~**$40/month** add-on via StockCharts.
- **Skill level & credibility:** Beginner → intermediate. Medium-high — strong at the "which strategy?" decision, which beginners find paralyzing.
- **Why beginners use it:** Removes the blank-page problem of strategy selection and explains the *why* in plain English.

---

## Tier 4 — Paid mentorship / "guru" programs (use with care)

### 10. Power Cycle Trading (Larry Gaines)
- **URL:** https://www.powercycletrading.com/
- **What it is:** Paid education brand by **Larry Gaines** (30+ yrs professional trading; ran a large oil-options desk). Claims to have taught 1M+ traders.
- **What it teaches:** Options during bear markets, **seasonality + spreads/option pairs**, directional/breakout trading, **synthetic covered calls**, pairs trading for market neutrality, plus a **60-page options guide covering the Greeks**. Built around a proprietary "Power Cycle Trading model" (cycles, momentum, volatility breakouts) and proprietary indicators/scanners.
- **Format & cost:** Home-study courses, live interactive webinars, a trading club (virtual room, Q&A, **trade alerts**), course "packages" — **paid** (frequently bundled, marketing-heavy pricing).
- **Skill level & credibility:** Intermediate. Medium — real pedigree, but heavy promotional funnel; "educational purposes only, not financial advice" disclaimers throughout.
- **Why beginners use it:** Hand-held setups, alerts, and indicators for people who want a "system" rather than first-principles.

### 11. Simpler Trading (John Carter)
- **URLs:** https://www.simplertrading.com/courses · Options 101: https://my.simplertrading.com/product/simpler-options-101-elearning-module
- **What it is:** Education + mentorship community founded **1999** by **John Carter** (author of the bestseller *Mastering the Trade*; creator of the **"Squeeze"** indicator).
- **What it teaches:** **Simpler Options 101** (foundational options + money management), **Mastering the Trade University** (12 interactive 1-hr sessions: psychology, risk management, specific setups including a **"Five-Star Setup System for Beginners"** and **0DTE SPX** scalping), and **Squeeze Pro/Ultra** systems for spotting directional moves. Uses both options and futures for directional plays and income.
- **Format & cost:** Membership + course tiers (e.g., Squeeze Pro Basic ~**$247**, Elite ~**$649**), chat rooms, trade alerts, indicators for ThinkorSwim/TradingView. **Paid.**
- **Skill level & credibility:** Intermediate → experienced (their own reviews say it's *not* ideal for total beginners). Medium — respected founder, but expensive and marketing-forward.
- **Why beginners use it:** Live trading rooms + a named, repeatable setup system and a strong community.

---

## Tier 5 — Community & books

### 12. Reddit: r/options and r/thetagang
- **URLs:** https://www.reddit.com/r/options/ (wiki) · https://www.reddit.com/r/thetagang/
- **r/options (~700K+ members):** Well-moderated; the **wiki / FAQ** is a genuinely good, free beginner curriculum (mechanics, Greeks, common-mistakes, "getting started"). Best for serious learning and strategy discussion.
- **r/thetagang (~200–350K members):** The home of **premium selling** — cash-secured puts, covered calls, and **the wheel**. The name comes from **theta** (time decay) being "the paycheck." Focused, high-signal for income strategies.
- **What beginners learn here:** The wheel mechanics (sell CSP → if assigned, sell covered calls → repeat), strike selection by **delta (~0.20–0.30 ≈ 20–30% assignment odds)**, **30–45 DTE** as the standard window (balancing theta vs. gamma risk), rolling for credit, and — crucially — **real "lessons learned / mistakes" threads.**
- **Credibility:** Mixed. Wikis and top posts are excellent; individual comments range from expert to dangerous. A recommended beginner path that circulates: *Week 1 — r/options wiki; Week 2 — r/thetagang wheel posts; Week 3 — search "mistakes"/"lessons learned"; Week 4 — participate.*
- **Why beginners use it:** Free, social, real money on the line, and the wheel/theta framing is sticky and approachable.

### 13. Canonical books & cheat-sheets
| Book | Author | Best for | Note |
|---|---|---|---|
| **Understanding Options (2e)** | Michael Sincere | True beginners | Accessible; covers Greeks, spreads, collars, protective puts |
| **Options as a Strategic Investment (5e)** | Lawrence McMillan | Beginner → advanced reference | 1,000+ pages; the "bible of options trading," strategy-by-strategy |
| **Option Volatility & Pricing (2e)** | Sheldon Natenberg | Intermediate → pro | The pricing/volatility "bible"; how pros think about IV & risk |
| **Options Trading QuickStart / Crash Course** | Various | Fast starts | Shallow but easy; good for momentum |
- **Cheat-sheets:** OIC's free **Options Strategies Quick Guide** (payoff graphs, market outlook, risk/reward, breakeven, volatility & erosion per strategy) is the canonical free one-pager set. Most brokers (Schwab, Fidelity) publish similar strategy cheat-sheets.

---

## Concepts Beginners Struggle With (and how the best resources teach them)

This is the heart of the opportunity. Across every source, the same handful of concepts cause the most confusion — and the resources that succeed all reach for the **same teaching devices: payoff diagrams, live "what-if" manipulation, probability framing, and concrete analogies.**

| Concept | Why it's hard for beginners | How the best resources teach it | Interactive-app opportunity |
|---|---|---|---|
| **Payoff at expiration (the hockey-stick)** | Abstract; "what do I actually make at price X?" | **Payoff/risk diagrams** (OIC, Cboe, OptionStrat) — X = stock price, Y = P/L | Let the learner **drag the stock price** and watch P/L update; the canonical "show, don't tell" win |
| **The Greeks (Δ, Γ, Θ, V, ρ)** | Five interacting sensitivities, all changing constantly; taught as static numbers | Teach **one at a time**; show delta ≈ probability of finishing ITM and ≈ shares-equivalent; show the **gap between "P/L today" and "P/L at expiration" = theta** (OptionStrat) | **Sliders for price/time/IV** that move the curve; isolate each Greek as its own manipulable scene |
| **Implied Volatility & IV crush** | "I was right on direction and *still* lost money." IV is non-directional and forward-looking | Teach IV = expected *magnitude*, not direction; **IV Rank/Percentile** to judge high vs. low; show premium inflating before earnings and **collapsing after** | Animate a pre/post-earnings **IV crush** on the option price with the stock barely moving |
| **The "Rule of 16"** | Converting annual IV to a daily expected move | Cboe/OIC: divide IV by ~16 to get the expected 1-day move (√252 ≈ 16) | One-line interactive: type IV, see the daily expected move band on a chart |
| **Probability of Profit (POP)** | Beginners think direction; pros think odds | tastylive/Option Alpha frame every trade by **POP & expected value**; selling premium = high win-rate, capped reward | Show a **probability distribution** overlaid on the payoff graph |
| **Assignment & exercise** | "Will I be forced to buy/sell? When?" Surprise assignments scare people | OIC explains obligation vs. right; r/thetagang treats assignment as a *feature* of the wheel | Simulate assignment on a short put → "you now own 100 shares, here's your cost basis" |
| **Spreads (multi-leg)** | Combining legs changes the payoff shape and net Greeks non-obviously | Build the shape leg-by-leg; show **net** Greeks; OptionStrat's combined-Greeks display | Add/remove legs and **watch the payoff shape morph** in real time |
| **Position sizing / the math** | 100-share multiplier, max loss, capital at risk | "Size by **max loss**, not premium"; 1–2% of capital per (especially 0DTE) trade | Calculator that ties contracts → capital at risk → % of account |
| **Time decay (theta)** | Non-linear; accelerates into expiration | Show the **T+ time line** decaying the curve toward the hard expiration payoff | Animate the curve "falling" toward the hockey-stick as days tick down |

**Analogies that recur and work:**
- An option = a **down payment / reservation** on a house at a locked price for a set time.
- **Theta = an ice cube melting** (worth less every day, melts faster near the end).
- **IV crush = air leaving a balloon** the instant uncertainty (earnings) resolves.
- **Delta = both your "speed" relative to the stock and your rough odds** of finishing in-the-money.
- **The wheel = renting out a stock you'd happily own** (collect rent = premium until you're assigned, then collect rent on the shares).

---

## Key Trends & Takeaways (2025–2026)

1. **0DTE is now the center of gravity.** ~50–60% of SPX options volume is same-day. Daily expirations (Cboe finished the rollout in 2022) turned short-dated trading mainstream. Notably, **>95% of 0DTE trades are defined-risk** (long options or spreads), and retail has become **more disciplined** than the "gambling" narrative suggests — but gamma and theta behave violently in the final hours, so it remains genuinely dangerous for the untrained.

2. **Premium selling / "theta gang" is the dominant beginner framework.** The wheel, cash-secured puts, covered calls, and credit spreads have displaced "buy a call and hope." Standard heuristics are now common knowledge: **~0.20–0.30 delta strikes, 30–45 DTE, roll for credit, manage at ~50% profit.** This shifts education from *direction-picking* to *probability + volatility + management.*

3. **Free, high-quality education has commoditized the basics.** OIC, Cboe, tastylive, Option Alpha, and top YouTubers (projectfinance, InTheMoney) all offer excellent free curricula. **The differentiator is no longer information — it's how it's taught.** Static videos and PDFs dominate; truly *interactive, manipulable* learning is rare.

4. **Tools are the secret teachers.** OptionStrat and payoff calculators teach more intuition per minute than most courses because they're **interactive and visual** — but they're built for *trading*, not *learning*, with no scaffolding, no "one idea per screen," and no progression. **A teaching product that brings the interactivity *inside* a guided curriculum has a clear, open lane.**

5. **The persistent beginner failure mode is the IV/Greeks blind spot** — being right on direction and losing on **IV crush** or **theta**. Any product that makes IV crush and time decay *viscerally visible* solves the most painful, most-cited beginner problem.

6. **Automation is rising** (Option Alpha's no-code bots) — signaling beginners want **systematic, emotion-free, rules-based** approaches, not gut calls.

### Where an interactive education app can uniquely win
- **Make the invisible visible.** The killer feature is a **live payoff/risk graph the learner manipulates** — drag the strike, scrub time-to-expiration, and slide IV — with the curve and Greeks updating in real time. This is the one thing books, videos, and Reddit *cannot* do, and even OptionStrat doesn't wrap in a teaching arc.
- **Teach one Greek per module, by feel.** Isolate delta, then theta, then vega as separate manipulable scenes (aligns perfectly with the product's "one idea per module" principle).
- **Dramatize the two biggest traps** — **IV crush** (right direction, still lose) and **theta decay** (the melting ice cube) — as short, animated, replayable scenes backed by *real, verified* data and exact math.
- **Use probability framing from day one** (POP, expected move via the Rule of 16) so learners internalize the pro mental model, not the lottery-ticket one.
- **Simulate assignment and the wheel** as an interactive loop (sell CSP → assigned → covered call → called away → repeat) so the most popular beginner strategy is *experienced*, not just read.
- **Stay calm and trustworthy, never hype** — the antithesis of guru funnels (Power Cycle, Simpler) and WSB gambling energy, which directly matches the product's "calm confidence, earned trust through accuracy" brand.

---

## Sources

**Authoritative / neutral education**
- The Options Industry Council (OIC) — https://www.optionseducation.org/
- OIC / OCC Learning portal — https://www.optionseducation.org/theoptionseducationcenter/occ-learning
- OIC Options Strategies Quick Guide — https://www.optionseducation.org/the-options-strategies-quick-guide
- OIC "May Office Hours FAQs: IV, Greek Exposure, Market Maker Activity" — https://www.optionseducation.org/news/may-office-hours-faqs
- OCC Investor Education — https://www.theocc.com/company-information/investor-education
- Cboe — The Options Institute — https://www.cboe.com/en/optionsinstitute/
- Cboe — "Celebrating 40 Years of The Options Institute" — https://www.cboe.com/insights/posts/celebrating-40-years-of-the-options-institute/
- Cboe — 40 Years press release — https://www.prnewswire.com/news-releases/cboe-commemorates-40-years-of-options-education-with-the-options-institute-302431631.html

**Methodology-driven free education**
- tastylive Learn Center — https://www.tastylive.com/learn-courses
- tastytrade Beginner Options Course — https://learn.tastylive.com/courses/beginner-options-course
- Option Alpha — Beginner Course — https://optionalpha.com/courses/beginner-course
- Option Alpha — Bots / automation — https://optionalpha.com/bots
- Option Alpha — Fast Track — https://optionalpha.com/fast-track
- projectoption (Chris Butler) — https://projectoption.com/ · About — https://projectoption.com/about
- projectoption — Data-Driven Options Strategies — https://projectoption.com/data-driven-options-strategies
- InTheMoney (Adam) YouTube — https://www.youtube.com/@InTheMoneyAdam

**Tools (visualization / strategy selection)**
- OptionStrat — https://optionstrat.com/ · Features — https://optionstrat.com/features · Builder tutorial — https://optionstrat.com/tutorials/options-builder
- OptionStrat guide (Oyamori) — https://oyamori.com/learning/optionstrat-guide/
- OptionsPlay add-on (StockCharts) — https://stockcharts.com/optionsplay/
- OptionsPlay Strategy Center docs — https://help.stockcharts.com/charts-and-tools/research-tools/optionsplay-strategy-center.md

**Paid mentorship programs**
- Power Cycle Trading (Larry Gaines) — https://www.powercycletrading.com/ · Bootcamps — https://www.powercycletrading.com/bootcamps-and-coaching/
- Simpler Trading (John Carter) — https://www.simplertrading.com/courses · Options 101 — https://my.simplertrading.com/product/simpler-options-101-elearning-module · MTT University — https://www.simplertrading.com/mtt-university

**Community, the wheel & theta gang**
- r/options + r/thetagang overview — https://optionspilot.app/blog/start-options-trading-reddit-advice
- The Wheel strategy guide (Predicting Alpha) — https://www.predictingalpha.com/wheel/
- Theta Gang Wheel guide (eInvesting for Beginners) — https://einvestingforbeginners.com/theta-gang-wheel-strategy-guide/
- Theta Gang premium-selling playbook (Options Cafe) — https://options.cafe/blog/premium-selling-theta-gang-playbook/

**0DTE trend**
- Cboe 0DTE Trading Resources — https://www.cboe.com/en/tradable-products/0dte/
- Cboe "0DTEs Decoded: Positioning, Trends, Market Impact" — https://www.cboe.com/insights/posts/0-dt-es-decoded-positioning-trends-and-market-impact/
- "0DTE Options Explained" (HeyGoTrade) — https://www.heygotrade.com/en/blog/0dte-options-explained/
- 0DTE Complete Guide 2026 (MarketXLS) — https://marketxls.com/blog/0dte-options-strategy-complete-guide

**Concepts beginners struggle with (Greeks / IV)**
- "Is Trading Options Hard?" — https://revolutiontradingpros.com/is-trading-options-hard/
- Option Greeks: Complete Beginner's Guide (Ryan O'Connell, CFA) — https://ryanoconnellfinance.com/option-greeks/
- Option Greeks Explained (CapMint) — https://www.capmint.com/learn/articles/option-greeks
- What Is Implied Volatility? — https://www.optionstrading.org/blog/what-is-implied-volatility/
- Options Fundamentals: The Complete Guide (WheelMetrics) — https://wheelmetrics.io/blog/options-fundamentals-complete-guide/

**Books & course roundups**
- Investopedia — Best Options Trading Courses (Jun 2026) — https://www.investopedia.com/the-best-options-trading-courses-11705486
- StockAnalysis — 7 Best Options Trading Courses 2026 — https://stockanalysis.com/article/best-options-trading-courses/
- Investopedia — 6 Best Books to Become an Options Trader — https://www.investopedia.com/articles/personal-finance/090716/top-5-books-become-option-trader.asp
- Benzinga — Best Options Trading YouTube Channels — https://www.benzinga.com/money/best-options-trading-youtube-channels

*Research compiled June 2026. All resources, pricing, subscriber counts, and volume figures are current as of the cited 2025–2026 sources and may change. This document is for product research only and is not investment advice.*
