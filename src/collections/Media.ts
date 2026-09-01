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
 * How images work on this site — read before adding sizes here.
 *
 * Pages serve the ORIGINAL upload through Next's image optimizer, which
 * resizes on demand for each viewport/DPR and caches the result (see
 * `src/components/Media/ImageMedia`). Payload's `imageSizes` play no part in
 * that, so this list holds only the two derivatives something actually reads:
 *
 * - `og` — the 1200x630 social card, read by `generateMeta` and fetched by
 *   LinkedIn/Teams/Slack when a page is shared.
 * - `thumbnail` — what the admin panel shows as an upload's preview.
 *
 * The website template shipped five more (square/small/medium/large/xlarge);
 * nothing referenced them, they tripled storage and upload time, and opening
 * one directly at `/api/media/file/...` invited judging the site by files the
 * site never serves. Re-adding a size is a config change plus a migration.
 *
 * `formatOptions`: sharp's webp default (quality 80) is tuned for photographs
 * and visibly degrades flat colour and hairline strokes — the ridge artwork
 * came out with roughly twice the error of a q95 encode.
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
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
        formatOptions: CRISP_WEBP,
      },
    ],
  },
}
