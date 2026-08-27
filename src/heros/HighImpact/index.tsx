'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Ridge } from '@/components/Ridge/Ridge'
import RichText from '@/components/RichText'
import { splitRichText } from '../splitRichText'

/**
 * The Atlas hero: petrol ground, title and lede on the left, the ridge motif
 * rising on the right. The heading words rise in one by one and the ridge
 * draws itself when motion is on; both render complete otherwise.
 */
export const HighImpactHero: React.FC<Page['hero']> = ({ links, richText }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  })

  const { heading, headingText, rest } = splitRichText(richText)
  const words = headingText ? headingText.split(/\s+/) : []

  return (
    <div
      className="relative -mt-[4.25rem] overflow-hidden bg-brand-deep text-white lg:-mt-[4.75rem]"
      data-hero-theme="dark"
      data-theme="dark"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[-12%] w-[88%] text-white/85 opacity-[0.28] sm:right-[-6%] sm:w-[70%] lg:right-[-2%] lg:w-[52%] lg:opacity-100"
      >
        <Ridge className="h-full w-full" lines={24} />
      </div>

      <div className="container relative z-10 grid min-h-[76vh] grid-cols-1 items-end gap-10 pb-14 pt-[7.5rem] lg:grid-cols-12 lg:pb-20 lg:pt-[9.5rem]">
        <div className="flex flex-col gap-8 lg:col-span-7">
          {words.length > 0 ? (
            <h1 className="display-1 max-w-[14ch]">
              {words.map((word, i) => (
                <React.Fragment key={i}>
                  <span
                    className="rise inline-block"
                    style={{ ['--i' as string]: i } as React.CSSProperties}
                  >
                    {word}
                  </span>{' '}
                </React.Fragment>
              ))}
            </h1>
          ) : (
            heading && (
              <div className="hero-title">
                <RichText data={heading} enableGutter={false} enableProse={false} />
              </div>
            )
          )}

          {rest && (
            <div
              className="hero-lede rise max-w-[34rem] text-white/80"
              style={{ ['--i' as string]: Math.min(words.length, 8) } as React.CSSProperties}
            >
              <RichText data={rest} enableGutter={false} enableProse={false} />
            </div>
          )}

          {Array.isArray(links) && links.length > 0 && (
            <ul
              className="rise flex flex-wrap gap-3"
              style={{ ['--i' as string]: Math.min(words.length, 8) + 1 } as React.CSSProperties}
            >
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink {...link} size="lg" />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
