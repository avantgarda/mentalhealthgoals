'use client'
import { cn } from '@/utilities/ui'
import useClickableCard from '@/utilities/useClickableCard'
import Link from 'next/link'
import React, { Fragment } from 'react'

import type { Post } from '@/payload-types'

import { formatDisplayDate } from '@/utilities/formatDateTime'

export type CardPostData = Pick<Post, 'slug' | 'categories' | 'meta' | 'publishedAt' | 'title'>

/**
 * A news entry as a ruled row: category · title · standfirst · arrow. The
 * whole row is clickable; the title carries the real link.
 */
export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  doc?: CardPostData
  relationTo?: 'posts'
  showCategories?: boolean
  title?: string
}> = (props) => {
  const { card, link } = useClickableCard({})
  const { className, doc, relationTo, showCategories, title: titleFromProps } = props

  const { slug, categories, meta, publishedAt, title } = doc || {}
  const { description } = meta || {}

  const hasCategories = categories && Array.isArray(categories) && categories.length > 0
  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, ' ') // replace non-breaking space with white space
  const href = `/${relationTo}/${slug}`

  return (
    <article
      className={cn(
        'group grid grid-cols-1 gap-y-2 border-b border-border py-6 transition-colors duration-[var(--dur-ui)] hover:cursor-pointer hover:bg-foreground/[0.03] lg:grid-cols-12 lg:gap-x-8 lg:py-7',
        className,
      )}
      ref={card.ref}
    >
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        {publishedAt && (
          <time
            className="font-mono text-xs tabular-nums text-muted-foreground"
            dateTime={publishedAt}
          >
            {formatDisplayDate(publishedAt)}
          </time>
        )}
        {showCategories && hasCategories && (
          <p className="eyebrow">
            {categories?.map((category, index) => {
              if (typeof category === 'object') {
                const { title: titleFromCategory } = category

                const categoryTitle = titleFromCategory || 'Untitled category'

                const isLast = index === categories.length - 1

                return (
                  <Fragment key={index}>
                    {categoryTitle}
                    {!isLast && <Fragment>, &nbsp;</Fragment>}
                  </Fragment>
                )
              }

              return null
            })}
          </p>
        )}
      </div>
      <div className="lg:col-span-5">
        {titleToUse && (
          <h2 className="display-3">
            <Link
              className="group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4"
              href={href}
              ref={link.ref}
            >
              {titleToUse}
            </Link>
          </h2>
        )}
      </div>
      <div className="flex items-start justify-between gap-6 lg:col-span-5 lg:pr-4">
        {description && (
          <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
            {sanitizedDescription}
          </p>
        )}
        <span
          aria-hidden="true"
          className="arrow hidden pt-1 text-muted-foreground lg:inline-block"
        >
          →
        </span>
      </div>
    </article>
  )
}
