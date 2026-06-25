export type CP = 'C' | 'P'

export interface ContractRow {
  exp: string
  strike: number
  cp: CP
  bid: number
  ask: number
  mid: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

export interface ChainSnapshot {
  meta: { symbol: string; date: string; spot: number; expirations: string[]; contracts?: number; source?: string }
  chain: ContractRow[]
}

const cache = new Map<string, ChainSnapshot>()
export function __clearChainCache(): void {
  cache.clear()
}

export async function loadChain(asset: string): Promise<ChainSnapshot> {
  const hit = cache.get(asset)
  if (hit) return hit
  const res = await fetch(`/${asset}`)
  if (!res.ok) throw new Error(`Failed to load ${asset}: HTTP ${res.status}`)
  const snap = (await res.json()) as ChainSnapshot
  cache.set(asset, snap)
  return snap
}

export function contractsForExpiry(snap: ChainSnapshot, exp: string): ContractRow[] {
  return snap.chain.filter((r) => r.exp === exp)
}

export function findContract(snap: ChainSnapshot, exp: string, strike: number, cp: CP): ContractRow | undefined {
  return snap.chain.find((r) => r.exp === exp && r.strike === strike && r.cp === cp)
}

/** Calendar days from an ISO date to an expiry (UTC). */
export function dteDays(fromIso: string, exp: string): number {
  const ms = Date.parse(exp + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')
  return Math.round(ms / 86_400_000)
}
