/**
 * The editorial grid's reading column.
 *
 * It steps right to clear the gutter beside it — the eyebrow label, the section
 * heading, the "on this page" nav, the form's standing ask. When that gutter is
 * empty there is nothing to clear, and the step strands the passage a third of
 * the way across the page with blank ground to its left. A reader reads that as
 * a box in the wrong place, because it is one.
 *
 * Every gutter on this site is conditional — a heading an editor can clear, a
 * nav that only appears when a workstream has sections, an intro that goes away
 * once a form has been submitted — so the offset has to be conditional too, in
 * all of them. Hence one place to ask.
 *
 * The strings are literal on purpose. Tailwind scans source text for class
 * names, so one assembled at runtime is one that never gets generated.
 */
const COLUMNS = {
  /** Eight of twelve, clearing a three-column gutter. The common case. */
  default: { withGutter: 'lg:col-span-8 lg:col-start-5', alone: 'lg:col-span-8' },
  /** Seven of twelve, clearing a four-column gutter — the forms. */
  wide: { withGutter: 'lg:col-span-7 lg:col-start-6', alone: 'lg:col-span-7' },
} as const

export type ReadingColumnVariant = keyof typeof COLUMNS

export const readingColumn = (
  hasGutter: boolean,
  variant: ReadingColumnVariant = 'default',
): string => COLUMNS[variant][hasGutter ? 'withGutter' : 'alone']
