/**
 * Tiny client for the DoltHub SQL API against the free `post-no-preference/options`
 * database (tables: option_chain, volatility_history). No CLI / no full clone needed.
 *
 * PERFORMANCE CONTRACT: option_chain's primary key is
 *   (date, act_symbol, expiration, strike, call_put)
 * so every query MUST pin an exact `date` (the leading key). Queries that filter only by
 * symbol, or sort by date across the whole table, hit the API's ~30s timeout. Pulling one
 * (date, symbol) chain snapshot is fast because it's a contiguous PK range.
 */
const BASE = 'https://www.dolthub.com/api/v1alpha1/post-no-preference/options'

/** Run a SQL query, following pagination, and return all rows. */
export async function doltQuery(sql, { branch = 'master', maxPages = 200 } = {}) {
  let rows = []
  let token = null
  let pages = 0
  do {
    const url =
      `${BASE}/${branch}?q=${encodeURIComponent(sql)}` +
      (token ? `&next_page_token=${encodeURIComponent(token)}` : '')
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = await res.json()
    if (j.query_execution_status !== 'Success') {
      throw new Error(j.query_execution_message || `dolt error: ${JSON.stringify(j).slice(0, 160)}`)
    }
    rows = rows.concat(j.rows || [])
    token = j.next_page_token || null
  } while (token && ++pages < maxPages)
  return rows
}

/** True if (date, symbol) has any chain rows — a fast existence check. */
export async function hasSnapshot(date, symbol) {
  const rows = await doltQuery(
    `SELECT strike FROM option_chain WHERE date='${date}' AND act_symbol='${symbol}' LIMIT 1`,
  )
  return rows.length > 0
}
