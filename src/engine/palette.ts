/**
 * Shared palette for Phaser scenes (hex numbers) mirroring the Tailwind `@theme`
 * tokens in src/index.css — the warm "Trilliant" identity (warm near-black ink,
 * amber as the energy/identity accent, warm stone neutrals). Convention across ALL
 * modules:
 *   green = up / buy / long / bid / profit · red = down / sell / short / ask / loss
 *   blue  = annotations, axes, calipers, mid line, limit orders, integrity labels
 *   amber = energy / the active path / invitation to interact (identity accent)
 *   ink   = structure + neutral primary actions · white/paper = background
 *
 * Neutrals are warm-tinted (stone), never cool gray, so scenes sit on the same
 * surface as the rest of the product.
 */
export const C = {
  white: 0xffffff,

  // Blue — annotations, calipers, mid, limit orders, "simulated depth" label.
  blue: 0x1d4ed8,
  blueDark: 0x1e40af,
  blueSoft: 0xeef3ff,

  // Green — bid / buy / up / confirm.
  green: 0x16a34a,
  greenText: 0x15803d,
  greenLight: 0x22c55e,
  greenSoft: 0xe8f7ee,

  // Red — ask consumed / sell / down / slippage / error.
  red: 0xdc2626,
  redText: 0xb91c1c,
  redSoft: 0xfdecea,

  // Amber — the brand energy accent (the active path / invite-to-interact).
  amber: 0xe0701a,
  amberDark: 0xb4530a,
  amberSoft: 0xfdf0e2,
  amberInk: 0x9a4209,

  // Warm structural neutrals (stone), matched to the @theme tokens.
  ink: 0x1c1917,
  inkSoft: 0x57534e,
  muted: 0x6f6862,
  hairline: 0xe7e2db,
  gray200: 0xe7e2db,
  gray100: 0xf3f1ec,
  surface: 0xfaf9f7,
} as const

export type ColorName = keyof typeof C

/** Resolve a ColorName or raw hex number to a hex number. */
export function color(c: ColorName | number | undefined, fallback: number = C.ink): number {
  if (c === undefined) return fallback
  return typeof c === 'number' ? c : C[c]
}

/** '#rrggbb' string for a ColorName or hex number (for Phaser text fills). */
export function hex(c: ColorName | number): string {
  const n = typeof c === 'number' ? c : C[c]
  return '#' + n.toString(16).padStart(6, '0')
}

/**
 * Brand UI font for in-canvas text. Leads with Inter (the product's loaded web
 * font) so scene labels match the React chrome, with robust system fallbacks.
 */
export const FONT =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
