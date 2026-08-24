import React from 'react'

import type { CallToActionBlock as CTABlockProps } from '@/payload-types'

import RichText from '@/components/RichText'
import { CMSLink } from '@/components/Link'

/** A full-bleed deep-petrol band — the page's chapter break: one statement, one (or two) actions. */
export const CallToActionBlock: React.FC<CTABlockProps> = ({ links, richText }) => {
  return (
    <div className="bg-brand-deep text-white" data-theme="dark">
      <div className="container">
        <div
          className="band grid grid-cols-1 gap-6 py-12 lg:grid-cols-12 lg:items-end lg:gap-x-10 lg:py-16"
          data-reveal
        >
          <div className="lg:col-span-8 [&_p]:text-white/75">
            {richText && <RichText data={richText} enableGutter={false} enableProse={false} />}
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
            {(links || []).map(({ link }, i) => {
              return <CMSLink key={i} size="lg" {...link} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
