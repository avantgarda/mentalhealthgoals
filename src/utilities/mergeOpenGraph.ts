import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: 'A UK Government-backed national programme transforming mental health research.',
  images: [
    {
      // Static default (this module is synchronous); generateMeta and the root
      // layout pass the current brand variant's card, so this is rarely used.
      url: `${getServerSideURL()}/brand/summit/og.png`,
    },
  ],
  siteName: 'Mental Health Goals Programme',
  title: 'Mental Health Goals Programme',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
