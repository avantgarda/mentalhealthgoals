import type { CollectionAfterReadHook } from 'payload'
import type { Media } from '@/payload-types'

/** serverURL is required for auth links, but local Media routes must stay relative:
 * Next's image optimizer rejects private-IP HTTP fetches, and previews must use
 * their own files. Normalize only this deployment's file route, never a CDN URL.
 * This changes the API representation, not stored files or database records.
 */
export const relativeMediaUrls: CollectionAfterReadHook<Media> = ({ doc, req }) => {
  const origin = req.payload.config.serverURL
  if (!origin) return doc
  const prefix = `${req.payload.config.routes.api}/media/file/`
  const relative = (value: string | null | undefined) => {
    if (!value || !/^https?:\/\//.test(value)) return value
    try {
      const url = new URL(value)
      if (url.origin === origin && url.pathname.startsWith(prefix)) {
        return `${url.pathname}${url.search}${url.hash}`
      }
    } catch {
      // Leave malformed values to the normal consumer validation.
    }
    return value
  }
  return {
    ...doc,
    url: relative(doc.url),
    thumbnailURL: relative(doc.thumbnailURL),
    ...(doc.sizes
      ? {
          sizes: Object.fromEntries(
            Object.entries(doc.sizes).map(([name, size]) => [
              name,
              size ? { ...size, url: relative(size.url) } : size,
            ]),
          ),
        }
      : {}),
  }
}
