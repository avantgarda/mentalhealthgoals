/**
 * Brand colours as hex, converted from the oklch design tokens in
 * `src/app/(frontend)/globals.css` so that exported asset files match the
 * live site exactly.
 *
 * On the site itself the marks inherit `currentColor` and `var(--brand-accent)`
 * so they follow light/dark themes automatically — these literals are only for
 * standalone files (favicons, app icons, social cards) which cannot inherit.
 */

export const BRAND_COLORS = {
  /** --primary (light) — petrol, the mark's form colour on light grounds */
  petrol: '#15545B',
  /** --brand-deep (light) — the deep ground used for tiles and app icons */
  deep: '#05313A',
  /** --brand-accent (light) — the amber goal */
  amber: '#CE7A3B',
  /** --brand-accent (dark) — slightly lifted amber for dark grounds */
  amberOnDark: '#D78A46',
  /** --foreground (dark) — the mark's form colour when reversed out */
  reversed: '#ECF4F3',
  /** --foreground (light) */
  ink: '#18272B',
  /** --background (light) */
  paper: '#FBFAF7',
  monoBlack: '#111111',
  monoWhite: '#F2F2F2',
} as const

export const BRAND_NAME = 'Mental Health Goals'
export const BRAND_TAGLINE = 'UK-wide Programme'
