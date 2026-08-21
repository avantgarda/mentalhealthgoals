import React from 'react'

import type { CallToActionBlock as CTABlockProps } from '@/payload-types'

import RichText from '@/components/RichText'
import { CMSLink } from '@/components/Link'

/** A full-width ruled band: one statement, one (or two) actions. */
export const CallToActionBlock: React.FC<CTABlockProps> = ({ links, richText }) => {
  return (
    <div className="container">
      <div
        className="band grid grid-cols-1 gap-6 border-y border-border py-10 lg:grid-cols-12 lg:items-end lg:gap-x-10 lg:py-12"
        data-reveal
      >
        <div className="lg:col-span-8">
          {richText && <RichText data={richText} enableGutter={false} enableProse={false} />}
        </div>
        <div className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
          {(links || []).map(({ link }, i) => {
            return <CMSLink key={i} size="lg" {...link} />
          })}
        </div>
      </div>
    </div>
  )
}
