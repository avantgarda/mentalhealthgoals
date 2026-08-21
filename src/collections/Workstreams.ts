import type { CollectionConfig, Field } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { revalidatePath, revalidateTag } from 'next/cache'
import { slugField } from 'payload'

/** Repeatable bullet list — one `point` per row. */
const bulletList = (name: string, label: string, description: string): Field => ({
  name,
  type: 'array',
  label,
  admin: { description, initCollapsed: false },
  fields: [
    {
      name: 'point',
      type: 'textarea',
      required: true,
    },
  ],
})

export const Workstreams: CollectionConfig = {
  slug: 'workstreams',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['number', 'title', 'deliveredBy'],
    useAsTitle: 'title',
  },
  defaultSort: 'number',
  fields: [
    {
      name: 'number',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Order in which the workstream appears (1–6)',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      admin: {
        description: 'One-line description shown on cards',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Fuller description shown on the Workstreams page',
      },
    },
    {
      name: 'deliveredBy',
      type: 'text',
      required: true,
      label: 'Delivered by',
      admin: {
        description: 'Lead institution(s), e.g. "King’s College London"',
      },
    },
    {
      name: 'boundaryStatement',
      type: 'textarea',
      label: 'Boundary statement',
      admin: {
        description:
          'How this workstream defines its remit — shown as the lead statement on its own page.',
      },
    },
    bulletList('primaryFocus', 'Primary focus', 'What this workstream concentrates on.'),
    bulletList(
      'keyQuestions',
      'Key questions & challenges',
      'The questions this workstream exists to answer.',
    ),
    bulletList(
      'differentiators',
      'How this differs from other infrastructure',
      'What distinguishes this workstream from the others and from the wider landscape.',
    ),
    // URL for this workstream's own page, generated from the title
    slugField(),
  ],
  hooks: {
    afterChange: [
      ({ req: { context } }) => {
        if (!context.disableRevalidate) {
          revalidatePath('/', 'layout')
          // Workstream detail pages are listed in the sitemap
          revalidateTag('pages-sitemap', 'max')
        }
      },
    ],
    afterDelete: [
      ({ req: { context } }) => {
        if (!context.disableRevalidate) {
          revalidatePath('/', 'layout')
          revalidateTag('pages-sitemap', 'max')
        }
      },
    ],
  },
}
