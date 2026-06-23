type IconProps = { className?: string }

export function Logo({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={`h-7 w-7 ${className}`} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1d4ed8" />
      <path
        d="M8 21 L13 14 L18 17 L24 9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="9" r="2.6" fill="#22c55e" />
    </svg>
  )
}

export function FlameIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="currentColor" aria-hidden="true">
      <path d="M12 2c.4 3-1.6 4.6-3 6.2C7.4 10 6 11.7 6 14a6 6 0 0 0 12 0c0-1.7-.7-3-1.6-4.2-.5.7-1.1 1.2-1.9 1.2 1-2.6-.3-5.6-2.5-9z" />
    </svg>
  )
}

export function CloseIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function CheckIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function CrossIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  )
}

export function GoogleIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z" />
      <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.9 9.4 6.1 12 6.1z" />
    </svg>
  )
}

export function ChartGlyph({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={`h-12 w-12 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 40h36" />
      <rect x="11" y="22" width="4" height="12" rx="1" />
      <path d="M13 18v4M13 34v3" />
      <rect x="22" y="14" width="4" height="16" rx="1" />
      <path d="M24 9v5M24 30v3" />
      <rect x="33" y="24" width="4" height="9" rx="1" />
      <path d="M35 19v5M35 33v3" />
    </svg>
  )
}

export function TrophyIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-16 w-16 ${className}`} fill="currentColor" aria-hidden="true">
      <path d="M18 4h2a2 2 0 0 1 2 2 4 4 0 0 1-4 4h-.3A6 6 0 0 1 13 13.9V16h2a3 3 0 0 1 3 3v1H6v-1a3 3 0 0 1 3-3h2v-2.1A6 6 0 0 1 6.3 10H6a4 4 0 0 1-4-4 2 2 0 0 1 2-2h2V3h12v1zM6 6H4a2 2 0 0 0 2 2V6zm12 2a2 2 0 0 0 2-2h-2v2z" />
    </svg>
  )
}
