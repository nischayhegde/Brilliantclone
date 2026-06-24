import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition duration-200 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-amber/35 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-white shadow-sm hover:bg-black hover:shadow-md hover:-translate-y-px',
  secondary: 'border border-hairline bg-paper text-ink hover:bg-surface hover:border-ink/20',
  ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-ink',
}

export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
