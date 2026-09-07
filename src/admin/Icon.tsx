import React from 'react'

import { brandAssetPath, getBrandSettings } from '@/brand/getBrand'

/**
 * The small mark in the admin's top-left, beside the nav. Same source as the
 * login lockup — see ./Logo.
 */
export const Icon = async () => {
  const { variant } = await getBrandSettings()

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="mhg-admin-icon" src={brandAssetPath(variant, 'mark.svg')} />
  )
}

export default Icon
