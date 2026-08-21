import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { splitRichText } from '../splitRichText'

/**
 * The page frame with an editorial image beneath it (full container width,
 * captioned). Used for the Forum page.
 */
export const MediumImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  const { heading, headingText, rest } = splitRichText(richText)

  return (
    <div className="container pt-10 lg:pt-16">
      <div className="grid grid-cols-1 gap-6 pb-10 lg:grid-cols-12 lg:gap-x-10 lg:pb-12">
        <div className="lg:col-span-7">
          {headingText ? (
            <h1 className="display-1">{headingText}</h1>
          ) : (
            heading && (
              <div className="hero-title">
                <RichText data={heading} enableGutter={false} enableProse={false} />
              </div>
            )
          )}
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5 lg:self-end">
          {rest && (
            <div className="hero-lede lede">
              <RichText data={rest} enableGutter={false} enableProse={false} />
            </div>
          )}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink {...link} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {media && typeof media === 'object' && (
        <figure className="m-0 border-t border-border pt-6">
          <Media imgClassName="w-full" priority resource={media} />
          {media?.caption && (
            <figcaption className="mt-3 text-sm text-muted-foreground">
              <RichText data={media.caption} enableGutter={false} enableProse={false} />
            </figcaption>
          )}
        </figure>
      )}
    </div>
  )
}
