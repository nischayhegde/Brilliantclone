# Online Communities & Forums Where Beginner Traders Learn (2025–2026)

*Research brief for the product team building a trading / stock / options **education** app.*

---

## Introduction

Most beginners today do not learn to trade from a textbook or a broker — they learn from **other people online**. Before (and often instead of) reading a single page of formal education, a new trader joins a subreddit, follows a few accounts on X, lurks in a Discord, or scrolls cashtags on StockTwits. These communities are where curiosity is sparked, where jargon is decoded, where strategies spread, and — critically — where a great deal of misinformation, hype, and outright fraud also circulates.

For an education app, these communities are simultaneously the **competition, the funnel, and the cautionary tale**. They prove there is enormous appetite for *social, real-time, "learn-alongside-others" trading education*. They also reveal what goes wrong when engagement, gambling psychology, and unverified "gurus" drive the experience instead of pedagogy. This document maps the landscape as of 2025–2026 and ends with concrete implications for building a *healthier* community-learning experience.

> **Scope note:** Membership numbers are approximate, drawn from public stat trackers, the platforms themselves, and secondary reporting (see Sources). They change constantly and should be treated as order-of-magnitude, not precise.

---

## 1. Reddit — The Default First Stop

Reddit is, for most English-speaking beginners, the entry point into trading culture. It is free, searchable, pseudonymous, has deep archives ("the wiki and top posts of all time"), and spans the full spectrum from sober long-term investing to outright degenerate gambling. The downside: quality varies wildly by subreddit, advice is unvetted, and the most *entertaining* subs are the *worst* for learning.

### 1.1 The major trading/investing subreddits

| Subreddit | ~Size (2025–26) | What it's for | Culture | Beginner-friendly? | Info quality |
|---|---|---|---|---|---|
| **r/wallstreetbets** | ~20M | High-risk options/meme-stock bets, entertainment | Gambling, memes, "YOLO," "loss porn," irony | **No** — entertainment, not education | Low for learning |
| **r/stocks** | ~8–9M | General stock discussion, earnings, long-term ideas | More traditional, buy-and-hold leaning | Moderate | Medium–High (high "signal") |
| **r/Daytrading** | ~5M | Intraday strategies, P&L, technicals, psychology | Mixed; many beginners, many blow-up stories | Moderate (cautionary) | Mixed |
| **r/StockMarket** | ~2–4M | Market news, analysis, opinions on tickers | Mix of DD and noise | Moderate | Mixed |
| **r/investing** | ~3–3.4M | Broad investing: stocks, bonds, ETFs, retirement | Thoughtful, long-term, rules-heavy | Yes (for investing, not trading) | High (high "signal") |
| **r/options** | ~1.4M | Options fundamentals, the Greeks, strategy, Q&A | Strategy-focused, well-moderated | Yes — has "Options Questions Safe Haven" weekly thread | High |
| **r/thetagang** | ~330K | Income/premium-selling (covered calls, wheel, cash-secured puts) | Niche, disciplined, "collect premium" | Yes for income strategy, but conceptually advanced | High (focused) |
| **r/investingforbeginners** | ~600K | Absolute basics, account types, index funds | Welcoming, "no dumb questions" | **Yes** — purpose-built for newcomers | High (high "signal") |
| **r/StocksAndTrading**, **r/OptionsMillionaire**, **r/options_trading** | ~240K and smaller | Overflow/adjacent communities | Varies | Varies | Varies |

**Notable growth signals:** r/wallstreetbets added roughly ~1M members in a year; r/options grew ~9%/yr; r/thetagang grew ~17%/yr; r/Daytrading and r/investing each added hundreds of thousands — community interest is *expanding*, not shrinking.

### 1.2 What this means for beginners

- **r/options** is the most consistently recommended sub for someone who genuinely wants to *learn* options: well-moderated, with a dedicated weekly safe-haven thread for new traders, a wiki, and strategy-first discussion.
- **r/investing** and **r/investingforbeginners** are the safest places for foundational, long-horizon literacy.
- **r/thetagang** is excellent but really about a *specific* strategy family (selling premium); beginners often arrive before they understand assignment risk.
- **r/wallstreetbets** is where most beginners *first hear about* options — usually as lottery tickets. It's culturally magnetic and educationally toxic: a place to absorb vocabulary and vibes, not method.

