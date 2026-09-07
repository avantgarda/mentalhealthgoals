/**
 * Canonical geometry for the MHG logo marks.
 *
 * This module is the single source of truth: the React components in
 * `src/components/Logo` and the static asset generator in
 * `scripts/generate-brand-assets.ts` both render from these definitions, so
 * the marks on the site and the exported files can never drift apart.
 *
 * Marks are drawn on a grid 96 units tall. Square marks are 96 wide; the
 * acronym marks are wider and declare their own `width`. Every mark is
 * optically centred — content is centred on the middle of its box rather than
 * being mathematically centred on its bounding box — and drawn at the same
 * stroke scale, so swapping variants keeps the same weight in the header.
 *
 * Wide or detailed marks also declare a `compact` glyph: what the mark tiers
 * down to at favicon sizes (48 px and below), where three letterforms or a
 * faint reflection would be illegible. App icons, avatars and social cards
 * carry the full mark.
 */

export const LOGO_VARIANTS = [
  'summit',
  'sunInCol',
  'rings',
  'writtenInWater',
  'goalInWater',
] as const

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
      opacity?: number
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
  /** Drawing width in grid units. Height is always 96. Defaults to 96 (square). */
  width?: number
  /**
   * Simplified glyph used at favicon sizes (48 px and below). Always drawn in a
   * 96 x 96 box. Defaults to `elements`.
   */
  compact?: MarkElement[]
}

export const MARK_HEIGHT = 96

/** Kept for callers that only ever draw square marks. Prefer `markViewBox`. */
export const MARK_VIEWBOX = '0 0 96 96'

export type MarkMode = 'full' | 'compact'

/**
 * The shared skyline. Summit M and Sun in the Col are the same mountain drawn
 * with different joins — sharp when the goal is ahead of the climb, round when
 * the light is held between the peaks. Sun in the Col sits 2.5 units higher so
 * that each mark is independently centred on (48, 48).
 */
const SUMMIT_SKYLINE = 'M 16 82 L 33 46 L 46 72 L 61 38 L 80 82'
const SUN_SKYLINE = 'M 16 73.5 L 33 37.5 L 46 63.5 L 61 29.5 L 80 73.5'

const SUMMIT_ELEMENTS: MarkElement[] = [
  {
    kind: 'path',
    d: SUMMIT_SKYLINE,
    role: 'form',
    strokeWidth: 8,
    linecap: 'round',
    linejoin: 'miter',
  },
  { kind: 'circle', cx: 61, cy: 17.5, r: 8, role: 'accent' },
]

export const MARKS: Record<LogoVariant, MarkDefinition> = {
  summit: {
    label: 'Summit M — sharp peaks, goal above',
    description: 'Rising peaks forming an M, with the amber goal floating clear above the summit.',
    note: 'The aspirational mark. Full-miter peaks give an alpine cut; the goal clears the miter tip by 2.5 units — close enough for tension, never touching.',
    elements: SUMMIT_ELEMENTS,
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
  writtenInWater: {
    label: 'Written in Water — H and G beside the mountain',
    description:
      'Summit M with the H and G standing alongside it on the shoreline, spelling the acronym.',
    note: 'The acronym mark. The letters share the mountain’s stroke and sit level with its lower peak, drawn at 40% so they keep the translucent, written-on-water quality of the original; the G is a true single-stroke G with an inward spur. Below 48 px it tiers down to Summit M alone.',
    width: 184,
    elements: [
      ...SUMMIT_ELEMENTS,
      {
        kind: 'path',
        d: 'M 98 82 L 98 46 M 98 64 L 116 64 M 116 46 L 116 82',
        role: 'form',
        strokeWidth: 8,
        linecap: 'round',
        linejoin: 'round',
        opacity: 0.4,
      },
      {
        kind: 'path',
        d: 'M 162.1 49.8 A 18 18 0 1 0 169 64 L 159.1 64',
        role: 'form',
        strokeWidth: 8,
        linecap: 'round',
        linejoin: 'round',
        opacity: 0.4,
      },
    ],
    compact: SUMMIT_ELEMENTS,
  },
  goalInWater: {
    label: 'Goal in the Water — the G reflected below',
    description:
      'The mountain and an H stand on the shore; what reflects in the water beneath is the amber G.',
    note: 'The narrative mark: look into the water and the goal is what you find. As in the original, the G is reflected beneath the point where the mountain meets the H, at 80% amber so it reads as submerged without going pale. Below 48 px it tiers down to the peaks over the reflected G.',
    elements: [
      {
        kind: 'path',
        d: 'M 8 57 L 22 28 L 33 47 L 46 23 L 62 57',
        role: 'form',
        strokeWidth: 7,
        linecap: 'round',
        linejoin: 'round',
      },
      { kind: 'circle', cx: 46, cy: 10.5, r: 6.5, role: 'accent' },
      {
        kind: 'path',
        d: 'M 70 57 L 70 28 M 70 42.5 L 86 42.5 M 86 28 L 86 57',
        role: 'form',
        strokeWidth: 7,
        linecap: 'round',
        linejoin: 'round',
      },
      {
        kind: 'path',
        d: 'M 71.9 69.5 A 9.5 9.5 0 1 0 75.5 77 L 69.8 77',
        role: 'accent',
        strokeWidth: 6.5,
        linecap: 'round',
        linejoin: 'round',
        opacity: 0.8,
      },
    ],
    compact: [
      {
        kind: 'path',
        d: 'M 16 58 L 33 22 L 46 48 L 61 14 L 80 58',
        role: 'form',
        strokeWidth: 8,
        linecap: 'round',
        linejoin: 'round',
      },
      {
        kind: 'path',
        d: 'M 53.5 70.9 A 9 9 0 1 0 57 78 L 51.6 78',
        role: 'accent',
        strokeWidth: 7,
        linecap: 'round',
        linejoin: 'round',
        opacity: 0.8,
      },
    ],
  },
}

export const markWidth = (variant: LogoVariant, mode: MarkMode = 'full'): number =>
  mode === 'compact' ? MARK_HEIGHT : (MARKS[variant].width ?? MARK_HEIGHT)

export const markViewBox = (variant: LogoVariant, mode: MarkMode = 'full'): string =>
  `0 0 ${markWidth(variant, mode)} ${MARK_HEIGHT}`

export const markElements = (variant: LogoVariant, mode: MarkMode = 'full'): MarkElement[] =>
  mode === 'compact' ? (MARKS[variant].compact ?? MARKS[variant].elements) : MARKS[variant].elements

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
  mode: MarkMode = 'full',
): string =>
  markElements(variant, mode)
    .map((el) => {
      const color = el.role === 'form' ? colors.form : colors.accent

      if (el.kind === 'path') {
        const opacity = el.opacity === undefined ? '' : ` stroke-opacity="${el.opacity}"`
        return `<path d="${el.d}" fill="none" stroke="${color}" stroke-width="${el.strokeWidth}" stroke-linecap="${el.linecap}" stroke-linejoin="${el.linejoin}"${opacity}/>`
      }

      if (el.strokeWidth) {
        const opacity = el.opacity === undefined ? '' : ` stroke-opacity="${el.opacity}"`
        return `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="none" stroke="${color}" stroke-width="${el.strokeWidth}"${opacity}/>`
      }

      const opacity = el.opacity === undefined ? '' : ` fill-opacity="${el.opacity}"`
      return `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="${color}"${opacity}/>`
    })
    .join('\n    ')
