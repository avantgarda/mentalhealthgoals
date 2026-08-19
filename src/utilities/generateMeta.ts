import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { brandAssetPath, getBrandSettings } from '@/brand/getBrand'
import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

const getImageURL = async (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  if (image && typeof image === 'object' && 'url' in image) {
    const ogUrl = image.sizes?.og?.url

    return ogUrl ? serverUrl + ogUrl : serverUrl + image.url
  }

  // No meta image set — fall back to the programme's own OG card for the
  // currently selected logo variant.
  const brand = await getBrandSettings()
  return serverUrl + brandAssetPath(brand.variant, 'og.png')
}

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
}): Promise<Metadata> => {
  const { doc } = args

  const ogImage = await getImageURL(doc?.meta?.image)

  const siteName = 'Mental Health Goals Programme'
  const title =
    doc?.meta?.title && doc.meta.title !== siteName ? `${doc.meta.title} | ${siteName}` : siteName

  return {
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
}
