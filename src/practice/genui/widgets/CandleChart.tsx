import { useMemo } from 'react'
import type { WidgetProps } from '../WidgetHost'
import { makeChartScale } from './chartScale'
import { ChartFrame, provenanceText, tickerFromKey } from './ChartBase'
import { timeframeFromAsset, timeframeLabel } from '../../chartContext'
import { useResolvedCandles } from './context'
import { WidgetCard } from './ui'

/** Display-only real candle slice; exposes the shared scale to its SVG overlay siblings. */
export default function CandleChart({ widget }: WidgetProps) {
  if (widget.kind !== 'candle-chart') return null
  const configRef = widget.config.dataRef
  const { candles, status, ref } = useResolvedCandles(configRef)
  const scale = useMemo(() => makeChartScale(candles), [candles])

  if (candles.length === 0) {
    return (
      <WidgetCard label="Chart">
        <div className="grid h-40 place-items-center rounded-xl bg-surface text-sm text-muted">
          {status === 'loading' ? 'Loading chart…' : status === 'error' ? 'Chart unavailable' : 'No chart data'}
        </div>
      </WidgetCard>
    )
  }

  const ticker = tickerFromKey(ref?.candlesKey ?? configRef?.candlesKey ?? ref?.ohlcAsset ?? configRef?.ohlcAsset)
  const tf = timeframeLabel(timeframeFromAsset(ref?.ohlcAsset ?? configRef?.ohlcAsset))
  return (
    <WidgetCard label="Price chart">
      <ChartFrame
        scale={scale}
        candles={candles}
        ariaLabel="Candlestick price chart"
        provenance={provenanceText(candles, ticker, tf)}
      />
    </WidgetCard>
  )
}
