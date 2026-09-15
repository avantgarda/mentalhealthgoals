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
export const BRAND_TAGLINE = 'National Programme'
/**
 * The public address, for places that print it as part of the identity — the
 * footer colophon, the admin sign-in. Absolute links and canonical tags come
 * from NEXT_PUBLIC_SERVER_URL instead, which follows the environment; this
 * does not, on purpose, so a preview's footer never advertises its own host.
 */
export const BRAND_DOMAIN = 'www.mentalhealthgoals.co.uk'
