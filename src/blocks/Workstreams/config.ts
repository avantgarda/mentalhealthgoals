import type { Block } from 'payload'

export const WorkstreamsBlock: Block = {
  slug: 'workstreamsBlock',
  interfaceName: 'WorkstreamsBlockType',
  labels: {
    singular: 'Workstreams',
    plural: 'Workstreams',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
    },
    {
      name: 'intro',
      type: 'textarea',
    },
    {
      name: 'style',
      type: 'select',
      defaultValue: 'cards',
      options: [
        {
          label: 'Compact cards',
          value: 'cards',
        },
        {
          label: 'Detailed list',
          value: 'detailed',
        },
      ],
    },
  ],
}
