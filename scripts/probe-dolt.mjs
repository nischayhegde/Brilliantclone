/** Probe DoltHub option_chain coverage: which dates/symbols exist, and how rich a snapshot is. */
import { doltQuery } from './dolthub.mjs'

const DATES = [
  '2019-08-01', '2020-06-01', '2021-09-17', '2022-06-01',
  '2023-06-01', '2024-06-03', '2025-06-02', '2025-12-01',
]
const SYMS = ['SPY', 'AAPL', 'NVDA', 'TSLA']

console.log('=== (date, symbol) coverage: rows returned for a LIMIT-5 probe ===')
for (const d of DATES) {
  const cells = []
  for (const s of SYMS) {
    try {
      const rows = await doltQuery(
        `SELECT strike FROM option_chain WHERE date='${d}' AND act_symbol='${s}' LIMIT 5`,
      )
      cells.push(`${s}:${rows.length ? 'Y' : '-'}`)
    } catch (e) {
      cells.push(`${s}:ERR(${String(e.message).slice(0, 20)})`)
    }
  }
  console.log(`  ${d}  ${cells.join('  ')}`)
}

// Detail on one snapshot: distinct expirations + a near-the-money slice for SPY.
const probeDate = '2024-06-03'
console.log(`\n=== SPY expirations available on ${probeDate} ===`)
try {
  const exps = await doltQuery(
    `SELECT DISTINCT expiration FROM option_chain WHERE date='${probeDate}' AND act_symbol='SPY' ORDER BY expiration LIMIT 40`,
  )
  console.log('  count:', exps.length, '| first/last:', exps[0]?.expiration, '→', exps.at(-1)?.expiration)
} catch (e) {
  console.log('  ERR', e.message)
}

console.log(`\n=== full SPY ${probeDate} snapshot size (all expirations/strikes, paginated) ===`)
try {
  const all = await doltQuery(
    `SELECT expiration,strike,call_put,bid,ask,vol,delta FROM option_chain WHERE date='${probeDate}' AND act_symbol='SPY'`,
  )
  console.log('  total contracts:', all.length)
  console.log('  sample row:', JSON.stringify(all[0]))
} catch (e) {
  console.log('  ERR', e.message)
}
