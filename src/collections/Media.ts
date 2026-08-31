import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Sharp's defaults (webp quality 80) are tuned for photographs and are visibly
 * too low for flat colour and hairline strokes — the programme's ridge artwork
 * came out of the resize with roughly twice the error of a q95 encode, and it
 * showed as pixelation along the contour lines.
 *
 * Applied to every size rather than only the ones the frontend reads: all of
 * them are served publicly from `/api/media/file/...`, so any of them can be
 * opened and judged, and a derivative that exists should be worth looking at.
 * It does mean paying for quality on sizes nothing currently reads, which is
 * an argument for shortening this list rather than for encoding it badly.
 */
const CRISP_WEBP = {
  format: 'webp',
  options: { quality: 95, effort: 6 },
} as const

export const Media: CollectionConfig = {
  slug: 'media',
  folders: true,
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      // Required for accessibility (WCAG) — every image needs alt text
      required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: path.resolve(dirname, '../../public/media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        formatOptions: CRISP_WEBP,
      },
      {
        name: 'square',
        width: 500,
        height: 500,
        formatOptions: CRISP_WEBP,
      },
      {
        name: 'small',
        width: 600,
        formatOptions: CRISP_WEBP,
      },
      {
        name: 'medium',
        width: 900,
        formatOptions: CRISP_WEBP,
      },
      {
        name: 'large',
        width: 1400,
        formatOptions: CRISP_WEBP,
      },
      {
        name: 'xlarge',
        width: 1920,
        formatOptions: CRISP_WEBP,
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
        formatOptions: CRISP_WEBP,
      },
    ],
  },
}
