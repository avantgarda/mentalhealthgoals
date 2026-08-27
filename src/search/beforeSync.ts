import type { BeforeSync, DocToSync } from '@payloadcms/plugin-search/types'

import { personAnchor } from '@/utilities/personAnchor'
import { collectSearchableText } from './collectSearchableText'
import { resultTypeFor } from './resultTypes'

type Doc = Record<string, unknown>

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined

const asDoc = (value: unknown): Doc => (value && typeof value === 'object' ? (value as Doc) : {})

/** Where a result sends the visitor. Stored on the document so the results UI
 *  needs no per-collection branching. */
const pathFor = (collection: string, doc: Doc): string => {
  const slug = str(doc.slug)
  switch (collection) {
    case 'pages':
      return !slug || slug === 'home' ? '/' : `/${slug}`
    case 'posts':
      return `/posts/${slug}`
    case 'workstreams':
      return `/workstreams/${slug}`
    // People have no page of their own — their card on the Team page is the
    // destination, which is what `personAnchor` exists to address.
    case 'people':
      return `/people#${personAnchor(str(doc.name) ?? '')}`
    default:
      return '/'
  }
}

/**
 * A standfirst for the result. Pages and posts have a real meta description;
 * workstreams and people do not, so their own summary fields stand in rather
 * than leaving the result as a bare title.
 */
const descriptionFor = (collection: string, doc: Doc): string | undefined => {
  const fromMeta = str(asDoc(doc.meta).description)
  if (fromMeta) return fromMeta
  if (collection === 'workstreams') return str(doc.summary)
  if (collection === 'people')
    return str([doc.role, doc.organisation].filter((part) => str(part)).join(' · '))
  return undefined
}

export const beforeSyncWithSearch: BeforeSync = async ({
  collectionSlug,
  req,
  originalDoc,
  searchDoc,
}) => {
  const { categories, id, meta, name, slug, title } = originalDoc

  const modifiedDoc: DocToSync = {
    ...searchDoc,
    // The plugin reads `doc.title` literally rather than the collection's
    // `useAsTitle`, so People — who have `name` — arrive with no title at all.
    title: title || name || searchDoc.title,
    // People are also the one indexed collection with no slug of their own.
    slug: slug || (collectionSlug === 'people' ? personAnchor(name || '') : undefined),
    type: resultTypeFor(collectionSlug),
    path: pathFor(collectionSlug, originalDoc),
    body: collectSearchableText(collectionSlug, originalDoc),
    meta: {
      ...meta,
      title: meta?.title || title || name,
      image: meta?.image?.id || meta?.image,
      description: descriptionFor(collectionSlug, originalDoc),
    },
    categories: [],
  }

  if (categories && Array.isArray(categories) && categories.length > 0) {
    const populatedCategories: { id: string | number; title: string }[] = []
    for (const category of categories) {
      if (!category) {
        continue
      }

      if (typeof category === 'object') {
        populatedCategories.push(category)
        continue
      }

      const doc = await req.payload.findByID({
        collection: 'categories',
        id: category,
        disableErrors: true,
        depth: 0,
        select: { title: true },
        req,
      })

      if (doc !== null) {
        populatedCategories.push(doc)
      } else {
        console.error(
          `Failed. Category not found when syncing collection '${collectionSlug}' with id: '${id}' to search.`,
        )
      }
    }

    modifiedDoc.categories = populatedCategories.map((each) => ({
      relationTo: 'categories',
      categoryID: String(each.id),
      title: each.title,
    }))
  }

  return modifiedDoc
}
