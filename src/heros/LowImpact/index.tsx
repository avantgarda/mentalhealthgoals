import React from 'react'

import type { Page } from '@/payload-types'

import RichText from '@/components/RichText'
import { splitRichText } from '../splitRichText'

type LowImpactHeroType =
  | {
      children?: React.ReactNode
      richText?: never
    }
  | (Omit<Page['hero'], 'richText'> & {
      children?: never
      richText?: Page['hero']['richText']
    })

/**
 * The editorial page frame: title on the left, lede on the right, closed by a
 * rule. Subsequent content blocks continue the same grid.
 */
export const LowImpactHero: React.FC<LowImpactHeroType> = ({ children, richText }) => {
  const { heading, headingText, rest } = splitRichText(richText)

  return (
    <div className="container pt-10 lg:pt-16">
      <div className="grid grid-cols-1 gap-6 border-b border-border pb-10 lg:grid-cols-12 lg:gap-x-10 lg:pb-14">
        <div className="lg:col-span-7">
          {children ? (
            <div className="hero-title">{children}</div>
          ) : headingText ? (
            <h1 className="display-1">{headingText}</h1>
          ) : (
            heading && (
              <div className="hero-title">
                <RichText data={heading} enableGutter={false} enableProse={false} />
              </div>
            )
          )}
        </div>
        {rest && (
          <div className="hero-lede lede lg:col-span-5 lg:self-end">
            <RichText data={rest} enableGutter={false} enableProse={false} />
          </div>
        )}
      </div>
    </div>
  )
}
