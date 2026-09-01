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
 *
 * The ridge is placed twice, because the two layouts want opposite things of
 * it. Wide, there is a column of empty ground beside the copy and the motif
 * fills it. Narrow, there is no such column — a single column of type runs the
 * width of the screen — so the motif goes *under* the copy as a horizon rather
 * than behind it as a texture. Only one is ever rendered.
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
      {/* Wide screens. Two anchors, one per edge, because the two edges answer
          to different things. The LEFT sits at 58.33% of the container — where
          the copy's seven of twelve columns end — so the motif can never reach
          the text at any width (anchored to the viewport it sat at 50vw and
          ran through the lede between `lg` and ~1200px). The RIGHT sits just
          past the viewport edge — `(100% - 100vw)/2` walks out through the
          container's margin — and the drawing presses against it, so the floor
          lines always run off screen while the summit and its right shoulder
          stay fully in view. Width-anchored boxes did neither: a box wide
          enough to bleed at 1280 chopped the right shoulder off, and one sized
          for 1440 detached from the edge entirely past 2200. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="container relative h-full">
          <div className="absolute inset-y-0 left-[58.333%] right-[calc((100%-100vw)/2-2vw)] text-white/85">
            <Ridge align="right" className="h-full w-full" lines={22} />
          </div>
        </div>
      </div>

      <div className="container relative z-10 grid grid-cols-1 items-end gap-8 pb-0 pt-24 lg:min-h-[76vh] lg:gap-10 lg:grid-cols-12 lg:pb-20 lg:pt-[9.5rem]">
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

        {/* Small screens: full-bleed, sitting on the boundary with the section
            below. `data-reveal` holds the draw-in until it is scrolled to —
            on a phone this sits below the fold, and an animation that has
            already finished by the time it is seen is no animation at all. */}
        <div
          aria-hidden="true"
          className="pointer-events-none -mx-5 text-white/85 md:-mx-8 lg:hidden"
          data-reveal
        >
          <Ridge className="h-auto w-full" fit="content" lines={14} />
        </div>
      </div>
    </div>
  )
}
