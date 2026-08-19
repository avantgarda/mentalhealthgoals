import { getBrandSettings } from '@/brand/getBrand'
import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()
  const brand = await getBrandSettings()

  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto bg-brand-deep text-white" data-theme="dark">
      <div className="container py-14 flex flex-col gap-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between md:items-start">
          <div className="max-w-md flex flex-col gap-4">
            <Link className="flex items-center" href="/">
              <Logo showTagline={brand.showTagline} variant={brand.variant} />
            </Link>
            <p className="text-sm leading-relaxed opacity-70">
              A UK Government-backed national programme transforming mental health research —
              delivered by King&apos;s College London with university, NHS, industry and lived
              experience partners across the UK.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm md:pt-2">
            {navItems.map(({ link }, i) => {
              return <CMSLink className="text-white/85 hover:text-white" key={i} {...link} />
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/15 pt-6 text-xs opacity-60 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} Mental Health Goals Programme · mentalhealthgoals.co.uk
          </p>
          <ThemeSelector />
        </div>
      </div>
    </footer>
  )
}
