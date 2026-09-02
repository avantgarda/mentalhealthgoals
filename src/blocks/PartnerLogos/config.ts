import type { Block } from 'payload'

/**
 * A labelled row of partner logos, placeable in a page layout or inside rich
 * text. Editors pick the partners; the logo-or-text rendering, sizing and
 * links come from the Partners collection so every row on the site agrees.
 */
export const PartnerLogos: Block = {
  slug: 'partnerLogos',
  interfaceName: 'PartnerLogosBlock',
  labels: { plural: 'Partner logo rows', singular: 'Partner logos' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: { description: 'Short label above the row, e.g. "Working with" or "Hosted by".' },
    },
    {
      name: 'partners',
      type: 'relationship',
      hasMany: true,
      relationTo: 'partners',
      required: true,
    },
  ],
}
