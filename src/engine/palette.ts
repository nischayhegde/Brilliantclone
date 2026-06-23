/**
 * Shared palette for Phaser scenes (hex numbers) mirroring the Tailwind `@theme`
 * tokens in src/index.css. Convention across ALL modules:
 *   green = up / buy / long / profit · red = down / sell / short / loss
 *   blue  = annotations, axes, breakevens, labels · white = background.
 */
export const C = {
  white: 0xffffff,
  blue: 0x1d4ed8,
  blueDark: 0x1e40af,
  blueSoft: 0xeff4ff,
  green: 0x16a34a,
  greenLight: 0x22c55e,
  greenSoft: 0xeafaf0,
  red: 0xdc2626,
  redSoft: 0xfef2f2,
  ink: 0x1f2937,
  muted: 0x6b7280,
  hairline: 0xe5e7eb,
  gray200: 0xe5e7eb,
  gray100: 0xf3f4f6,
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

export const FONT =
  '"Segoe UI", ui-sans-serif, system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif'
