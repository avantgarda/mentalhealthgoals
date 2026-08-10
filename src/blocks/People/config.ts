import type { Block } from 'payload'

export const PeopleBlock: Block = {
  slug: 'peopleBlock',
  interfaceName: 'PeopleBlockType',
  labels: {
    singular: 'People',
    plural: 'People',
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
  ],
}
