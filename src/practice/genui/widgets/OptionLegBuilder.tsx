import { useEffect, useMemo, useState } from 'react'
import type { WidgetProps } from '../WidgetHost'
import type { OptionLegDecision, OptionsDecision } from '../../types'
import { contractsForExpiry, findContract, type CP } from '../../chain'
import { rowToLeg, definedRisk } from './legBuilder'
import { payoffSummary } from './payoffCurve'
import { fmtPrice } from './chartScale'
import { fmtMoney } from '../../../lessons/order-book/scenes/book'
import { useLegs, useResolvedChain } from './context'
import PayoffSvg from './PayoffSvg'
import { WidgetCard, WidgetPrompt, WidgetHint } from './ui'

type Managed = NonNullable<OptionsDecision['managed']>
const MANAGED: Managed[] = ['hold', 'closed-early', 'rolled']

function nearest(values: number[], to: number): number {
  return values.reduce((best, v) => (Math.abs(v - to) < Math.abs(best - to) ? v : best), values[0])
}

/** Build defined-risk option legs from the REAL chain. → OptionsDecision.legs/managed. */
export default function OptionLegBuilder({ widget, onChange }: WidgetProps) {
  // Hooks run UNCONDITIONALLY (Rules of Hooks) — only the rendered OUTPUT is gated below.
  // Read this widget's config defensively (undefined for any other kind) so the hooks that
  // depend on it (e.g. useResolvedChain) can still be called before the kind guard.
  const config = widget.kind === 'option-leg-builder' ? widget.config : undefined
  const { chain, status } = useResolvedChain(config?.dataRef)
  const { publish } = useLegs()

  const expirations = chain?.meta.expirations ?? []
  const [expiry, setExpiry] = useState<string>(expirations[0] ?? '')
  const [cp, setCp] = useState<CP>('C')
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [contracts, setContracts] = useState(1)
  const [legs, setLegs] = useState<OptionLegDecision[]>([])
  const [managed, setManaged] = useState<Managed>('hold')

  // Keep expiry valid once the chain resolves.
  useEffect(() => {
    if (!expiry && expirations.length) setExpiry(expirations[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expirations.length])

  const strikes = useMemo(() => {
    if (!chain || !expiry) return [] as number[]
    return Array.from(new Set(contractsForExpiry(chain, expiry).filter((r) => r.cp === cp).map((r) => r.strike))).sort(
      (a, b) => a - b,
    )
  }, [chain, expiry, cp])

  const [strike, setStrike] = useState<number | null>(null)
  useEffect(() => {
    if (strikes.length && (strike == null || !strikes.includes(strike))) {
      setStrike(nearest(strikes, chain?.meta.spot ?? strikes[Math.floor(strikes.length / 2)]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strikes])

  const requireDefinedRisk = config?.requireDefinedRisk
  const ok = requireDefinedRisk ? definedRisk(legs) : true
  // Emit to the host + publish to the shared legs context whenever the structure changes.
  useEffect(() => {
    publish(widget.id, legs)
    if (legs.length === 0 || !ok) onChange(undefined)
    else onChange({ kind: 'option-leg-builder', legs, managed })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, managed, ok])

  if (widget.kind !== 'option-leg-builder') return null
  const { maxLegs } = widget.config

  if (!chain) {
    return (
      <WidgetCard label="Option legs">
        <div className="grid h-32 place-items-center rounded-xl bg-surface text-sm text-muted">
          {status === 'loading' ? 'Loading option chain…' : 'Option chain unavailable'}
        </div>
      </WidgetCard>
    )
  }

  const addLeg = () => {
    if (legs.length >= maxLegs || strike == null) return
    const row = findContract(chain, expiry, strike, cp)
    if (!row) return
    setLegs((prev) => [...prev, rowToLeg(row, side, contracts, chain.meta.date)])
  }
  const removeLeg = (i: number) => setLegs((prev) => prev.filter((_, k) => k !== i))

  const sum = legs.length ? payoffSummary(legs) : null
  const selectClass =
    'rounded-lg border border-hairline bg-paper px-2.5 py-1.5 text-sm text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35'

  return (
    <WidgetCard label="Option legs">
      <WidgetPrompt>Build your structure from the real chain ({chain.meta.symbol})</WidgetPrompt>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
          Expiry
          <select aria-label="Expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={selectClass}>
            {expirations.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <div role="radiogroup" aria-label="Option type" className="flex gap-1">
          {(['C', 'P'] as CP[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={cp === t}
              onClick={() => setCp(t)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${cp === t ? 'border-ink bg-ink text-white' : 'border-hairline bg-paper text-ink-soft'}`}
            >
              {t === 'C' ? 'Call' : 'Put'}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Side" className="flex gap-1">
          {(['long', 'short'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold capitalize ${
                side === s ? 'border-ink bg-ink text-white' : 'border-hairline bg-paper text-ink-soft'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
          Strike
          <select
            aria-label="Strike"
            value={strike ?? ''}
            onChange={(e) => setStrike(Number(e.target.value))}
            className={selectClass}
          >
            {strikes.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
          Contracts
          <input
            type="number"
            min={1}
            max={20}
            aria-label="Contracts"
            value={contracts}
            onChange={(e) => setContracts(Math.max(1, Math.round(Number(e.target.value) || 1)))}
            className={`${selectClass} w-20`}
          />
        </label>

        <button
          type="button"
          onClick={addLeg}
          disabled={legs.length >= maxLegs}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35"
        >
          Add leg
        </button>
      </div>

      {legs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {legs.map((l, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5 text-sm text-ink">
              <span className="font-medium capitalize">
                {l.side} {l.contracts}× {l.K}
                {l.type === 'call' ? 'C' : 'P'} @ {fmtPrice(l.premium)}
                <span className="ml-2 text-xs text-muted">{l.expiry}</span>
              </span>
              <button
                type="button"
                onClick={() => removeLeg(i)}
                aria-label={`Remove leg ${i + 1}`}
                className="rounded px-2 py-0.5 text-xs font-semibold text-brand-red hover:bg-brand-red-soft"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {requireDefinedRisk && legs.length > 0 && !ok && (
        <WidgetHint>
          <span className="font-semibold text-brand-red">Undefined (naked) risk</span> — add a covering long leg to cap
          the loss before you can submit.
        </WidgetHint>
      )}

      {sum && (
        <div className="mt-4">
          <PayoffSvg legs={legs} ariaLabel="Live option payoff preview" />
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span>
              <span className="text-muted">Max profit </span>
              <span className="font-semibold text-brand-green-text">{sum.unlimitedProfit ? 'Unlimited' : fmtMoney(sum.maxProfit)}</span>
            </span>
            <span>
              <span className="text-muted">Max loss </span>
              <span className="font-semibold text-brand-red">{sum.unlimitedLoss ? 'Undefined' : fmtMoney(sum.maxLoss)}</span>
            </span>
            <label className="ml-auto flex items-center gap-1 text-muted">
              Manage:
              <select aria-label="Manage" value={managed} onChange={(e) => setManaged(e.target.value as Managed)} className={selectClass}>
                {MANAGED.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </WidgetCard>
  )
}
