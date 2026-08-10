import type { Block } from 'payload'

export const EventDetails: Block = {
  slug: 'eventDetails',
  interfaceName: 'EventDetailsBlock',
  labels: {
    singular: 'Event Details',
    plural: 'Event Details',
  },
  fields: [
    {
      name: 'facts',
      type: 'array',
      labels: {
        singular: 'Fact',
        plural: 'Facts',
      },
      admin: {
        initCollapsed: true,
        description: 'Key facts, e.g. Date / Venue / Audience',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'value',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'agendaHeading',
      type: 'text',
      defaultValue: 'Agenda',
    },
    {
      name: 'agenda',
      type: 'array',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'time',
          type: 'text',
        },
        {
          name: 'item',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'outcomesHeading',
      type: 'text',
      defaultValue: 'What you’ll leave with',
    },
    {
      name: 'outcomes',
      type: 'array',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
        },
      ],
    },
  ],
}
