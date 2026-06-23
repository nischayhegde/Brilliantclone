export default function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-brand-blue ${className}`}
    />
  )
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
