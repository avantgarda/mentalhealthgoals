import type { Block } from 'payload'

/**
 * The programme's general enquiries email, placed inside a sentence of page
 * text. It stores nothing of its own: the site renders whatever Settings →
 * Programme details holds, so changing the address there changes every page
 * that uses it. With no fields, the editor inserts it straight away — there is
 * nothing to fill in.
 */
export const ProgrammeEmail: Block = {
  slug: 'programmeEmail',
  interfaceName: 'ProgrammeEmailInlineBlock',
  labels: { plural: 'Programme emails', singular: 'Programme email' },
  fields: [],
}
