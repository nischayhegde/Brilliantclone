/**
 * Small shared presentation primitives for the interaction-kit widgets so every widget
 * shares one calm card frame, label, and prompt style (Trilliant tokens from index.css).
 */
import type { ReactNode } from 'react'

export function WidgetCard({
  label,
  children,
  className = '',
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={label}
      className={`w-full max-w-xl rounded-2xl border border-hairline bg-paper p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ${className}`}
    >
      {children}
    </section>
  )
}

export function WidgetPrompt({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm font-semibold text-ink">{children}</p>
}

export function WidgetHint({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs text-muted">{children}</p>
}
