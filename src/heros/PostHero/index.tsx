import { formatDisplayDate } from 'src/utilities/formatDateTime'
import React from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'
import { SIZE_FULL_BLEED } from '@/components/Media/sizes'
import { formatAuthors } from '@/utilities/formatAuthors'

export const PostHero: React.FC<{
  post: Post
}> = ({ post }) => {
  const { categories, heroImage, populatedAuthors, publishedAt, title } = post

  const hasAuthors =
    populatedAuthors && populatedAuthors.length > 0 && formatAuthors(populatedAuthors) !== ''

  return (
    <div className="relative -mt-[4.25rem] lg:-mt-[4.75rem] flex items-end">
      <div className="container z-10 relative lg:grid lg:grid-cols-[1fr_48rem_1fr] text-white pb-8">
        {/* The middle track, and only the middle track. This used to span two
            of the three, so the title kept the article's left edge but ran
            296px past its right — the same measure the body sets at
            `max-w-[48rem] mx-auto`, and the title did not share it. The `md:`
            prefixes were dead too: the parent is not a grid until `lg`. */}
        <div className="lg:col-start-2 lg:col-span-1">
          <div className="uppercase text-sm mb-6">
            {categories?.map((category, index) => {
              if (typeof category === 'object' && category !== null) {
                const { title: categoryTitle } = category

                const titleToUse = categoryTitle || 'Untitled category'

                const isLast = index === categories.length - 1

                return (
                  <React.Fragment key={index}>
                    {titleToUse}
                    {!isLast && <React.Fragment>, &nbsp;</React.Fragment>}
                  </React.Fragment>
                )
              }
              return null
            })}
          </div>

          <div className="">
            <h1 className="mb-6 text-3xl md:text-5xl lg:text-6xl">{title}</h1>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:gap-16">
            <div className="flex flex-col gap-1">
              <p className="eyebrow !text-white/60">By</p>
              {/* Articles are published collectively unless a named author is set */}
              <p>{hasAuthors ? formatAuthors(populatedAuthors) : 'MHG Team'}</p>
            </div>
            {publishedAt && (
              <div className="flex flex-col gap-1">
                <p className="eyebrow !text-white/60">Published</p>

                <time dateTime={publishedAt}>{formatDisplayDate(publishedAt)}</time>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="min-h-[80vh] select-none">
        {heroImage && typeof heroImage !== 'string' && (
          <Media
            fill
            priority
            imgClassName="-z-10 object-cover"
            resource={heroImage}
            size={SIZE_FULL_BLEED}
          />
        )}
        <div className="absolute pointer-events-none left-0 bottom-0 w-full h-1/2 bg-linear-to-t from-black to-transparent" />
      </div>
    </div>
  )
}
