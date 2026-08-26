import type { GlobalConfig } from 'payload'

import { DEFAULT_LOGO_VARIANT, LOGO_VARIANTS, MARKS } from '@/brand/marks'
import { revalidateBrand } from './hooks/revalidateBrand'

/**
 * Controls which logo mark the whole site uses — header, footer, favicons,
 * app icons and social cards all follow this one setting.
 *
 * The artwork for every variant is pre-generated into `public/brand/<variant>/`
 * by `pnpm generate:brand`, so switching here swaps the static files too.
 */
export const Brand: GlobalConfig = {
  slug: 'brand',
  label: 'Brand & Logo',
  access: {
    read: () => true,
  },
  admin: {
    description:
      'Choose the programme logo. The change applies across the site, including the browser tab icon and social sharing image.',
  },
  fields: [
    {
      name: 'logoVariant',
      type: 'select',
      label: 'Programme logo',
      required: true,
      defaultValue: DEFAULT_LOGO_VARIANT,
      options: LOGO_VARIANTS.map((value) => ({
        label: MARKS[value].label,
        value,
      })),
      admin: {
        description: 'Used in the header, the footer, the browser tab and shared links.',
      },
    },
    {
      name: 'preview',
      type: 'ui',
      admin: {
        components: {
          Field: '@/brand/LogoPreview#LogoPreview',
        },
      },
    },
    {
      name: 'showTagline',
      type: 'checkbox',
      label: 'Show "UK-wide Programme" beneath the name',
      defaultValue: true,
    },
  ],
  hooks: {
    afterChange: [revalidateBrand],
  },
}
