import type { WidgetProps } from '../WidgetHost'
import { WidgetCard } from './ui'

/** Display-only scenario framing prose (no input). */
export default function Narrative({ widget }: WidgetProps) {
  if (widget.kind !== 'narrative') return null
  const { heading, body } = widget.config
  return (
    <WidgetCard label={heading ?? 'Scenario'}>
      {heading && <h3 className="font-display mb-2 text-lg text-ink">{heading}</h3>}
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{body}</p>
    </WidgetCard>
  )
}
