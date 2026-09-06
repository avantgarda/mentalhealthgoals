import type { GlobalConfig } from 'payload'

import { revalidateProgrammeDetails } from './hooks/revalidateProgrammeDetails'

/**
 * The footer's one-sentence description of the programme. Names no single
 * institution: the programme is delivered by partners in all four nations, and
 * the accountability band above the footer already carries who funds and who
 * delivers. Exported so the footer's fallback and this default cannot drift.
 */
export const FOOTER_DESCRIPTION =
  'A UK Government-backed, UK-wide programme transforming mental health research, delivered by university, NHS, industry and lived experience partners across all four nations.'

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
      'The programme’s own description and contact details — shown in the site footer. People and their individual contact details live in the People collection.',
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
      name: 'description',
      type: 'textarea',
      label: 'Footer description',
      defaultValue: FOOTER_DESCRIPTION,
      admin: {
        description: 'The sentence under the logo in the footer.',
      },
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
