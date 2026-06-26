/**
 * Static, curated instrument metadata for the Practice corpus universe (scripts/universe.mjs).
 *
 * This is REAL, offline reference data — company/fund name + sector — used only to give the
 * learner factual background about what they're trading. It is NEVER model-generated and never
 * feeds the math. Unknown tickers degrade gracefully (the context panel just omits name/sector).
 *
 * Sectors use plain GICS-style labels; ETFs/ETNs carry a short fund category instead.
 */
export interface InstrumentInfo {
  name: string
  sector: string
}

export const INSTRUMENTS: Record<string, InstrumentInfo> = {
  // --- Broad-market & style ETFs ---
  SPY: { name: 'SPDR S&P 500 ETF Trust', sector: 'ETF · US Large Cap' },
  QQQ: { name: 'Invesco QQQ Trust', sector: 'ETF · US Tech (Nasdaq-100)' },
  IWM: { name: 'iShares Russell 2000 ETF', sector: 'ETF · US Small Cap' },
  DIA: { name: 'SPDR Dow Jones Industrial Average ETF', sector: 'ETF · US Large Cap' },
  VTI: { name: 'Vanguard Total Stock Market ETF', sector: 'ETF · US Total Market' },
  VOO: { name: 'Vanguard S&P 500 ETF', sector: 'ETF · US Large Cap' },
  RSP: { name: 'Invesco S&P 500 Equal Weight ETF', sector: 'ETF · US Large Cap' },
  MDY: { name: 'SPDR S&P MidCap 400 ETF', sector: 'ETF · US Mid Cap' },

  // --- Sector / thematic ETFs ---
  XLK: { name: 'Technology Select Sector SPDR Fund', sector: 'ETF · Technology' },
  XLF: { name: 'Financial Select Sector SPDR Fund', sector: 'ETF · Financials' },
  XLE: { name: 'Energy Select Sector SPDR Fund', sector: 'ETF · Energy' },
  XLV: { name: 'Health Care Select Sector SPDR Fund', sector: 'ETF · Health Care' },
  XLY: { name: 'Consumer Discretionary Select Sector SPDR Fund', sector: 'ETF · Consumer Discretionary' },
  XLP: { name: 'Consumer Staples Select Sector SPDR Fund', sector: 'ETF · Consumer Staples' },
  XLI: { name: 'Industrial Select Sector SPDR Fund', sector: 'ETF · Industrials' },
  XLU: { name: 'Utilities Select Sector SPDR Fund', sector: 'ETF · Utilities' },
  XLB: { name: 'Materials Select Sector SPDR Fund', sector: 'ETF · Materials' },
  XLRE: { name: 'Real Estate Select Sector SPDR Fund', sector: 'ETF · Real Estate' },
  XLC: { name: 'Communication Services Select Sector SPDR Fund', sector: 'ETF · Communication Services' },
  SMH: { name: 'VanEck Semiconductor ETF', sector: 'ETF · Semiconductors' },
  SOXX: { name: 'iShares Semiconductor ETF', sector: 'ETF · Semiconductors' },
  XBI: { name: 'SPDR S&P Biotech ETF', sector: 'ETF · Biotech' },
  KRE: { name: 'SPDR S&P Regional Banking ETF', sector: 'ETF · Regional Banks' },
  XRT: { name: 'SPDR S&P Retail ETF', sector: 'ETF · Retail' },
  ARKK: { name: 'ARK Innovation ETF', sector: 'ETF · Innovation / Growth' },
  IBB: { name: 'iShares Biotechnology ETF', sector: 'ETF · Biotech' },

  // --- Bonds / commodities / vol ETFs ---
  TLT: { name: 'iShares 20+ Year Treasury Bond ETF', sector: 'ETF · Long-Term Treasuries' },
  IEF: { name: 'iShares 7-10 Year Treasury Bond ETF', sector: 'ETF · Treasuries' },
  HYG: { name: 'iShares iBoxx $ High Yield Corporate Bond ETF', sector: 'ETF · High-Yield Bonds' },
  LQD: { name: 'iShares iBoxx $ Investment Grade Corporate Bond ETF', sector: 'ETF · Investment-Grade Bonds' },
  GLD: { name: 'SPDR Gold Shares', sector: 'ETF · Gold' },
  SLV: { name: 'iShares Silver Trust', sector: 'ETF · Silver' },
  USO: { name: 'United States Oil Fund', sector: 'ETF · Crude Oil' },
  UNG: { name: 'United States Natural Gas Fund', sector: 'ETF · Natural Gas' },
  VXX: { name: 'iPath Series B S&P 500 VIX Short-Term Futures ETN', sector: 'ETN · Volatility' },

  // --- International ETFs ---
  EEM: { name: 'iShares MSCI Emerging Markets ETF', sector: 'ETF · Emerging Markets' },
  EFA: { name: 'iShares MSCI EAFE ETF', sector: 'ETF · Developed Intl' },
  VEA: { name: 'Vanguard FTSE Developed Markets ETF', sector: 'ETF · Developed Intl' },
  VWO: { name: 'Vanguard FTSE Emerging Markets ETF', sector: 'ETF · Emerging Markets' },
  FXI: { name: 'iShares China Large-Cap ETF', sector: 'ETF · China' },

  // --- Mega-cap tech ---
  AAPL: { name: 'Apple Inc.', sector: 'Technology' },
  MSFT: { name: 'Microsoft Corp.', sector: 'Technology' },
  NVDA: { name: 'NVIDIA Corp.', sector: 'Technology' },
  AMZN: { name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
  GOOGL: { name: 'Alphabet Inc. (Class A)', sector: 'Communication Services' },
  GOOG: { name: 'Alphabet Inc. (Class C)', sector: 'Communication Services' },
  META: { name: 'Meta Platforms Inc.', sector: 'Communication Services' },
  TSLA: { name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
  AVGO: { name: 'Broadcom Inc.', sector: 'Technology' },

  // --- Semis ---
  AMD: { name: 'Advanced Micro Devices Inc.', sector: 'Technology' },
  INTC: { name: 'Intel Corp.', sector: 'Technology' },
  QCOM: { name: 'Qualcomm Inc.', sector: 'Technology' },
  TXN: { name: 'Texas Instruments Inc.', sector: 'Technology' },
  MU: { name: 'Micron Technology Inc.', sector: 'Technology' },
  AMAT: { name: 'Applied Materials Inc.', sector: 'Technology' },
  LRCX: { name: 'Lam Research Corp.', sector: 'Technology' },
  ADI: { name: 'Analog Devices Inc.', sector: 'Technology' },
  KLAC: { name: 'KLA Corp.', sector: 'Technology' },
  MRVL: { name: 'Marvell Technology Inc.', sector: 'Technology' },
  ON: { name: 'ON Semiconductor Corp.', sector: 'Technology' },
  SMCI: { name: 'Super Micro Computer Inc.', sector: 'Technology' },
  ARM: { name: 'Arm Holdings plc', sector: 'Technology' },

  // --- Software / cloud / security ---
  ORCL: { name: 'Oracle Corp.', sector: 'Technology' },
  ADBE: { name: 'Adobe Inc.', sector: 'Technology' },
  CRM: { name: 'Salesforce Inc.', sector: 'Technology' },
  NOW: { name: 'ServiceNow Inc.', sector: 'Technology' },
  INTU: { name: 'Intuit Inc.', sector: 'Technology' },
  SNPS: { name: 'Synopsys Inc.', sector: 'Technology' },
  CDNS: { name: 'Cadence Design Systems Inc.', sector: 'Technology' },
  PANW: { name: 'Palo Alto Networks Inc.', sector: 'Technology' },
  CRWD: { name: 'CrowdStrike Holdings Inc.', sector: 'Technology' },
  SNOW: { name: 'Snowflake Inc.', sector: 'Technology' },
  NET: { name: 'Cloudflare Inc.', sector: 'Technology' },
  DDOG: { name: 'Datadog Inc.', sector: 'Technology' },
  ZS: { name: 'Zscaler Inc.', sector: 'Technology' },
  PLTR: { name: 'Palantir Technologies Inc.', sector: 'Technology' },
  ANET: { name: 'Arista Networks Inc.', sector: 'Technology' },
  IBM: { name: 'International Business Machines Corp.', sector: 'Technology' },
  CSCO: { name: 'Cisco Systems Inc.', sector: 'Technology' },

  // --- Internet / media / comms ---
  NFLX: { name: 'Netflix Inc.', sector: 'Communication Services' },
  DIS: { name: 'The Walt Disney Co.', sector: 'Communication Services' },
  CMCSA: { name: 'Comcast Corp.', sector: 'Communication Services' },
  T: { name: 'AT&T Inc.', sector: 'Communication Services' },
  VZ: { name: 'Verizon Communications Inc.', sector: 'Communication Services' },
  TMUS: { name: 'T-Mobile US Inc.', sector: 'Communication Services' },
  ROKU: { name: 'Roku Inc.', sector: 'Communication Services' },
  SNAP: { name: 'Snap Inc.', sector: 'Communication Services' },
  PINS: { name: 'Pinterest Inc.', sector: 'Communication Services' },
  SPOT: { name: 'Spotify Technology S.A.', sector: 'Communication Services' },

  // --- Consumer internet / fintech / travel ---
  UBER: { name: 'Uber Technologies Inc.', sector: 'Industrials' },
  LYFT: { name: 'Lyft Inc.', sector: 'Industrials' },
  ABNB: { name: 'Airbnb Inc.', sector: 'Consumer Discretionary' },
  DASH: { name: 'DoorDash Inc.', sector: 'Consumer Discretionary' },
  SHOP: { name: 'Shopify Inc.', sector: 'Technology' },
  PYPL: { name: 'PayPal Holdings Inc.', sector: 'Financials' },
  COIN: { name: 'Coinbase Global Inc.', sector: 'Financials' },
  HOOD: { name: 'Robinhood Markets Inc.', sector: 'Financials' },
  BKNG: { name: 'Booking Holdings Inc.', sector: 'Consumer Discretionary' },
  MAR: { name: 'Marriott International Inc.', sector: 'Consumer Discretionary' },

  // --- China ADRs ---
  BABA: { name: 'Alibaba Group Holding Ltd.', sector: 'Consumer Discretionary' },
  PDD: { name: 'PDD Holdings Inc.', sector: 'Consumer Discretionary' },
  JD: { name: 'JD.com Inc.', sector: 'Consumer Discretionary' },
  NIO: { name: 'NIO Inc.', sector: 'Consumer Discretionary' },
  SE: { name: 'Sea Ltd.', sector: 'Communication Services' },
  MELI: { name: 'MercadoLibre Inc.', sector: 'Consumer Discretionary' },

  // --- Consumer staples & discretionary ---
  WMT: { name: 'Walmart Inc.', sector: 'Consumer Staples' },
  COST: { name: 'Costco Wholesale Corp.', sector: 'Consumer Staples' },
  HD: { name: 'The Home Depot Inc.', sector: 'Consumer Discretionary' },
  LOW: { name: "Lowe's Companies Inc.", sector: 'Consumer Discretionary' },
  NKE: { name: 'Nike Inc.', sector: 'Consumer Discretionary' },
  MCD: { name: "McDonald's Corp.", sector: 'Consumer Discretionary' },
  SBUX: { name: 'Starbucks Corp.', sector: 'Consumer Discretionary' },
  TGT: { name: 'Target Corp.', sector: 'Consumer Discretionary' },
  KO: { name: 'The Coca-Cola Co.', sector: 'Consumer Staples' },
  PEP: { name: 'PepsiCo Inc.', sector: 'Consumer Staples' },
  PG: { name: 'Procter & Gamble Co.', sector: 'Consumer Staples' },
  CL: { name: 'Colgate-Palmolive Co.', sector: 'Consumer Staples' },
  MDLZ: { name: 'Mondelez International Inc.', sector: 'Consumer Staples' },
  PM: { name: 'Philip Morris International Inc.', sector: 'Consumer Staples' },
  MO: { name: 'Altria Group Inc.', sector: 'Consumer Staples' },
  EL: { name: 'The Estée Lauder Companies Inc.', sector: 'Consumer Staples' },
  LULU: { name: 'Lululemon Athletica Inc.', sector: 'Consumer Discretionary' },
  CMG: { name: 'Chipotle Mexican Grill Inc.', sector: 'Consumer Discretionary' },
  YUM: { name: 'Yum! Brands Inc.', sector: 'Consumer Discretionary' },

  // --- Financials ---
  JPM: { name: 'JPMorgan Chase & Co.', sector: 'Financials' },
  BAC: { name: 'Bank of America Corp.', sector: 'Financials' },
  WFC: { name: 'Wells Fargo & Co.', sector: 'Financials' },
  C: { name: 'Citigroup Inc.', sector: 'Financials' },
  GS: { name: 'The Goldman Sachs Group Inc.', sector: 'Financials' },
  MS: { name: 'Morgan Stanley', sector: 'Financials' },
  BLK: { name: 'BlackRock Inc.', sector: 'Financials' },
  SCHW: { name: 'The Charles Schwab Corp.', sector: 'Financials' },
  AXP: { name: 'American Express Co.', sector: 'Financials' },
  V: { name: 'Visa Inc.', sector: 'Financials' },
  MA: { name: 'Mastercard Inc.', sector: 'Financials' },
  'BRK-B': { name: 'Berkshire Hathaway Inc. (Class B)', sector: 'Financials' },
  USB: { name: 'U.S. Bancorp', sector: 'Financials' },
  PNC: { name: 'The PNC Financial Services Group Inc.', sector: 'Financials' },
  COF: { name: 'Capital One Financial Corp.', sector: 'Financials' },
  SPGI: { name: 'S&P Global Inc.', sector: 'Financials' },
  CME: { name: 'CME Group Inc.', sector: 'Financials' },
  ICE: { name: 'Intercontinental Exchange Inc.', sector: 'Financials' },

  // --- Healthcare ---
  UNH: { name: 'UnitedHealth Group Inc.', sector: 'Health Care' },
  JNJ: { name: 'Johnson & Johnson', sector: 'Health Care' },
  LLY: { name: 'Eli Lilly and Co.', sector: 'Health Care' },
  PFE: { name: 'Pfizer Inc.', sector: 'Health Care' },
  MRK: { name: 'Merck & Co. Inc.', sector: 'Health Care' },
  ABBV: { name: 'AbbVie Inc.', sector: 'Health Care' },
  ABT: { name: 'Abbott Laboratories', sector: 'Health Care' },
  TMO: { name: 'Thermo Fisher Scientific Inc.', sector: 'Health Care' },
  DHR: { name: 'Danaher Corp.', sector: 'Health Care' },
  BMY: { name: 'Bristol-Myers Squibb Co.', sector: 'Health Care' },
  AMGN: { name: 'Amgen Inc.', sector: 'Health Care' },
  GILD: { name: 'Gilead Sciences Inc.', sector: 'Health Care' },
  CVS: { name: 'CVS Health Corp.', sector: 'Health Care' },
  MDT: { name: 'Medtronic plc', sector: 'Health Care' },
  ISRG: { name: 'Intuitive Surgical Inc.', sector: 'Health Care' },
  VRTX: { name: 'Vertex Pharmaceuticals Inc.', sector: 'Health Care' },
  REGN: { name: 'Regeneron Pharmaceuticals Inc.', sector: 'Health Care' },
  MRNA: { name: 'Moderna Inc.', sector: 'Health Care' },

  // --- Industrials ---
  BA: { name: 'The Boeing Co.', sector: 'Industrials' },
  CAT: { name: 'Caterpillar Inc.', sector: 'Industrials' },
  GE: { name: 'GE Aerospace', sector: 'Industrials' },
  HON: { name: 'Honeywell International Inc.', sector: 'Industrials' },
  UPS: { name: 'United Parcel Service Inc.', sector: 'Industrials' },
  RTX: { name: 'RTX Corp.', sector: 'Industrials' },
  LMT: { name: 'Lockheed Martin Corp.', sector: 'Industrials' },
  DE: { name: 'Deere & Co.', sector: 'Industrials' },
  MMM: { name: '3M Co.', sector: 'Industrials' },
  UNP: { name: 'Union Pacific Corp.', sector: 'Industrials' },
  FDX: { name: 'FedEx Corp.', sector: 'Industrials' },

  // --- Energy & materials ---
  XOM: { name: 'Exxon Mobil Corp.', sector: 'Energy' },
  CVX: { name: 'Chevron Corp.', sector: 'Energy' },
  COP: { name: 'ConocoPhillips', sector: 'Energy' },
  SLB: { name: 'SLB (Schlumberger)', sector: 'Energy' },
  OXY: { name: 'Occidental Petroleum Corp.', sector: 'Energy' },
  EOG: { name: 'EOG Resources Inc.', sector: 'Energy' },
  PSX: { name: 'Phillips 66', sector: 'Energy' },
  FCX: { name: 'Freeport-McMoRan Inc.', sector: 'Materials' },
  NEM: { name: 'Newmont Corp.', sector: 'Materials' },
  NUE: { name: 'Nucor Corp.', sector: 'Materials' },
  LIN: { name: 'Linde plc', sector: 'Materials' },

  // --- Autos ---
  F: { name: 'Ford Motor Co.', sector: 'Consumer Discretionary' },
  GM: { name: 'General Motors Co.', sector: 'Consumer Discretionary' },
  RIVN: { name: 'Rivian Automotive Inc.', sector: 'Consumer Discretionary' },
  LCID: { name: 'Lucid Group Inc.', sector: 'Consumer Discretionary' },
}

/** Look up curated name/sector for a ticker (case-insensitive; tolerates BRK.B ↔ BRK-B). */
export function instrumentInfo(ticker?: string): InstrumentInfo | undefined {
  if (!ticker) return undefined
  const up = ticker.toUpperCase()
  return INSTRUMENTS[up] ?? INSTRUMENTS[up.replace(/\./g, '-')]
}
