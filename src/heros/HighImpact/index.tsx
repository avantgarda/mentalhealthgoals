'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { CohortField } from '@/components/CohortField/CohortField'
import RichText from '@/components/RichText'
import { splitRichText } from '../splitRichText'

/**
 * The Observatory hero (Direction B spike): ink ground with a faint blueprint
 * dot-grid, title and lede on the left, and the cohort field on the right —
 * 20,000 canvas points, one per participant, settling into the Summit M
 * skyline. Layout is identical to the Atlas hero so the two motifs can be
 * compared like-for-like.
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
      {/* blueprint dot-grid, barely there */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgb(244_246_246/0.06)_1px,transparent_1px)] bg-[size:24px_24px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-40 lg:w-[54%] lg:opacity-100"
      >
        <CohortField className="h-full w-full" />
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

      <p
        aria-hidden="true"
        className="pointer-events-none absolute bottom-5 right-5 z-10 hidden font-mono text-[0.64rem] uppercase tracking-[0.14em] text-white/45 lg:block"
      >
        Fig. 01 — the national cohort · 20,000 points, one per participant
      </p>
    </div>
  )
}
