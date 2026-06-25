# Educational Research: How Amateur Traders Learn Stocks & Options

**Compiled:** June 24, 2026
**Purpose:** Map the 2025–2026 landscape of resources amateur/beginner traders actually use to learn stock and options trading, to inform the design of our trading/options **education app**.

This research was gathered by 10 parallel web-research agents, each covering one category of how beginners learn. This README is the synthesis; the numbered files are the deep dives.

---

## Contents

| # | File | Category |
|---|------|----------|
| 1 | [`01-online-courses.md`](01-online-courses.md) | Online courses & structured learning platforms |
| 2 | [`02-youtube-creators.md`](02-youtube-creators.md) | YouTube channels & video creators |
| 3 | [`03-books.md`](03-books.md) | Books & reading materials |
| 4 | [`04-communities-forums.md`](04-communities-forums.md) | Reddit, Discord, StockTwits, FinTwit, forums |
| 5 | [`05-simulators-practice.md`](05-simulators-practice.md) | Paper trading & practice tools |
| 6 | [`06-broker-education.md`](06-broker-education.md) | Brokerage education hubs |
| 7 | [`07-options-education.md`](07-options-education.md) | Options-specific education |
| 8 | [`08-podcasts-newsletters.md`](08-podcasts-newsletters.md) | Podcasts & newsletters |
| 9 | [`09-apps-gamified.md`](09-apps-gamified.md) | Mobile apps & gamified learning (direct competitors) |
| 10 | [`10-paid-mentorships-and-scams.md`](10-paid-mentorships-and-scams.md) | Paid mentorships, trading rooms & scam cautions |

---

## How a typical beginner actually learns (the real funnel)

The research consistently shows beginners do **not** start with structured courses. They move through a loose, social, free funnel:

1. **Discovery** — short-form video (YouTube Shorts, TikTok, Reels) and a finfluencer or two. Hype-driven, high misinformation.
2. **Community on-ramp** — they join Reddit (r/options, r/wallstreetbets, r/Daytrading) and/or a Discord *before* any formal study. They absorb vocabulary, norms, and strategies socially.
3. **Free top-of-funnel media** — podcasts (passive) and a daily-digest newsletter (habit) keep them engaged.
4. **Free structured content** — Babypips, Khan Academy, broker academies (IBKR, Schwab, Fidelity), and options-specific free curricula (OIC/Cboe, tastylive, Option Alpha).
5. **Practice** — a paper-trading simulator (thinkorswim paperMoney, Webull, Investopedia).
6. **Monetization point** — many then pay for *community + live trading rooms + alerts + accountability* (not video), or buy a high-ticket course. **This is where most of the harm and money-loss happens.**

**Implication:** an education app is competing against "free + social," so it must win on **structure, practice, personalization, trust, and a clear path to competence** — not on simply "explaining" concepts.

---

## Cross-cutting themes (the conclusions that showed up everywhere)

### 1. The free tier is genuinely excellent now
Babypips, Khan Academy, Zerodha Varsity, broker academies, OIC/Cboe, tastylive, Option Alpha, and the free online *Options Playbook* mean **information is no longer scarce**. Reviewers repeatedly note there is *"no bridge from watching videos to placing trades."* **The differentiator is pedagogy and the theory→practice loop, not content.**

### 2. The industry runs on a trust deficit that regulators actively punish
- FTC: **Warrior Trading ($3M)**, **RagingBull ($2.425M)**, **Online Trading Academy ($362M)** for deceptive earnings claims.
- SEC/DOJ: **Atlas Trading Discord** influencers, ~$100M+ pump-and-dump.
- FTC action against **IM Mastery/IYOVIA** (~$1.2B MLM-style "academy").
- **Robinhood** gamification → SEC/FINRA scrutiny + ~$7.5M MA settlement.
- **"Verified" track records are meaningless when the seller owns the verifier** (Tim Sykes / Profit.ly).

**Honesty is therefore a product feature**, not just ethics. Leading with realistic odds and transparent results (wins *and* losses) is a wedge competitors structurally can't copy.

