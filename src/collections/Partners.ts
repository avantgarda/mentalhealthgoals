import type { CollectionConfig } from 'payload'
import { revalidateTag } from 'next/cache'

import { authenticated } from '../access/authenticated'
import { anyone } from '../access/anyone'

/**
 * The organisations the programme is funded by, delivered by and works with.
 *
 * A partner may have a logo or not. Without one it renders as a typographic
 * lockup (name over a short second line), which is the permission switch:
 * logos are trademarks, and several — the Royal Arms on any UK Government
 * mark, university identities — need the owner's consent before they appear
 * on a third-party site. Record the state of that consent in `usageNote`,
 * and upload the artwork the owner supplies when it arrives; nothing else
 * changes. Provenance for the seeded logos lives in
 * src/endpoints/seed/logos/LOGOS.md.
 */
export const Partners: CollectionConfig = {
  slug: 'partners',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'role', 'showInFooter', 'order'],
    description:
      'Funders, delivery partners and programme partners. Leave the logo empty to show the name as text until the organisation has confirmed its logo may be used.',
    group: 'Site',
    useAsTitle: 'name',
  },
  hooks: {
    // The seed runs outside a request, where revalidateTag has no store to
    // talk to — it opts out via context, as every other collection does.
    afterChange: [
      ({ doc, req: { context } }) => {
        if (!context.disableRevalidate) revalidateTag('partners', 'max')
        return doc
      },
    ],
    afterDelete: [
      ({ doc, req: { context } }) => {
        if (!context.disableRevalidate) revalidateTag('partners', 'max')
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'strapline',
      type: 'text',
      admin: {
        description:
          'Optional second line for the text lockup, e.g. "UK Government" under "Office for Life Sciences". Also read out with the logo.',
      },
    },
    {
      name: 'url',
      type: 'text',
      admin: { description: 'The organisation’s own website. Opens in a new tab.' },
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'partner',
      options: [
        { label: 'Funder', value: 'funder' },
        { label: 'Delivery partner', value: 'delivery' },
        { label: 'Programme partner', value: 'partner' },
      ],
      required: true,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'SVG preferred. For light backgrounds. Leave empty to show the name as text.',
      },
    },
    {
      name: 'showNameWithLogo',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        condition: (_data, siblingData) => Boolean(siblingData?.logo),
        description: 'For marks without a wordmark — shows the name beside the logo.',
      },
    },
    {
      name: 'logoScale',
      type: 'number',
      defaultValue: 1,
      min: 0.5,
      max: 2,
      admin: {
        condition: (_data, siblingData) => Boolean(siblingData?.logo),
        description:
          'Optical balance against the other logos in a row: 1 is the standard height, 1.3 makes a compact mark read as large as a wide wordmark.',
        step: 0.05,
      },
    },
    {
      name: 'showInFooter',
      type: 'checkbox',
      defaultValue: false,
      label: 'Show in the site footer',
      admin: {
        description:
          'The footer band is for accountability — who funds and who delivers. Programme partners belong in a Partner logos block on a page.',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Lower numbers come first.', position: 'sidebar' },
    },
    {
      name: 'usageNote',
      type: 'textarea',
      label: 'Permission and brand notes',
      // The collection is world-readable so the footer can render without a
      // session; without this, every internal permission note — who has and
      // has not cleared their logo — ships in the public REST and GraphQL
      // responses.
      access: { read: ({ req: { user } }) => Boolean(user) },
      admin: {
        description:
          'Internal. Where the artwork came from, who confirmed it may be used and any brand rules (clear space, no recolouring). Not published.',
        position: 'sidebar',
      },
    },
  ],
}
