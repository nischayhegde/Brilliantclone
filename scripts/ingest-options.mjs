/**
 * Options-chain snapshot ingester for Practice mode (Track C).
 *
 * Source: DoltHub `post-no-preference/options` (free SQL API; real EOD bid/ask + IV +
 * full Greeks). Coverage is ~2020–2025 with gaps, and chains are THINNED (a near-the-money
 * ladder on monthly expirations, ~1–2 months out) — adequate for the core options
 * curriculum (verticals, covered calls, CSPs, condors, the Greeks at 30–45 DTE), not 0DTE.
 *
 * For each (symbol, covered-date) it pulls the full small snapshot, attaches the real spot
 * (close from our OHLC daily corpus), and writes compact JSON to public/data/options/.
 *
 * Usage:
 *   node scripts/ingest-options.mjs --test                  # SPY + AAPL, 3 months
 *   node scripts/ingest-options.mjs                         # default symbols, 2020-01..2025-12
 *   node scripts/ingest-options.mjs --symbols=SPY,QQQ,AAPL --from=2022-01 --to=2023-12
 *   node scripts/ingest-options.mjs --force                 # re-pull existing snapshots
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { doltQuery, hasSnapshot } from './dolthub.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const OUT_DIR = path.join(DATA_DIR, 'options')
const OHLC_DIR = path.join(DATA_DIR, 'ohlc')

const DEFAULT_SYMBOLS = [
  'SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL',
  'META', 'TSLA', 'AMD', 'NFLX', 'BAC', 'JPM', 'DIS', 'GLD',
]

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (k, d) => argv.find((a) => a.startsWith(`${k}=`))?.split('=')[1] ?? d
const TEST = has('--test')
const FORCE = has('--force')
const SYMBOLS = TEST ? ['SPY', 'AAPL'] : (val('--symbols')?.split(',') ?? DEFAULT_SYMBOLS)
const FROM = TEST ? '2021-01' : val('--from', '2020-01')
const TO = TEST ? '2021-03' : val('--to', '2025-12')
const THROTTLE_MS = 350

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (s) => (s == null || s === '' ? null : Number(s))

function* months(from, to) {
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    yield [y, m]
    if (++m > 12) { m = 1; y++ }
  }
}
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const isWeekday = (y, m, d) => { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return w >= 1 && w <= 5 }

async function withRetry(fn, label, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try { return await fn() } catch (e) {
      if (i === attempts) throw e
      await sleep(700 * i)
    }
  }
}

/**
 * Resolve, per month, the first mid-month date that is BOTH a real trading session
 * (SPY has an OHLC candle — excludes holidays like MLK Day) AND present in the options DB.
 */
async function resolveCoveredDates(spyCloses) {
  const dates = []
  for (const [y, m] of months(FROM, TO)) {
    let found = null
    for (const d of [16, 17, 18, 19, 20, 15, 21, 22, 23]) {
      if (!isWeekday(y, m, d)) continue
      const date = iso(y, m, d)
      if (spyCloses && !spyCloses.has(date)) continue // skip market holidays
      const ok = await withRetry(() => hasSnapshot(date, 'SPY'), `canary ${date}`).catch(() => false)
      await sleep(THROTTLE_MS)
      if (ok) { found = date; break }
    }
    if (found) { dates.push(found); console.log(`  covered ${found}`) }
    else console.log(`  (gap)   ${y}-${String(m).padStart(2, '0')}`)
  }
  return dates
}

/** Map ISO-day -> close from a symbol's daily OHLC file (for spot at the snapshot date). */
function loadCloseMap(symbol) {
  const f = path.join(OHLC_DIR, `${symbol}__1d.json`)
  if (!existsSync(f)) return null
  const j = JSON.parse(readFileSync(f, 'utf8'))
  const map = new Map()
  for (let i = 0; i < j.t.length; i++) map.set(new Date(j.t[i] * 1000).toISOString().slice(0, 10), j.c[i])
  return map
}

async function pullSnapshot(symbol, date) {
  const rows = await withRetry(
    () =>
      doltQuery(
        `SELECT expiration,strike,call_put,bid,ask,vol,delta,gamma,theta,vega,rho ` +
          `FROM option_chain WHERE date='${date}' AND act_symbol='${symbol}'`,
      ),
    `${symbol} ${date}`,
  )
  return rows.map((r) => ({
    exp: r.expiration,
    strike: num(r.strike),
    cp: r.call_put === 'Call' ? 'C' : 'P',
    bid: num(r.bid),
    ask: num(r.ask),
    mid: num(r.bid) != null && num(r.ask) != null ? Math.round(((num(r.bid) + num(r.ask)) / 2) * 100) / 100 : null,
    iv: num(r.vol),
    delta: num(r.delta),
    gamma: num(r.gamma),
    theta: num(r.theta),
    vega: num(r.vega),
    rho: num(r.rho),
  }))
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log(`Options ingest: [${SYMBOLS.join(', ')}] × monthly ${FROM}..${TO}${TEST ? '  (TEST)' : ''}\n`)

  const closeMaps = new Map(SYMBOLS.map((s) => [s, loadCloseMap(s)]))
  const spyCloses = closeMaps.get('SPY') ?? loadCloseMap('SPY')

  console.log('Resolving covered dates (SPY canary, trading sessions only)...')
  const dates = await resolveCoveredDates(spyCloses)
  console.log(`\n${dates.length} covered dates.\n`)
  const manifest = {}
  let ok = 0, skip = 0, fail = 0
  const failures = []

  for (const symbol of SYMBOLS) {
    const entry = []
    for (const date of dates) {
      const outFile = path.join(OUT_DIR, `${symbol}__${date}.json`)
      const rel = `data/options/${symbol}__${date}.json`
      if (existsSync(outFile) && !FORCE) { skip++; entry.push({ date, file: rel, cached: true }); continue }
      try {
        const chain = await pullSnapshot(symbol, date)
        await sleep(THROTTLE_MS)
        if (chain.length === 0) { continue } // symbol not present on this date
        const expirations = [...new Set(chain.map((c) => c.exp))].sort()
        const spot = closeMaps.get(symbol)?.get(date) ?? null
        const meta = { symbol, date, spot, expirations, contracts: chain.length, source: 'dolthub/post-no-preference/options' }
        await writeFile(outFile, JSON.stringify({ meta, chain }))
        entry.push({ date, file: rel, contracts: chain.length, expirations: expirations.length, spot })
        ok++
        console.log(`  ✓ ${symbol.padEnd(6)} ${date}  ${String(chain.length).padStart(4)} contracts · ${expirations.length} exp · spot ${spot ?? '?'}`)
      } catch (e) {
        fail++
        failures.push(`${symbol} ${date}: ${e.message}`)
        console.log(`  ✗ ${symbol.padEnd(6)} ${date}  ${e.message}`)
      }
    }
    if (entry.length) manifest[symbol] = entry
  }

  await writeFile(
    path.join(DATA_DIR, 'options-manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: 'dolthub/post-no-preference/options', coveredDates: dates, symbols: manifest }, null, 2),
  )
  console.log(`\nDone. ${ok} snapshots written, ${skip} cached, ${fail} failures.`)
  if (failures.length) console.log('Failures:\n  ' + failures.slice(0, 30).join('\n  '))
}

main().catch((e) => { console.error(e); process.exit(1) })
