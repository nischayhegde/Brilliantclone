import type { WidgetProps } from '../WidgetHost'
import { WidgetCard } from './ui'

/** Display-only framed headline / context card (copy only). */
export default function NewsHeadline({ widget }: WidgetProps) {
  if (widget.kind !== 'news-headline') return null
  const { headline, source, body } = widget.config
  return (
    <WidgetCard label="News" className="border-l-4 border-l-brand-amber">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-amber-ink">
        {source ? `News · ${source}` : 'News'}
      </p>
      <h3 className="font-display text-base text-ink">{headline}</h3>
      {body && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>}
    </WidgetCard>
  )
}
