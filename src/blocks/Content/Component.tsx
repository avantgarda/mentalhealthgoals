import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'

import type { ContentBlock as ContentBlockProps } from '@/payload-types'

import { CMSLink } from '../../components/Link'
import { firstHeadingText } from '@/heros/splitRichText'

/**
 * Long-form content on the editorial grid.
 *
 *  - A single `full` column becomes the reading column (offset right, 66ch)
 *    with its first heading repeated as a gutter label on the left.
 *  - Three `oneThird` columns that each carry a link become the "doors":
 *    wide ruled rows with an arrow — the three audience pathways.
 *  - Any other mix renders as ruled columns on the same grid.
 */
export const ContentBlock: React.FC<ContentBlockProps> = (props) => {
  const { columns } = props
  if (!columns || columns.length === 0) return null

  const isDoors =
    columns.length === 3 &&
    columns.every((col) => col.size === 'oneThird' && col.enableLink && col.link)

  if (isDoors) {
    return (
      <div className="container">
        <ol className="border-t border-border">
          {columns.map((col, index) => (
            <li
              className="door group relative grid grid-cols-1 gap-4 border-b border-border py-7 transition-colors duration-[var(--dur-ui)] hover:bg-foreground/[0.03] lg:grid-cols-12 lg:gap-x-10 lg:py-8"
              data-reveal
              key={index}
              style={{ transitionDelay: `${index * 60}ms` }}
            >
              <div className="lg:col-span-9">
                {col.richText && (
                  <RichText
                    className="flex flex-col gap-2"
                    data={col.richText}
                    enableGutter={false}
                    enableProse={false}
                  />
                )}
              </div>
              <div className="flex lg:col-span-3 lg:items-end lg:justify-end">
                {col.link && (
                  <CMSLink
                    {...col.link}
                    appearance="link"
                    className="text-[0.95rem] font-medium after:absolute after:inset-0 after:content-['']"
                  >
                    <span aria-hidden="true" className="arrow ml-2">
                      →
                    </span>
                  </CMSLink>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  const single = columns.length === 1 && columns[0].size === 'full'

  if (single) {
    const col = columns[0]
    const label = firstHeadingText(col.richText)
    return (
      <div className="container">
        <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-3">
            {label && (
              <p className="eyebrow border-t border-border pt-3 lg:sticky lg:top-8" data-reveal>
                {label}
              </p>
            )}
          </div>
          <div className="lg:col-span-8 lg:col-start-5" data-reveal>
            {col.richText && (
              <RichText className="mx-0 max-w-[66ch]" data={col.richText} enableGutter={false} />
            )}
            {col.enableLink && <CMSLink className="mt-6" {...col.link} />}
          </div>
        </div>
      </div>
    )
  }

  const colsSpanClasses = {
    full: '12',
    half: '6',
    oneThird: '4',
    twoThirds: '8',
  }

  return (
    <div className="container">
      <div className="grid grid-cols-4 gap-x-10 gap-y-10 lg:grid-cols-12">
        {columns.map((col, index) => {
          const { enableLink, link, richText, size } = col
          const narrow = size === 'oneThird'

          return (
            <div
              className={cn(
                `col-span-4 border-t border-border pt-6 lg:col-span-${colsSpanClasses[size!]}`,
                {
                  'md:col-span-2': size !== 'full',
                  'aside-note': narrow,
                },
              )}
              data-reveal
              key={index}
              style={{ transitionDelay: `${index * 60}ms` }}
            >
              {richText && (
                <RichText
                  className={cn({ 'mx-0 max-w-[66ch]': size === 'full' })}
                  data={richText}
                  enableGutter={false}
                  enableProse={!narrow}
                />
              )}

              {enableLink && <CMSLink className="mt-5" {...link} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
