import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export default function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-hairline bg-white p-6 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
