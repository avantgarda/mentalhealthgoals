/**
 * Canonical geometry for the MHG logo marks.
 *
 * This module is the single source of truth: the React components in
 * `src/components/Logo` and the static asset generator in
 * `scripts/generate-brand-assets.ts` both render from these definitions, so
 * the marks on the site and the exported files can never drift apart.
 *
 * All marks are drawn on a 96 x 96 grid and are optically centred within it —
 * content is centred on (48, 48) rather than being mathematically centred on
 * its bounding box, and each variant occupies a comparable visual area so the
 * three read as the same size when swapped.
 */

export const LOGO_VARIANTS = ['summit', 'sunInCol', 'rings'] as const

export type LogoVariant = (typeof LOGO_VARIANTS)[number]

export const DEFAULT_LOGO_VARIANT: LogoVariant = 'summit'

/** `form` renders in the primary/ink colour, `accent` in brand amber. */
export type MarkRole = 'form' | 'accent'

export type MarkElement =
  | {
      kind: 'path'
      d: string
      role: MarkRole
      strokeWidth: number
      linecap: 'round' | 'butt'
      linejoin: 'round' | 'miter'
    }
  | {
      kind: 'circle'
      cx: number
      cy: number
      r: number
      role: MarkRole
      /** Omit for a filled circle; provide for a stroked ring. */
      strokeWidth?: number
      opacity?: number
    }

export interface MarkDefinition {
  label: string
  /** One-line description used in the admin selector. */
  description: string
  /** Longer rationale, shown in the admin preview. */
  note: string
  elements: MarkElement[]
}

/**
 * The shared skyline. Summit M and Sun in the Col are the same mountain drawn
 * with different joins — sharp when the goal is ahead of the climb, round when
 * the light is held between the peaks. Sun in the Col sits 2.5 units higher so
 * that each mark is independently centred on (48, 48).
 */
const SUMMIT_SKYLINE = 'M 16 82 L 33 46 L 46 72 L 61 38 L 80 82'
const SUN_SKYLINE = 'M 16 73.5 L 33 37.5 L 46 63.5 L 61 29.5 L 80 73.5'

export const MARKS: Record<LogoVariant, MarkDefinition> = {
  summit: {
    label: 'Summit M — sharp peaks, goal above',
    description: 'Rising peaks forming an M, with the amber goal floating clear above the summit.',
    note: 'The aspirational mark. Full-miter peaks give an alpine cut; the goal clears the miter tip by 2.5 units — close enough for tension, never touching.',
    elements: [
      {
        kind: 'path',
        d: SUMMIT_SKYLINE,
        role: 'form',
        strokeWidth: 8,
        linecap: 'round',
        linejoin: 'miter',
      },
      { kind: 'circle', cx: 61, cy: 17.5, r: 8, role: 'accent' },
    ],
  },
  sunInCol: {
    label: 'Sun in the Col — round peaks, sun held',
    description: 'The same mountain with soft shoulders, holding the amber sun between its peaks.',
    note: 'The warm variant. The sun floats in the col with equal clearance to both inner slopes — held by the mountains rather than hidden behind them.',
    elements: [
      { kind: 'circle', cx: 45.1, cy: 28, r: 9.5, role: 'accent' },
      {
        kind: 'path',
        d: SUN_SKYLINE,
        role: 'form',
        strokeWidth: 8,
        linecap: 'round',
        linejoin: 'round',
      },
    ],
  },
  rings: {
    label: 'Concentric Rings — original mark',
    description: 'The original launch mark: concentric rings around an amber centre.',
    note: 'Retained as the original identity. Proportions are unchanged from the launch design, scaled to sit optically level with the summit marks.',
    elements: [
      { kind: 'circle', cx: 48, cy: 48, r: 36.5, role: 'form', strokeWidth: 5.2, opacity: 0.9 },
      { kind: 'circle', cx: 48, cy: 48, r: 21.9, role: 'form', strokeWidth: 5.2, opacity: 0.55 },
      { kind: 'circle', cx: 48, cy: 48, r: 8.4, role: 'accent' },
    ],
  },
}

export const MARK_VIEWBOX = '0 0 96 96'

export const isLogoVariant = (value: unknown): value is LogoVariant =>
  typeof value === 'string' && (LOGO_VARIANTS as readonly string[]).includes(value)

/** Narrow an unknown (e.g. CMS) value to a usable variant, falling back to the default. */
export const resolveLogoVariant = (value: unknown): LogoVariant =>
  isLogoVariant(value) ? value : DEFAULT_LOGO_VARIANT

/**
 * Serialise a mark to raw SVG element markup. Used by the asset generator; the
 * React components render the same `MarkElement[]` as JSX.
 */
export const markElementsToSVG = (
  variant: LogoVariant,
  colors: { form: string; accent: string },
): string =>
  MARKS[variant].elements
    .map((el) => {
      const color = el.role === 'form' ? colors.form : colors.accent

      if (el.kind === 'path') {
        return `<path d="${el.d}" fill="none" stroke="${color}" stroke-width="${el.strokeWidth}" stroke-linecap="${el.linecap}" stroke-linejoin="${el.linejoin}"/>`
      }

      if (el.strokeWidth) {
        const opacity = el.opacity === undefined ? '' : ` stroke-opacity="${el.opacity}"`
        return `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="none" stroke="${color}" stroke-width="${el.strokeWidth}"${opacity}/>`
      }

      const opacity = el.opacity === undefined ? '' : ` fill-opacity="${el.opacity}"`
      return `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="${color}"${opacity}/>`
    })
    .join('\n    ')
