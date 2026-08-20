import type { GlobalConfig } from 'payload'

import { revalidateProgrammeDetails } from './hooks/revalidateProgrammeDetails'

/**
 * Programme-wide details — the name, contact email, phone and address of the
 * programme itself (individual people live in the People collection). Shown in
 * the footer; edit once here and it updates everywhere it's used.
 *
 * Like the Brand global, this persists across reseeds — the field defaults
 * cover a fresh database, and editor changes are never overwritten by the seed.
 */
export const ProgrammeDetails: GlobalConfig = {
  slug: 'programmeDetails',
  label: 'Programme details',
  access: {
    read: () => true,
  },
  admin: {
    description:
      'Contact details for the programme as a whole — shown in the site footer. People and their individual contact details live in the People collection.',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Programme name',
      required: true,
      defaultValue: 'Mental Health Goals Programme',
      admin: {
        description: 'Used in the footer copyright line.',
      },
    },
    {
      name: 'organisation',
      type: 'text',
      label: 'Lead organisation',
      defaultValue: 'King’s College London',
    },
    {
      name: 'email',
      type: 'email',
      label: 'General enquiries email',
      defaultValue: 'enquiries@mentalhealthgoals.co.uk',
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Phone number',
    },
    {
      name: 'address',
      type: 'textarea',
      label: 'Postal address',
      admin: {
        description: 'One line per row — shown in the footer exactly as typed.',
      },
    },
  ],
  hooks: {
    afterChange: [revalidateProgrammeDetails],
  },
}
