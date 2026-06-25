import { DISCLAIMER } from '../practice/copy'

/** Persistent "paper trading for education — not financial advice" banner. */
export default function Disclaimer() {
  return (
    <p role="note" className="mx-auto max-w-2xl px-4 py-3 text-center text-xs text-muted">
      {DISCLAIMER}
    </p>
  )
}
