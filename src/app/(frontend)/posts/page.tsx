import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { POSTS_PER_PAGE } from '@/utilities/constants'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function Page() {
  const payload = await getPayload({ config: configPromise })

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: POSTS_PER_PAGE,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      categories: true,
      meta: true,
      publishedAt: true,
    },
  })

  return (
    <div className="pb-24 pt-10 lg:pt-16">
      <PageClient />
      <div className="container">
        <div className="grid grid-cols-1 gap-6 border-b-2 border-foreground pb-10 lg:grid-cols-12 lg:gap-x-10 lg:pb-14">
          <h1 className="display-1 lg:col-span-7">News &amp; events</h1>
          <p className="lede lg:col-span-5 lg:self-end">
            Announcements, milestones and events from across the programme and its partners.
          </p>
        </div>
      </div>

      <div className="container mb-6 mt-8">
        <PageRange
          collection="posts"
          currentPage={posts.page}
          limit={POSTS_PER_PAGE}
          totalDocs={posts.totalDocs}
        />
      </div>

      <CollectionArchive posts={posts.docs} />

      <div className="container">
        {posts.totalPages > 1 && posts.page && (
          <Pagination page={posts.page} totalPages={posts.totalPages} />
        )}
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `News & Events | Mental Health Goals Programme`,
  }
}
