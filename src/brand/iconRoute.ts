import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

import { brandAssetPath, getBrandSettings } from './getBrand'

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

/**
 * Serves the well-known icon paths — /favicon.ico, /favicon.png, /favicon.svg,
 * /apple-touch-icon.png — with the asset for the current logo variant.
 *
 * The <link> tags in the layout already follow the Brand global, but plenty of
 * fetchers never read them: browsers guessing /favicon.ico, crawlers, and
 * dashboard icon scrapers (Vercel's project icon among them) request the root
 * paths directly. Static files under public/ shadowed those paths with the
 * retired rings mark long after the rest of the site had moved on.
 *
 * A direct 200 with the bytes, not a redirect: icon scrapers are notorious for
 * refusing to follow redirects, and a fetcher that gets a non-200 keeps
 * whatever icon it last saw — the first version of this fix answered 302 and
 * would have left them stale forever. The files are tiny (~1KB), read from the
 * traced public/brand directory (see outputFileTracingIncludes), with the
 * redirect kept only as a fallback if the read ever fails. The one-hour cache
 * keeps fetchers off the database while letting a variant change propagate.
 */
export const brandIconRoute = (file: string) => {
  return async (request: Request): Promise<Response> => {
    const brand = await getBrandSettings()
    const assetPath = brandAssetPath(brand.variant, file)

    try {
      const bytes = await readFile(path.join(process.cwd(), 'public', assetPath))
      return new Response(new Uint8Array(bytes), {
        headers: {
          'Content-Type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch {
      const response = NextResponse.redirect(new URL(assetPath, request.url), 302)
      response.headers.set('Cache-Control', 'public, max-age=3600')
      return response
    }
  }
}
