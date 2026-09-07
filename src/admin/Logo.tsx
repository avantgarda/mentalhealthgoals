import React from 'react'

import { getBrandSettings } from '@/brand/getBrand'
import { brandAssetPath } from '@/brand/getBrand'

/**
 * The lockup on the admin login screen.
 *
 * Uses the generated lockup in `public/brand/<variant>/`, so the admin follows
 * whatever mark the Brand global is set to rather than pinning a second copy of
 * the logo that would drift from the site's. `getBrandSettings` already falls
 * back to the default variant if the read fails, so a database that cannot
 * answer still renders a logo rather than breaking the login screen.
 */
export const Logo = async () => {
  const { variant } = await getBrandSettings()

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="Mental Health Goals Programme"
      className="mhg-admin-logo"
      src={brandAssetPath(variant, 'lockup-horizontal.svg')}
    />
  )
}

export default Logo
