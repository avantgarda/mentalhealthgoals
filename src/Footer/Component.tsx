import { getBrandSettings } from '@/brand/getBrand'
import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { MotionToggle } from '@/providers/Motion/MotionToggle'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'
import { PartnerGroup } from '@/components/PartnerLogo'
import { getCachedPartners } from '@/utilities/getPartners'
import { FOOTER_DESCRIPTION } from '@/ProgrammeDetails/config'

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()
  const brand = await getBrandSettings()
  const details = await getCachedGlobal('programmeDetails', 0)()

  const navItems = footerData?.navItems || []
  // Accessibility and privacy statements belong beside the copyright, which is
  // where visitors look for them — and it keeps them out of a Site list that
  // otherwise reads as the site's own sections.
  const siteLinks = navItems.filter((item) => !item.smallPrint)
  const smallPrintLinks = navItems.filter((item) => item.smallPrint)
  const partners = (await getCachedPartners()).filter((p) => p.showInFooter)
  const byRole = (role: string) => partners.filter((p) => p.role === role)
  const hasContact = Boolean(details?.email || details?.phone || details?.address)

  return (
    <>
      {/* Accountability band: who funds and who delivers, on the page ground so
          full-colour partner artwork never has to fight the dark footer. */}
      {partners.length > 0 && (
        <section
          aria-label="Funded and delivered by"
          className="partner-plate mt-auto border-t border-border"
        >
          <div className="container flex flex-col gap-8 py-10 lg:flex-row lg:items-start lg:gap-20 lg:py-12">
            <PartnerGroup label="Funded by" partners={byRole('funder')} />
            <PartnerGroup label="Delivered by" partners={byRole('delivery')} />
            <PartnerGroup label="In partnership with" partners={byRole('partner')} />
          </div>
        </section>
      )}
      <footer className="mt-auto bg-brand-deep text-white" data-theme="dark">
        <div className="container pb-10 pt-14">
          <div className="grid grid-cols-1 gap-x-10 gap-y-12 border-t border-white/15 pt-10 lg:grid-cols-12">
            <div className="flex max-w-md flex-col gap-5 lg:col-span-4">
              <Link className="flex w-fit items-center" href="/">
                <Logo showTagline={brand.showTagline} variant={brand.variant} />
              </Link>
              <p className="text-[1rem] leading-relaxed text-white/75">
                {details?.description || FOOTER_DESCRIPTION}
              </p>
            </div>

            {/* Two columns, not one tower. A single stack of a dozen links was
                already the height of the whole footer and the nav is capped in
                the CMS, so it could not grow without running past the block
                beside it. Flowing them into columns halves the height and takes
                any number of links — `margin-bottom` on each row rather than a
                gap, because a column gap would leave the first item of the
                second column indented by one row against the first. */}
            <nav aria-label="Footer navigation" className="lg:col-span-5">
              <p className="eyebrow mb-4 !text-white/55">Site</p>
              <ul className="columns-1 gap-x-8 text-[1rem] sm:columns-2">
                {siteLinks.map(({ link }, i) => {
                  return (
                    <li className="mb-2.5 break-inside-avoid" key={i}>
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

            <div className="lg:col-span-3">
              {hasContact && (
                <>
                  <p className="eyebrow mb-4 !text-white/55">Contact</p>
                  <div className="flex flex-col gap-2 text-[1rem] text-white/85">
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

          <div className="mt-12 flex flex-col gap-4 border-t border-white/15 pt-5 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-white/60 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p>
                © {new Date().getFullYear()} {details?.name || 'Mental Health Goals Programme'} ·
                mentalhealthgoals.co.uk
              </p>
              {smallPrintLinks.length > 0 && (
                <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {smallPrintLinks.map(({ link }, i) => (
                    <li key={i}>
                      <CMSLink
                        appearance="inline"
                        className="link-line hover:text-white"
                        {...link}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-6">
              <MotionToggle />
              <ThemeSelector />
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