### 1.3 Why beginners join Reddit
Free, anonymous, searchable, huge archive of "lessons learned" and "mistakes" threads, real humans answering questions, and a sense that you can lurk indefinitely before participating. A commonly recommended beginner path: *Week 1 — read the r/options wiki + top posts; Week 2 — study the r/thetagang wheel strategy; Week 3 — search "mistakes"/"lessons learned"; Week 4 — start asking questions.*

### 1.4 Risks on Reddit
- **Survivorship bias & "gain porn":** wins are screenshotted and upvoted; the silent majority of losses is invisible (except ironically in WSB's "loss porn").
- **Pump dynamics:** coordinated hype around low-float/meme tickers.
- **Bad advice presented confidently** by anonymous users with no track record.
- **WSB's gambling normalization** (see §6).

---

## 2. r/wallstreetbets as a Cultural Phenomenon (deep dive)

WSB deserves separate treatment because it shaped the entire modern retail-trading vernacular (and arguably the GameStop short squeeze of 2021). Academic researchers (Penn State, NSF-funded HCI studies, and others) have studied it directly.

- **The "YOLO" flair** requires staking **≥$10,000 in options or ≥$25,000 in equity** on a high-risk trade — frequently options expiring within days. Researchers describe these posts as "the most extreme form of gambling" on the platform.
- **Vocabulary as identity:** "stonks," "apes," "degenerates," "diamond hands," "tendies," "this is a casino." Self-deprecating, ironic, communal.
- **Loss porn** (celebrating catastrophic losses) and **mutual support** ("I also lost all my savings, we have each other brother") create genuine belonging — which is exactly what makes the high-risk behavior *sticky*.
- **Documented harm:** reporting describes day-trading/meme-stock **addiction** mirroring gambling disorder, with traders entering rehab; a 2025 meme-stock resurgence (Kohl's, Opendoor, GoPro, Krispy Kreme) renewed concern. Young people are flagged as especially vulnerable.

**Takeaway for an education app:** WSB proves *community + identity + shared language* is the strongest engagement engine in retail trading — and that the same engine, pointed at gambling, produces real financial and psychological harm. The opportunity is to harness the belonging while replacing the gambling incentive with skill progression.

---

## 3. Discord — Real-Time Rooms, Often Tied to Creators/Courses

Discord is where trading communities become **live and real-time**: alert channels, voice "live trading" sessions, watchlists, education channels, and chat. Most notable servers are **monetized** and frequently attached to a YouTuber, TikTok/X "finfluencer," or paid course.

### 3.1 The landscape

- **Pricing:** premium options-trading servers commonly run **~$47 to ~$224+ per month** (some annual/lifetime tiers). A free tier almost always exists as a funnel.
- **Free + premium funnel** is the dominant model: a free server builds trust and captures leads; the paid server sells "exclusive" signals, strategies, indicators, and mentorship.
- **Structure that signals quality:** separate channels for alerts vs. education vs. discussion; documented wins **and** losses; clear trade rationale (entry, target, stop, thesis); risk reminders and recaps; an active, moderated community.

### 3.2 Representative servers (illustrative, not endorsements)

| Server (examples) | Model | Notes |
|---|---|---|
| Stock Dads, Alpha Market Pro, Panda Options, TheDailyTraders, Cash Flow University | Mostly paid | Frequently cited "top options Discords"; mentorship + alerts + education |
| Low Key Stonks (~30K+, Discord Partner) | Mixed | Multi-asset (options, stocks, futures, crypto) |
| RawStocks, Royal Trading Academy, EmmanuelTrades University | Paid | Education-forward, beginner Q&A, "nurturing environment" branding |
| Ironheart Capital | **Free** | "100% free," alerts + weekly streams + classes (ICT, risk mgmt, TA); markets wins of "600%+, 1000%+ runners" — note the hype framing |

### 3.3 Beginner-friendliness
The *best* Discords are genuinely strong learning environments: structured curricula, live examples, real-time Q&A, and the ability to "lurk" on the free tier first. The *worst* are alert-pinging hype machines that train beginners to **react to signals rather than understand them** — and to feel FOMO when a pinged trade "runs."

### 3.4 Risks on Discord
Scam red flags are well-documented and common: guaranteed profits, pressure to act *now*, brand-new admin accounts, hidden channels, off-platform links, "double your money" offers, and requests for wallet keys or DMs. Standard safety guidance: join the free tier, stay **read-only** for the first week, Google the server/admins, and never trust performance claims without verification.

---

## 4. StockTwits — "Twitter for Tickers"

- **What it is:** a social network built *exclusively* for markets. Organized around **cashtags** (e.g., `$AAPL`), each with its own real-time stream, news feed, and crowd **sentiment** (bullish/bearish tags). **~10M+ users.**
- **Free** to use, with premium features and "Rooms" moderated by experienced traders.
- **Best for:** gauging real-time **sentiment** and momentum, tracking what's "trending," following a specific ticker's chatter. Increasingly layered with **AI** that surfaces trending names and sentiment shifts.
- **Beginner angle:** very low barrier, familiar Twitter-like UI, and a mix of newbies, active traders, and some pros "rubbing virtual elbows." Useful for *feeling* the market and learning the vocabulary.
- **Risks:** community-driven and **unverified**. Heavy noise, promotion of low-floats, and sentiment that can be manufactured. Universally caveated as "do your own due diligence — this is social sentiment, not advice." Best treated as a *sentiment instrument*, not a learning curriculum.

---

## 5. X / Twitter "FinTwit" — Fast, Influential, Unfiltered

"FinTwit" (Financial Twitter) is not an app or a membership — it's the finance **corner of X**, defined entirely by who you follow. It's where market-moving information, hot takes, charts, and macro debate flow *faster than mainstream media*.

### 5.1 The good
- Access to genuinely expert niche knowledge (sectors, macro, specific strategies) **for free**.
- Real-time awareness around news, earnings, and catalysts.
- Diversity of viewpoints: long-term investors, day/swing traders, macro accounts, educators, journalists, and pure entertainment/hype accounts.

### 5.2 The structural problem: engagement ≠ accuracy
- The algorithm **rewards engagement** (likes, RTs, replies) — which systematically favors **sensational, extreme, overconfident** takes. *"Apple will 10x because of AI"* outperforms a careful, data-rich thread by orders of magnitude.
- **No accountability infrastructure:** anyone can claim any track record; past "calls" can be cherry-picked or backdated; the most-followed accounts are **not** the most accurate.
- **Misinformation outruns correction:** false claims spread faster and reach more people than the later fix. **Survivorship bias** makes everyone look more successful than they are.

### 5.3 Beginner guidance commonly given
Use FinTwit to *discover topics worth researching* and to *gauge sentiment* — **not** as a source of trade signals. Curate hard (lists, muting), verify every factual claim against primary sources, be extremely cautious of micro-cap/penny promotions, and favor accounts that post **both wins and losses**. "Treat it like a noisy room — useful, but not authoritative." Most casual users, researchers note, end up using it as a time-consuming misinformation source rather than a disciplined sentiment tool.

---

## 6. Traditional Forums — Still Alive, Older & Deeper

The classic web-forum format predates Reddit and remains active, skewing older, more serious, and more long-form.

| Forum | URL | Scale (2025–26) | Character |
|---|---|---|---|
| **Elite Trader** | elitetrader.com | ~120K–128K members, ~290K+ threads, **5M+ posts** | Serious/professional lean; futures, options, prop, broker talk; long archives; can be blunt/cynical |
| **Trade2Win** | trade2win.com | ~273K members, ~110K threads, ~1.8M posts (since 2001) | UK's leading retail trading forum; brokers, systems, strategies |

- **Activity note:** thousands of *guests* browse at any time, but the share of *logged-in active members* is small — these are increasingly **archive/reference** resources and slower-moving discussion than Reddit/Discord. New members still register monthly.
- **Beginner value:** deep, searchable history of strategy debates and broker reviews; less hype than social feeds. **Downside:** dated UX, smaller live community, and old threads can contain stale or contradictory advice.

---

## 7. Newer Platforms & The "Social/Copy/Gamified" Wave

A fast-growing category blends **community + paper trading + copy trading + gamification + creator monetization**. This is the most direct analog to (and competition for) a modern education app.

### 7.1 Creator-economy hubs — **Whop**
Whop has become the dominant marketplace for monetized communities, and **trading is its #1 category**:
- Trading products generate an estimated **~$17.3M/month** on Whop — *more than the next four categories combined*; trading is ~18% of all products.
- **Free + premium** is the playbook (free products average ~18x more members than paid). Example: **TJR Trades** grew a **free** community to **180K+ members** across multiple paid tiers; runs live trading, courses, mentorship, and a "clipper"/affiliate machine.
- Built-in apps: **Courses** (video lessons, PDFs, quizzes — "Options/Futures 101," "Trading Psychology," "Strategy Breakdown"), **Events** (live sessions/webinars), **TradingView indicator** sales, and **affiliate programs** (87% of products enable them, ~30% commission standard).
- **Implication:** the market has *already proven* people will pay for structured, community-wrapped trading education. The weakness is that quality and credibility are uneven and incentives favor selling, not learning outcomes.

### 7.2 Social investing / signal-tracking apps — **StockTwits, NVSTly**
- **NVSTly** (~45K+ community): track/share/copy trades with **verified, real-time** performance stats (trades "cannot be faked"), leaderboards, Discord integration, multi-asset. The "verified track record" angle directly attacks FinTwit's accountability gap.

### 7.3 Social paper-trading & "trade alongside friends" — **PodTrade, Trade Social, Arthhwise, WOO X "Demo Copy"**
This is the most education-aligned cluster and worth studying closely:
- **PodTrade** — friend groups share **one virtual $100K portfolio**; members **propose trades and the pod votes**; AI analyst; leaderboards; "educational purposes only, not financial advice." Frames trading as a *team sport*.
- **Trade Social** — explicitly **"100% educational simulation"**; $5K virtual funds, real market data, solo (free) + group (paid ~$7.99/mo) modes, group chat, milestone bonus funds. "Built for collaborative education, not speculation."
- **Arthhwise** (India) — paper trading + **daily contests, leaderboards**, social following/copying; pitch: "wraps real market learning inside a competitive, social trading game" because "textbooks are dry." Explicitly leans on *learning-by-doing in competitive settings → faster skill development*.
- **WOO X "Demo Copy"** — zero-cost **simulated copy trading**: practice mirroring top traders with virtual funds to "build confidence before committing real capital."

**Pattern:** the newest entrants combine **safe simulation + social accountability + light gamification + learn-by-doing**. That is essentially the healthy version of what WSB/Discord do with real money — *if* the gamification rewards process and learning rather than reckless P&L.

---

## 8. Cross-Platform Comparison

| Platform | Cost | Real-time? | Beginner-friendly | Info quality | Primary risk | Best use for a beginner |
|---|---|---|---|---|---|---|
| Reddit (r/options, r/investing) | Free | No | High | Medium–High | Unvetted advice, survivorship bias | Foundational learning, Q&A, "mistakes" archives |
| Reddit (r/wallstreetbets) | Free | No | Low | Low (for learning) | Gambling normalization, FOMO | Cultural literacy only — *not* method |
| Discord (paid rooms) | $0–$224+/mo | **Yes** | Mixed | Mixed | Scams, signal-chasing, hype | Live examples *if* education-forward & transparent |
| StockTwits | Free (+premium) | Yes | High | Low–Medium | Noise, manufactured sentiment, pumps | Sentiment/momentum gauge, ticker chatter |
| X / FinTwit | Free | **Yes** | Low–Medium | Low–Medium | Engagement-driven hype, misinformation | Topic discovery + sentiment, never signals |
| Elite Trader / Trade2Win | Free | No | Moderate | Medium | Stale/contradictory threads, dated UX | Deep reference, broker/strategy research |
| Whop communities | Free + premium | Yes | Mixed | Mixed | Sales incentives, unvetted gurus | Structured courses *if* creator is credible |
| Social paper-trade apps | Free + premium | Yes | **High** | N/A (simulated) | Over-gamification → bad habits | Risk-free practice with peers |

---

## 9. Risks & Harms — The Evidence Base

A product team building *education* should be able to cite why the status quo is dangerous:

- **Most active traders lose money.** Across ~30 peer-reviewed studies in 8 countries (1999–2025), **70–97% of day traders lose money**; the landmark Taiwan study found **<1%** earn predictably positive returns net of fees; a Brazilian futures study found **97%** of those who persisted 300+ days lost money. UK regulators *require* CFD brokers to disclose loss rates — currently **~71–79%** of retail clients lose.
- **Finfluencer advice underperforms.** A Utrecht University study of 400+ recommendations from 21 finfluencers (2018–2022) found their stock picks returned **~1% below market**, crypto picks **~2% below**; many act as "noise traders" recommending assets that have already peaked. Followers are also more exposed to fraud.
- **Pump-and-dump & market manipulation.** IOSCO (global securities regulators) flags finfluencer-driven pump-and-dumps, scalping, and routing followers to **unlicensed/fake platforms** — accelerated by social media's speed and reach, especially in crypto, forex, and CFDs.
- **Gamification harms.** IOSCO and the Ontario Securities Commission (OSC) document that **Digital Engagement Practices** — points for trading, leaderboards, "top traded" lists, push notifications, contests, time-limited bonuses, "gambling-style" promotions — measurably **push retail investors to trade more, herd, and take risks they'd otherwise avoid**, often against their own interest. Regulators (SEC, FCA, OSC, ESMA) increasingly treat these as conduct issues.
- **Addiction & mental health.** Academic and clinical reporting links meme-stock/day-trading communities to **gambling-style addiction**, compulsive monitoring, chasing losses, and use of credit/loans — with young people most vulnerable.

---

## 10. Key Trends & Takeaways

1. **Community *is* the on-ramp.** For most beginners, social discovery now *precedes* formal education. People learn vocabulary, strategies, and norms socially — then maybe seek structured content. An education app that ignores the social layer is fighting the actual user behavior.

2. **"Trading alongside others" is the core emotional pull.** Belonging, shared language, mutual support in wins *and* losses, and live "we're all in this together" energy are what make these communities sticky (WSB, Discord live rooms, PodTrade "pods"). This is a feature to *replicate*, not avoid.

3. **Gamification & social proof are double-edged.** Leaderboards, streaks, badges, "top traded," and visible wins drive engagement — but regulators have shown the *same mechanics* push harmful overtrading and risk-taking. The design question is **what behavior gets rewarded**: reckless P&L (harmful) vs. skill mastery, good process, and risk discipline (healthy).

4. **The misinformation/accountability gap is the central failure.** No verified track records, engagement algorithms rewarding sensationalism, survivorship bias, and unlicensed "gurus" selling signals. The single biggest *trust* opportunity is **verified, transparent, outcome-honest information** (note how NVSTly's "trades can't be faked" and academic loss-rate data directly target this gap).

5. **Free-to-premium creator monetization is the dominant business model** (Whop, Discord, Patreon-style). It works commercially but optimizes for *selling*, not *learning outcomes* — leaving room for a product whose incentives are aligned with the learner.

6. **Simulation + social + learn-by-doing is the emerging "healthy" pattern.** The newest apps (Trade Social, PodTrade, Arthhwise, WOO X Demo Copy) point the way: practice risk-free, with peers, in a game-like loop — the constructive inverse of WSB-with-real-money.

### What an education app could do for a *healthier* community-learning experience

- **Keep the belonging, drop the gambling.** Cohorts / "pods" / study groups that learn and practice **together** (à la PodTrade/Trade Social) — social accountability without real-money YOLO incentives.
- **Default to simulation.** Risk-free paper trading with real data as the *primary* sandbox, so mistakes are free and lessons are immediate.
- **Gamify process, not P&L.** Reward completing lessons, journaling rationale, setting stops, managing risk, and *demonstrating understanding* — not raw returns or biggest wins. Avoid "top traded" lists and dopamine-mining push notifications that regulators flag as harmful.
- **Build accountability infrastructure.** Verified, timestamped track records; show **both wins and losses**; surface base rates (e.g., "most day traders lose money") honestly instead of hiding them.
- **Teach media literacy as curriculum.** Explicitly coach users on how to use Reddit/FinTwit/Discord/StockTwits *safely* — spotting pump-and-dumps, scam red flags, survivorship bias, and engagement-vs-accuracy — turning the existing ecosystem into a teachable object.
- **Moderate for learning, not hype.** Structured channels (education vs. discussion), expert/mentor Q&A, "no dumb questions" norms (like r/investingforbeginners and the r/options safe-haven thread), and zero tolerance for guaranteed-returns/signal-selling.
- **Guard mental health.** Friction and cool-downs around compulsive behavior, loss-context framing, and resources for problem-gambling — proactively, given the documented addiction risks.

---

## Sources

**Reddit (sizes, culture, beginner value)**
- GummySearch — r/wallstreetbets stats: https://gummysearch.com/r/wallstreetbets/
- GummySearch — r/options stats: https://gummysearch.com/r/options/
- GummySearch — r/thetagang stats: https://gummysearch.com/r/thetagang/
- GummySearch — r/Daytrading stats: https://gummysearch.com/r/Daytrading/
- OptionsPilot — "Start Options Trading: What Reddit Gets Right (and Wrong)": https://optionspilot.app/blog/start-options-trading-reddit-advice
- Global One Media — "Top 10 Investing Subreddits to Join in 2025": https://globalonemedia.com/blog/top-10-investing-subreddits-in-2025/
- The Hive Index — r/investing: https://thehiveindex.com/communities/r-investing/
- FinSignals — Finance Subreddit Directory: https://finsignals.ai/subreddits/
- FATFIRE — "Reddit's Beginner Guide to Smart Investing": https://fatfire.com/how-to-start-investing-reddit/
- BestSubreddits — "Top Stock Market Subreddits": https://www.bestsubreddits.com/top-stock-market-subreddits-invest-with-reddit/

**r/wallstreetbets culture & gambling research**
- NSF/PAR — "Trading as Gambling: Social Investing and Financial Risks on r/WallStreetBets": https://par.nsf.gov/servlets/purl/10523799
- Sage / Social Media + Society — "YOLO Publics": https://journals.sagepub.com/doi/10.1177/20563051231177953
- Penn State — "Wall Street meets Reddit: upsides and risks of social investing": https://www.psu.edu/news/research/story/wall-street-meets-reddit-what-are-upsides-and-risks-social-investing
- Business Insider / Markets Insider — trading-addiction rehab reporting: https://markets.businessinsider.com/news/stocks/stock-market-retail-investors-trading-addiction-wallstreetbets-gambling-rehab-2022-9
- GamblingHarm.org — "Meme Stock Trading Addiction": https://gamblingharm.org/meme-stock-trading-addiction-gamestop-gopro-krispy-kreme/

**Discord**
- Whop — "Top 20 best options trading Discord servers": https://whop.com/blog/options-trading-guide-discord-servers/
- Pro Trading Insights — "Discord Trade Alert Communities: What to Look For": https://protradinginsights.com/discord-trade-alert-communities-what-to-look-for-before-joining/
- EatHealthy365 — "How to Pick a Discord Trading Server": https://eathealthy365.com/a-guide-to-the-best-discord-trading-server/
- Ironheart Capital (Discord listing): https://discord.com/servers/ironheart-capital-1262102528934543380
- StartMoneyRoutes — "9 Red Flags in Discord Finance Channels": https://startmoneyroutes.com/article/how-to-spot-a-scam-9-red-flags-in-discord-finance-channels

**StockTwits**
- Stocktwits (official): https://stocktwits.com/
- OptionsTradingIQ — "StockTwits Review": https://optionstradingiq.com/stocktwits-review/
- The Smart Investor — "StockTwits Review (Free Plan) 2025": https://thesmartinvestor.com/investing/stocktwits-review-free-plan/
- Warrior Trading — "StockTwits Review": https://www.warriortrading.com/stocktwits-review/
- Business Diary — "Stocktwits: What You Need To Know": https://businessdiary.com.ph/29043/stocktwits-what-you-need-to-know/

**FinTwit / X**
- Pomegra — "FinTwit and X for investors": https://pomegra.io/learn/library/track-a-foundations/financial-news-literacy/chapter-01-the-media-ecosystem/fintwit-twitter-x-finance
- Pomegra — "FinTwit Overview for Investors": https://pomegra.io/learn/library/track-a-foundations/financial-news-literacy/chapter-11-twitter-x-investors/fintwit-overview
- Pomegra — "FinTwit engagement traps and performative trading": https://pomegra.io/learn/library/track-a-foundations/financial-news-literacy/chapter-11-twitter-x-investors/fintwit-engagement-traps
- Calibr — "What is Fintwit?": https://calibr.trading/learn/what-is-fintwit
- AlphaEx Capital — "Fin Twit Explained": https://www.alphaexcapital.com/tools/fintwit

**Traditional forums**
- Trade2Win: https://www.trade2win.com/
- Elite Trader: https://www.elitetrader.com/et/

**Newer platforms (creator economy, social/copy/gamified)**
- Whop — "How to start a trading community": https://whop.com/blog/start-a-trading-community/
- Whop — "Catching up with TJR": https://whop.com/blog/tjr-trades/
- Whop — "Top 18 trading whops": https://whop.com/blog/top-trading-whops/
- WhopLens — "The State of Whop: 2026 Marketplace Analytics Report": https://whoplens.com/blog/whop-marketplace-analytics-2026
- NVSTly (App Store): https://apps.apple.com/us/app/nvstly-social-investing/id6475617649
- PodTrade: https://podtrade.com/
- Trade Social: https://tradesocial.app/
- Arthhwise: https://arthhwise.com/
- WOO X "Demo Copy" (GlobeNewswire): https://www.globenewswire.com/news-release/2025/07/04/3110172/0/en/Demo-Copy-now-available-on-desktop-Start-copying-Lead-Traders-in-a-simulated-trading-environment.html

**Risk / harm evidence (losses, finfluencers, gamification, regulators)**
- Banana Farmer — "Day Trading Failure Rate: 30 Studies, 8 Countries, 70 to 97%": https://bananafarmer.app/research/day-trading-failure-rate
- The Investors Centre — "UK Day Trading Statistics 2026: Loss Rates & FCA Data": https://www.theinvestorscentre.co.uk/trading/statistics/day-trading/
- CNBC — "Most day traders lose money": https://www.cnbc.com/2020/11/20/attention-robinhood-power-users-most-day-traders-lose-money.html
- Medium (F. Haroon) — "25 Years of Day-Trading Research": https://medium.com/@faisal_haroon/i-reviewed-every-major-day-trading-study-from-the-last-25-years-the-data-is-devastating-4b116273b956
- Coinfomania — "Finfluencers Are Losing You Money" (Utrecht University study): https://coinfomania.com/finfluencers-are-losing-you-money-heres-the-proof/
- IOSCO — Retail conduct / DEPs report (PD777): https://www.iosco.org/library/pubdocs/pdf/IOSCOPD777.pdf
- IOSCO — Finfluencers / fraud & pump-and-dump (PD795): https://www.iosco.org/library/pubdocs/pdf/IOSCOPD795.pdf
- Investment Executive — "IOSCO tackles retail harm from online innovation": https://www.investmentexecutive.com/news/from-the-regulators/iosco-tackles-retail-harm-from-online-innovation/
- OSC Staff Notice 33-760 — Digital Engagement Practices (2025): https://www.osc.ca/sites/default/files/2025-10/sn_20251022_33-760_digital-engagement-practices_0.pdf
- OSC Staff Notice 11-796 — Gamification & Behavioural Techniques (2022): https://www.osc.ca/sites/default/files/2022-11/sn_20221117_11-796_gamification-report.pdf

*Research compiled June 2026. Membership figures and pricing are approximate and change frequently.*
