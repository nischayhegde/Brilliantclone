import type { ReactNode } from 'react'

interface ModuleShellProps {
  kicker?: string
  title: string
  intro?: string
  caption?: string
  canvas: ReactNode
  footer: ReactNode
}

/** Shared chrome around every module body: eyebrow, title, intro, canvas, caption, footer. */
export default function ModuleShell({ kicker, title, intro, caption, canvas, footer }: ModuleShellProps) {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <header className="flex flex-col items-center text-center">
        {kicker && (
          <span className="inline-block rounded-full bg-brand-amber-soft px-3 py-1 text-xs font-bold text-brand-amber-dark">
            {kicker}
          </span>
        )}
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight">{title}</h1>
        {intro && <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">{intro}</p>}
      </header>

      {canvas}

      {caption && <p className="mx-auto max-w-xl text-center text-sm text-muted">{caption}</p>}

      <div className="mt-1 flex flex-col items-center gap-3">{footer}</div>
    </div>
  )
}