### 3. The base rate is brutal — and hidden from buyers
Across ~25 years and 8 countries of research, **~70–97% of day traders lose money** (≈97% of those who persist 300+ days, net of fees). Almost every paid product sells the opposite dream. A credible app should teach *risk literacy and realistic expectations* first.

### 4. Gamification is powerful but double-edged
- Upside: an RCT found in-game behavioral pop-ups roughly **doubled** learning gains (~0.5 SD); gamification lifts retention ~30–40%.
- Downside: points-for-trading drove **~39% more trades**; "top traded" lists increased herding; Robinhood-style mechanics drew regulatory action.
- **Rule:** gamify **learning and risk discipline** (streaks, lesson milestones, plan-adherence, risk-adjusted leaderboards) — **never trade frequency or raw P&L.**

### 5. Practice has an emotional-realism gap
Paper trading validates your *logic/idea*; live trading validates your *behavior* (fear/greed). Sim skills only transfer ~70%. Reframe simulation honestly, and grade **process, not P&L**.

### 6. Options is the category-wide blind spot
- Gamified beginner apps (Finelo, Bloom, Fingo, Zogo, Invstr, Seeds, Khan) mostly **avoid options**.
- Tools that teach options well are either **intimidating pro sims** (thinkorswim, Webull) or **academic, non-gamified utilities** (OptionStrat, OptionsPlay, OptionsPractice).
- Beginners fail on the same invisible concepts every time: **the Greeks, implied volatility / IV crush, theta decay, assignment, position-sizing math.** The best teachers use payoff diagrams, probability framing (POP, Rule of 16), and analogies (theta = melting ice cube, IV crush = balloon deflating).
- Structural trends: **0DTE options are now ~50–60% of SPX volume**, and **premium-selling "theta gang"** strategies (the wheel, cash-secured puts, covered calls, credit spreads) are the default beginner mental model.

---

## The market gap → our opportunity

**No competitor combines all four winning traits at once:**

1. **Duolingo-grade gamification** (of *learning*, not trading)
2. **A genuinely deep, sequenced options curriculum**
3. **A realistic, tightly-coupled option-chain simulator** (lessons → practice → feedback)
4. **A compliant/guardrailed AI tutor that grades *process*, not P&L**

Every existing player has at most two of the four. Combined with the collapse of trusted brands (Investopedia Academy shut down in 2024) and the regulatory beating the predatory players have taken, the clear white space is:

> **"The Brilliant / Duolingo for options"** — mobile-first, conceptually rigorous, interactive, options-deep, with honest pricing and radical transparency about risk and odds.

### Concrete product principles distilled from the research
- **Bridge the theory→execution gap** with one idea per module → interactive visualization → simulated trade → feedback.
- **Make the invisible visible:** drag-the-strike payoff graphs, scrub-time theta decay, slide-IV crush — with real data and exact math.
- **Lead with risk management and realistic expectations**, not profit fantasies.
- **Gamify discipline:** streaks, mastery, journaling, plan-adherence, risk-adjusted (not P&L) leaderboards.
- **Keep the social belonging, remove the gambling:** healthier community + media-literacy training so users can navigate WSB/FinTwit safely.
- **Earn trust structurally:** transparent results, easy cancellation, no earnings hype, no lifestyle/lambo marketing, no signal-selling, no MLM mechanics.
- **Respect the three learning intents** as separate tracks: build-wealth-slowly, understand-options, and day-trading/technical-analysis.
- **Use bite-sized daily content** (podcast/newsletter-style) to build the habit loop at the top of the funnel.

---

## Notable factual flags for the product team
- **Investopedia Academy is discontinued (since June 2024)** despite still appearing in listicles — a trusted-brand vacuum.
- **IG Group acquired tastytrade** largely for its content/education engine — validation that education drives brokerage growth.
- **Zerodha "Varsity"** proves free, product-agnostic education can scale a brokerage at near-zero CAC.

---

*Each linked file contains full detail: named resources with URLs, pricing, skill levels, credibility notes, comparison tables, and cited sources.*
