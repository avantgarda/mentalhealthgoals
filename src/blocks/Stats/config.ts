import type { Block } from 'payload'

export const Stats: Block = {
  slug: 'stats',
  interfaceName: 'StatsBlock',
  labels: {
    singular: 'Stats',
    plural: 'Stats',
  },
  fields: [
    {
      name: 'items',
      type: 'array',
      minRows: 2,
      maxRows: 4,
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'value',
          type: 'text',
          required: true,
          admin: {
            description: 'The big number, e.g. "£50M"',
          },
        },
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'sublabel',
          type: 'text',
        },
      ],
    },
  ],
}
