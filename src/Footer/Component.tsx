import { getBrandSettings } from '@/brand/getBrand'
import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { MotionToggle } from '@/providers/Motion/MotionToggle'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()
  const brand = await getBrandSettings()
  const details = await getCachedGlobal('programmeDetails', 0)()

  const navItems = footerData?.navItems || []
  const hasContact = Boolean(details?.email || details?.phone || details?.address)

  return (
    <footer className="mt-auto bg-brand-deep text-white" data-theme="dark">
      <div className="container pb-10 pt-14">
        <div className="grid grid-cols-1 gap-x-10 gap-y-12 border-t border-white/15 pt-10 lg:grid-cols-12">
          <div className="flex max-w-md flex-col gap-5 lg:col-span-5">
            <Link className="flex w-fit items-center" href="/">
              <Logo showTagline={brand.showTagline} variant={brand.variant} />
            </Link>
            <p className="text-[0.95rem] leading-relaxed text-white/75">
              A UK Government-backed national programme transforming mental health research —
              delivered by King&apos;s College London with university, NHS, industry and lived
              experience partners across the UK.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="lg:col-span-3">
            <p className="eyebrow mb-4 !text-white/55">Site</p>
            <ul className="flex flex-col gap-2.5 text-[0.95rem]">
              {navItems.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink
                      appearance="inline"
                      className="link-line text-white/85 hover:text-white"
                      {...link}
                    />
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="lg:col-span-4">
            {hasContact && (
              <>
                <p className="eyebrow mb-4 !text-white/55">Contact</p>
                <div className="flex flex-col gap-2 text-[0.95rem] text-white/85">
                  {details?.email && (
                    <a
                      className="link-line w-fit hover:text-white"
                      href={`mailto:${details.email}`}
                    >
                      {details.email}
                    </a>
                  )}
                  {details?.phone && (
                    <a
                      className="link-line w-fit hover:text-white"
                      href={`tel:${details.phone.replace(/\s+/g, '')}`}
                    >
                      {details.phone}
                    </a>
                  )}
                  {details?.address && (
                    <p className="whitespace-pre-line text-white/75">{details.address}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/15 pt-5 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {details?.name || 'Mental Health Goals Programme'} ·
            mentalhealthgoals.co.uk
          </p>
          <div className="flex items-center gap-6">
            <MotionToggle />
            <ThemeSelector />
          </div>
        </div>
      </div>
    </footer>
  )
}
