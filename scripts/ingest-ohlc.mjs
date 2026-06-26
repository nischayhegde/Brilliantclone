/**
 * OHLC corpus ingester for Practice mode.
 *
 * Pulls real candles from the Yahoo Finance chart API (no key; same source the lessons
 * use) for every ticker in scripts/universe.mjs, across three timeframes, and writes one
 * compact columnar JSON file per ticker+timeframe into public/data/ohlc/ plus a
 * public/data/manifest.json index. Files in public/ are served as static assets and are
 * NOT bundled into the app, so the corpus can be large without bloating the build.
 *
 * Usage:
 *   node scripts/ingest-ohlc.mjs --test     # 3 tickers, all timeframes (smoke test)
 *   node scripts/ingest-ohlc.mjs            # full universe
 *   node scripts/ingest-ohlc.mjs --tf=1d    # only the daily timeframe
 *
 * Output shape (columnar to keep files small; a loader maps it back to {t,o,h,l,c}):
 *   { meta:{ticker,tf,currency,exchange,count,first,last}, t:[],o:[],h:[],l:[],c:[],v:[],ac?:[] }
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UNIVERSE } from './universe.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const OUT_DIR = path.join(DATA_DIR, 'ohlc')

// Timeframe configs. IMPORTANT: `range=max` with `interval=1d` makes Yahoo silently
// return MONTHLY buckets, so daily must use explicit period1/period2 (unix seconds) to
// get true daily candles — the same way the lessons fetched them. Intraday history is
// hard-capped by the API: ~730d for 1h and ~60d for finer intervals, so those use range.
const NOW_SEC = Math.floor(Date.now() / 1000)
const DAILY_YEARS = 20
const ALL_TIMEFRAMES = [
  { tf: '1d', interval: '1d', period1: NOW_SEC - Math.floor(DAILY_YEARS * 365.25 * 86400), period2: NOW_SEC },
  { tf: '1h', interval: '1h', range: '730d' },
  { tf: '15m', interval: '15m', range: '60d' },
]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const argv = process.argv.slice(2)
const TEST = argv.includes('--test')
const tfFilter = argv.find((a) => a.startsWith('--tf='))?.split('=')[1]
const TIMEFRAMES = tfFilter ? ALL_TIMEFRAMES.filter((t) => t.tf === tfFilter) : ALL_TIMEFRAMES
const TICKERS = TEST ? ['AAPL', 'NVDA', 'SPY'] : UNIVERSE
const THROTTLE_MS = TEST ? 300 : 700

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const round = (n, d = 4) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d)
const isoDay = (sec) => (sec ? new Date(sec * 1000).toISOString().slice(0, 10) : null)

function buildUrl(ticker, spec) {
  const params = new URLSearchParams({ interval: spec.interval, includePrePost: 'false' })
  if (spec.period1 != null) {
    params.set('period1', String(spec.period1))
    params.set('period2', String(spec.period2 ?? NOW_SEC))
  } else {
    params.set('range', spec.range)
  }
  return `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${params}`
}

async function fetchChart(ticker, spec, attempt = 1) {
  try {
    const res = await fetch(buildUrl(ticker, spec), { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result || !Array.isArray(result.timestamp)) {
      return { error: json?.chart?.error?.description || 'no data' }
    }
    return { result }
  } catch (e) {
    if (attempt <= 4) {
      await sleep(800 * attempt) // linear backoff on 429/5xx/network
      return fetchChart(ticker, spec, attempt + 1)
    }
    return { error: String(e?.message || e) }
  }
}

function toColumnar(result) {
  const ts = result.timestamp
  const q = result.indicators?.quote?.[0] ?? {}
  const adj = result.indicators?.adjclose?.[0]?.adjclose
  const t = [], o = [], h = [], l = [], c = [], v = [], ac = []
  for (let i = 0; i < ts.length; i++) {
    const O = q.open?.[i], H = q.high?.[i], L = q.low?.[i], C = q.close?.[i]
    // Yahoo pads holidays / halts with nulls — drop those rows entirely.
    if (O == null || H == null || L == null || C == null) continue
    t.push(ts[i]); o.push(round(O)); h.push(round(H)); l.push(round(L)); c.push(round(C))
    v.push(q.volume?.[i] ?? null)
    if (adj) ac.push(round(adj[i]))
  }
  return ac.length === t.length ? { t, o, h, l, c, v, ac } : { t, o, h, l, c, v }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log(
    `Ingesting ${TICKERS.length} tickers × [${TIMEFRAMES.map((t) => t.tf).join(', ')}] ` +
      `→ ${path.relative(ROOT, OUT_DIR)}${TEST ? '  (TEST)' : ''}\n`,
  )

  const manifest = {}
  let ok = 0
  let fail = 0
  const failures = []

  for (const ticker of TICKERS) {
    const entry = {}
    for (const spec of TIMEFRAMES) {
      const { tf } = spec
      const { result, error } = await fetchChart(ticker, spec)
      await sleep(THROTTLE_MS)
      if (error) {
        fail++
        failures.push(`${ticker} ${tf}: ${error}`)
        console.log(`  ✗ ${ticker.padEnd(6)} ${tf.padEnd(3)} ${error}`)
        continue
      }
      const cols = toColumnar(result)
      if (cols.t.length === 0) {
        fail++
        failures.push(`${ticker} ${tf}: empty after null-filter`)
        console.log(`  ✗ ${ticker.padEnd(6)} ${tf.padEnd(3)} empty`)
        continue
      }
      const meta = {
        ticker,
        tf,
        currency: result.meta?.currency ?? null,
        exchange: result.meta?.exchangeName ?? null,
        count: cols.t.length,
        first: isoDay(cols.t[0]),
        last: isoDay(cols.t[cols.t.length - 1]),
      }
      const rel = `data/ohlc/${ticker}__${tf}.json`
      await writeFile(path.join(OUT_DIR, `${ticker}__${tf}.json`), JSON.stringify({ meta, ...cols }))
      entry[tf] = { count: meta.count, first: meta.first, last: meta.last, file: rel }
      ok++
      console.log(`  ✓ ${ticker.padEnd(6)} ${tf.padEnd(3)} ${String(meta.count).padStart(6)} candles  ${meta.first} → ${meta.last}`)
    }
    if (Object.keys(entry).length) manifest[ticker] = entry
  }

  await writeFile(
    path.join(DATA_DIR, 'manifest.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), source: 'yahoo-finance-chart', timeframes: TIMEFRAMES.map((t) => t.tf), tickerCount: Object.keys(manifest).length, tickers: manifest },
      null,
      2,
    ),
  )

  console.log(`\nDone. ${ok} files written, ${fail} failures.`)
  if (failures.length) console.log('Failures:\n  ' + failures.join('\n  '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
