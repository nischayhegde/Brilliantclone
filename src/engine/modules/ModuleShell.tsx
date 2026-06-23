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
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <header className="text-center">
        {kicker && (
          <p className="text-sm font-bold uppercase tracking-wide text-brand-blue">{kicker}</p>
        )}
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{title}</h1>
        {intro && <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{intro}</p>}
      </header>

      {canvas}

      {caption && <p className="mx-auto max-w-xl text-center text-sm text-muted">{caption}</p>}

      <div className="mt-1 flex flex-col items-center gap-3">{footer}</div>
    </div>
  )
}
