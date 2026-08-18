import { HeaderClient } from './Component.client'
import { getBrandSettings } from '@/brand/getBrand'
import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

export async function Header() {
  const headerData = await getCachedGlobal('header', 1)()
  const brand = await getBrandSettings()

  return <HeaderClient brand={brand} data={headerData} />
}
