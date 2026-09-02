import type { Partner, PartnerLogosBlock as PartnerLogosBlockProps } from '@/payload-types'

import React from 'react'

import { PartnerGroup } from '@/components/PartnerLogo'
import { cn } from '@/utilities/ui'

const resolved = (partners: PartnerLogosBlockProps['partners']): Partner[] =>
  partners.filter((p): p is Partner => typeof p === 'object' && p !== null)

/**
 * In a page layout the row sits on the editorial grid with a chapter rule.
 * Inside rich text (`inline`) it is a quieter, compact row that reads as part
 * of the article rather than a section of its own.
 */
export const PartnerLogosBlockComponent: React.FC<
  PartnerLogosBlockProps & { className?: string; inline?: boolean }
> = ({ className, heading, inline, partners }) => {
  const list = resolved(partners)
  if (list.length === 0) return null

  if (inline) {
    return (
      // `not-prose`: inside an article this sits within Tailwind Typography's
      // prose scope, which would give the logo list bullets and paragraph
      // margins. The row is a figure, not body copy.
      <div
        className={cn('partner-plate not-prose my-8 border-y border-border px-5 py-6', className)}
      >
        <PartnerGroup label={heading} partners={list} size="compact" />
      </div>
    )
  }

  return (
    <section className={cn('container', className)}>
      <div
        className="partner-plate chapter-rule border-t-2 border-foreground px-5 py-5"
        data-reveal
      >
        <PartnerGroup label={heading} partners={list} />
      </div>
    </section>
  )
}
