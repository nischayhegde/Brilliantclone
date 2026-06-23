import { ChartGlyph } from '../icons'

interface PlaceholderChartProps {
  label: string
  note: string
}

/**
 * Stand-in for the Phase 2 Phaser candlestick engine. Keeps the module layout
 * realistic so swapping in the real animated chart later needs no flow changes.
 */
export default function PlaceholderChart({ label, note }: PlaceholderChartProps) {
  return (
    <div className="flex aspect-[16/10] w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline bg-brand-blue-soft/40 p-6 text-center">
      <ChartGlyph className="text-brand-blue/70" />
      <p className="font-bold text-ink">{label}</p>
      <p className="text-xs text-muted">{note}</p>
    </div>
  )
}
