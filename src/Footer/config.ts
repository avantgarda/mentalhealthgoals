import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
        {
          // A placement flag rather than a taxonomy: it says where the link
          // goes, not what it means, so nobody has to decide whether the
          // accessibility statement counts as "legal".
          name: 'smallPrint',
          type: 'checkbox',
          label: 'Show in the small print row',
          defaultValue: false,
          admin: {
            description:
              'Moves this link out of the Site list and down beside the copyright — where visitors expect the accessibility and privacy statements.',
          },
        },
      ],
      // Headroom: the list flows into two columns in the footer, so it is no
      // longer the height of the block that limits it. It was capped at 12 and
      // already held 12.
      maxRows: 18,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}
