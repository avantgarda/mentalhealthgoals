import { Field } from 'payload'

import { RESULT_TYPES } from './resultTypes'

export const searchFields: Field[] = [
  {
    name: 'type',
    type: 'select',
    index: true,
    admin: {
      readOnly: true,
      description: 'Which kind of thing this result points at.',
    },
    options: RESULT_TYPES.map(({ label, value }) => ({ label, value })),
  },
  {
    name: 'path',
    type: 'text',
    admin: {
      readOnly: true,
      description: 'The URL a visitor is sent to when they choose this result.',
    },
  },
  {
    name: 'body',
    type: 'textarea',
    admin: {
      readOnly: true,
      description:
        'Prose flattened out of the document so that a phrase from the middle of a page is findable, not just its title.',
    },
  },
  {
    name: 'slug',
    type: 'text',
    index: true,
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'meta',
    label: 'Meta',
    type: 'group',
    index: true,
    admin: {
      readOnly: true,
    },
    fields: [
      {
        type: 'text',
        name: 'title',
        label: 'Title',
      },
      {
        type: 'text',
        name: 'description',
        label: 'Description',
      },
      {
        name: 'image',
        label: 'Image',
        type: 'upload',
        relationTo: 'media',
      },
    ],
  },
  {
    label: 'Categories',
    name: 'categories',
    type: 'array',
    admin: {
      readOnly: true,
    },
    fields: [
      {
        name: 'relationTo',
        type: 'text',
      },
      {
        name: 'categoryID',
        type: 'text',
      },
      {
        name: 'title',
        type: 'text',
      },
    ],
  },
]
