/**
 * Ticker universe for the Practice-mode data corpus: ~180 liquid US large-caps + the
 * major ETFs. Chosen for deep, clean liquidity (so chart patterns and spread/vol stats
 * are meaningful) and to include every ticker already used in the Phase-1 lessons.
 *
 * Symbols use Yahoo Finance conventions (e.g. BRK-B). A few names may delist/relist or
 * change ticker over time; the ingester logs and skips any that fail, so a stale symbol
 * never breaks a run.
 */
export const UNIVERSE = [
  // --- Broad-market & style ETFs ---
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'RSP', 'MDY',
  // --- Sector / thematic ETFs ---
  'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLU', 'XLB', 'XLRE', 'XLC',
  'SMH', 'SOXX', 'XBI', 'KRE', 'XRT', 'ARKK', 'IBB',
  // --- Bonds / commodities / vol ETFs ---
  'TLT', 'IEF', 'HYG', 'LQD', 'GLD', 'SLV', 'USO', 'UNG', 'VXX',
  // --- International ETFs ---
  'EEM', 'EFA', 'VEA', 'VWO', 'FXI',

  // --- Mega-cap tech ---
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA', 'AVGO',
  // --- Semis ---
  'AMD', 'INTC', 'QCOM', 'TXN', 'MU', 'AMAT', 'LRCX', 'ADI', 'KLAC', 'MRVL',
  'ON', 'SMCI', 'ARM',
  // --- Software / cloud / security ---
  'ORCL', 'ADBE', 'CRM', 'NOW', 'INTU', 'SNPS', 'CDNS', 'PANW', 'CRWD', 'SNOW',
  'NET', 'DDOG', 'ZS', 'PLTR', 'ANET', 'IBM', 'CSCO',
  // --- Internet / media / comms ---
  'NFLX', 'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'ROKU', 'SNAP', 'PINS', 'SPOT',
  // --- Consumer internet / fintech / travel ---
  'UBER', 'LYFT', 'ABNB', 'DASH', 'SHOP', 'PYPL', 'COIN', 'HOOD', 'BKNG', 'MAR',
  // --- China ADRs ---
  'BABA', 'PDD', 'JD', 'NIO', 'SE', 'MELI',

  // --- Consumer staples & discretionary ---
  'WMT', 'COST', 'HD', 'LOW', 'NKE', 'MCD', 'SBUX', 'TGT', 'KO', 'PEP',
  'PG', 'CL', 'MDLZ', 'PM', 'MO', 'EL', 'LULU', 'CMG', 'YUM',
  // --- Financials ---
  'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BLK', 'SCHW', 'AXP', 'V',
  'MA', 'BRK-B', 'USB', 'PNC', 'COF', 'SPGI', 'CME', 'ICE',
  // --- Healthcare ---
  'UNH', 'JNJ', 'LLY', 'PFE', 'MRK', 'ABBV', 'ABT', 'TMO', 'DHR', 'BMY',
  'AMGN', 'GILD', 'CVS', 'MDT', 'ISRG', 'VRTX', 'REGN', 'MRNA',
  // --- Industrials ---
  'BA', 'CAT', 'GE', 'HON', 'UPS', 'RTX', 'LMT', 'DE', 'MMM', 'UNP', 'FDX',
  // --- Energy & materials ---
  'XOM', 'CVX', 'COP', 'SLB', 'OXY', 'EOG', 'PSX', 'FCX', 'NEM', 'NUE', 'LIN',
  // --- Autos ---
  'F', 'GM', 'RIVN', 'LCID',
]
