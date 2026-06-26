/**
 * Factual context panel for a candle-based scenario (charts + market-making). It tells the
 * learner exactly WHAT they're looking at — instrument, sector, timeframe, the precise window
 * and timestamps, and a real price-action summary — so the decision is informed, not blind.
 *
 * Everything shown is REAL and app-owned: computed from the loaded candles + the asset's own
 * meta + the curated instrument map. Nothing here is model-generated and none of it feeds the
 * math. The panel self-loads the asset bundle (cache hit after the scenario's own data load).
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { ScenarioSpec } from './types'
import { loadOhlcWindow } from './corpus'
import { buildChartContext, fmtVolume, type ChartContext } from './chartContext'

const px = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-ink">{children}</dd>
    </div>
  )
}

function ChangeValue({ pct }: { pct: number }) {
  const up = pct > 0.05
  const down = pct < -0.05
  const cls = up ? 'text-brand-green-text' : down ? 'text-brand-red' : 'text-ink'
  const arrow = up ? '▲' : down ? '▼' : '→'
  const sign = up ? '+' : ''
  return (
    <span className={cls}>
      <span aria-hidden>{arrow} </span>
      {sign}
      {pct.toFixed(1)}%
    </span>
  )
}

export default function ScenarioContext({ spec }: { spec: ScenarioSpec }) {
  const [ctx, setCtx] = useState<ChartContext | null>(null)

  useEffect(() => {
    let alive = true
    loadOhlcWindow(spec.dataRef)
      .then((b) => {
        if (alive) setCtx(buildChartContext(b.candles, { ref: spec.dataRef, meta: b.meta, volumes: b.volumes }))
      })
      .catch(() => {
        if (alive) setCtx(null)
      })
    return () => {
      alive = false
    }
  }, [spec.dataRef])

  if (!ctx) return null

  return (
    <section
      aria-label="Instrument and chart context"
      className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {ctx.ticker && <span className="font-display text-lg font-bold leading-none text-ink">{ctx.ticker}</span>}
            {ctx.name && <span className="text-sm text-ink-soft">{ctx.name}</span>}
          </div>
          {ctx.sector && <span className="text-xs font-semibold text-muted">{ctx.sector}</span>}
        </div>
        {ctx.timeframeLabel && (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-soft">
            {ctx.timeframeLabel}
          </span>
        )}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        <Stat label="Window">
          <span className="tabular-nums">
            {ctx.firstLabel} – {ctx.lastLabel}
          </span>
          <span className="font-normal text-muted"> · {ctx.bars} bars</span>
        </Stat>
        <Stat label="Last">{px(ctx.lastClose)}</Stat>
        <Stat label="Range">
          {px(ctx.low)} – {px(ctx.high)}
        </Stat>
        <Stat label="Change">
          <ChangeValue pct={ctx.pctChange} />
        </Stat>
        {ctx.avgVolume != null && <Stat label="Avg volume">{fmtVolume(ctx.avgVolume)}</Stat>}
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Real market data, shown over the window above — factual context, not a prediction or recommendation.
      </p>
    </section>
  )
}
