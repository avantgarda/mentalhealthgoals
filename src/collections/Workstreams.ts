import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { revalidatePath } from 'next/cache'

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
  ],
  hooks: {
    afterChange: [
      ({ req: { context } }) => {
        if (!context.disableRevalidate) revalidatePath('/', 'layout')
      },
    ],
    afterDelete: [
      ({ req: { context } }) => {
        if (!context.disableRevalidate) revalidatePath('/', 'layout')
      },
    ],
  },
}
