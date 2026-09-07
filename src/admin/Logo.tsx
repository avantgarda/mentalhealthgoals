import React from 'react'

import { BRAND_NAME, BRAND_TAGLINE } from '@/brand/tokens'
import { brandAssetPath, getBrandSettings } from '@/brand/getBrand'

/**
 * The lockup on the admin login screen.
 *
 * Built the way the site's own `Logo` component is — the mark as artwork, the
 * words as text — rather than dropping in the generated `lockup-horizontal.svg`.
 * That file sets its tagline at `font-size="11.5"` inside a 520-unit viewBox,
 * so at any width that fits the 480px login column the words render around
 * 6–7px: below anything legible, and well under the floor the site sets for its
 * own smallest label. Text that is text can simply be given a size.
 *
 * The mark still comes from the generated assets, so this follows whatever
 * variant the Brand global is set to. `getBrandSettings` falls back to the
 * default if the read fails, so the login screen renders either way.
 */
export const Logo = async () => {
  const { variant } = await getBrandSettings()

  return (
    <span className="mhg-admin-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" className="mhg-admin-logo__mark" src={brandAssetPath(variant, 'mark.svg')} />
      <span className="mhg-admin-logo__words">
        <span className="mhg-admin-logo__name">{BRAND_NAME}</span>
        <span className="mhg-admin-logo__tagline">{BRAND_TAGLINE}</span>
      </span>
    </span>
  )
}

export default Logo
