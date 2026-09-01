import { NextResponse } from 'next/server'

import { brandAssetPath, getBrandSettings } from './getBrand'

/**
 * Serves the well-known icon paths — /favicon.ico, /favicon.png, /favicon.svg,
 * /apple-touch-icon.png — by redirecting to the asset for the current logo
 * variant.
 *
 * The <link> tags in the layout already follow the Brand global, but plenty of
 * fetchers never read them: browsers guessing /favicon.ico, crawlers, and
 * dashboard icon scrapers (Vercel's project icon among them) request the root
 * paths directly. Static files under public/ shadowed those paths with the
 * retired rings mark long after the rest of the site had moved on — this keeps
 * every route to an icon answering with the same identity.
 *
 * A short cache keeps fetchers from hammering the database while letting a
 * variant change propagate within the hour.
 */
export const brandIconRoute = (file: string) => {
  return async (request: Request): Promise<NextResponse> => {
    const brand = await getBrandSettings()
    const response = NextResponse.redirect(
      new URL(brandAssetPath(brand.variant, file), request.url),
      302,
    )
    response.headers.set('Cache-Control', 'public, max-age=3600')
    return response
  }
}
