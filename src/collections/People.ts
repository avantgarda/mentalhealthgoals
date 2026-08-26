import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { revalidatePath } from 'next/cache'

export const People: CollectionConfig = {
  slug: 'people',
  labels: {
    singular: 'Person',
    plural: 'People',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'role', 'organisation'],
    useAsTitle: 'name',
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'text',
      required: true,
      admin: {
        description: 'e.g. "Lead, Alliance Management Team"',
      },
    },
    {
      name: 'organisation',
      type: 'text',
      required: true,
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'profileUrl',
      type: 'text',
      label: 'Profile URL',
      admin: {
        description:
          'Institutional profile page, for reference. Not published — names on the site link to this person’s entry on the Team page instead.',
      },
    },
    {
      name: 'group',
      type: 'select',
      required: true,
      defaultValue: 'collaborators',
      admin: {
        description: 'Which section of the Team page this person appears under.',
      },
      options: [
        { label: 'Programme leadership', value: 'leadership' },
        { label: 'DIGIT leadership', value: 'digit' },
        { label: 'Delivery team', value: 'delivery' },
        { label: 'Working with us', value: 'collaborators' },
      ],
    },
    {
      name: 'workstreams',
      type: 'relationship',
      relationTo: 'workstreams',
      hasMany: true,
      admin: {
        description:
          'Workstreams this person leads or works on — also lists them on those workstream pages.',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 99,
      admin: {
        position: 'sidebar',
        description: 'Lower numbers appear first',
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
