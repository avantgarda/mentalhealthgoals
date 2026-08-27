import type { Metadata } from 'next/types'
import Link from 'next/link'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import type { Search as SearchDoc } from '@/payload-types'

import { Search } from '@/search/Component'
import { SearchResults } from '@/search/SearchResults'
import PageClient from './page.client'

/**
 * Every match is returned and ranked here rather than paged. The index is a few
 * dozen documents and grows by a handful a year, and `like` carries no
 * relevance score of its own — ordering by priority alone put the page
 * literally called "Workstreams" fourth for the query "workstream". Ranking in
 * memory fixes that; paging would have scattered it across pages instead.
 */
const MAX_RESULTS = 100

/** Title match first, then description, then anything matched in the body. */
const relevance = (doc: SearchDoc, words: string[]): number => {
  const has = (value?: string | null) =>
    Boolean(value) && words.every((word) => value!.toLowerCase().includes(word))
  if (has(doc.title) || has(doc.meta?.title)) return 0
  if (has(doc.meta?.description)) return 1
  return 2
}

type Args = {
  searchParams: Promise<{
    q?: string
  }>
}

export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q } = await searchParamsPromise
  const query = (q ?? '').trim()
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)

  const payload = await getPayload({ config: configPromise })

  // Nothing typed yet: prompt rather than list the whole index. "Everything,
  // in priority order" is not a search result, and it buries the box itself.
  const results = query
    ? await payload.find({
        collection: 'search',
        depth: 1,
        limit: MAX_RESULTS,
        // Highest-value kind first where a query matches several — see
        // SEARCH_PRIORITIES in src/search/resultTypes.ts. `relevance` then
        // re-orders across that.
        sort: ['-priority', 'title'],
        select: {
          title: true,
          type: true,
          path: true,
          priority: true,
          meta: true,
        },
        where: {
          or: [
            { title: { like: query } },
            { body: { like: query } },
            { 'meta.title': { like: query } },
            { 'meta.description': { like: query } },
            { slug: { like: query } },
          ],
        },
      })
    : null

  const total = results?.totalDocs ?? 0
  // `sort` has already broken ties by priority, so a stable sort on relevance
  // alone preserves that ordering within each band.
  const docs = ((results?.docs ?? []) as SearchDoc[])
    .map((doc, index) => ({ doc, index, rank: relevance(doc, words) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.doc)

  return (
    <div className="pb-24 pt-10 lg:pt-16">
      <PageClient />

      <div className="container">
        <div className="grid grid-cols-1 gap-6 border-b-2 border-foreground pb-10 lg:grid-cols-12 lg:gap-x-10 lg:pb-14">
          <h1 className="display-1 lg:col-span-7">Search</h1>
          <p className="lede lg:col-span-5 lg:self-end">
            Pages, workstreams, news and the people behind the programme.
          </p>
        </div>
      </div>

      <div className="container mt-8 max-w-[38rem] lg:mt-10">
        <Search />
      </div>

      {query ? (
        <>
          <div className="container mt-10 lg:mt-12">
            <p className="eyebrow" role="status">
              {total === 0
                ? `No results for “${query}”`
                : `${total} result${total === 1 ? '' : 's'} for “${query}”`}
            </p>
          </div>

          {total > 0 ? (
            <div className="mt-4">
              <SearchResults docs={docs} />
            </div>
          ) : (
            <div className="container mt-4 max-w-[44rem]">
              <p className="text-[0.98rem] leading-relaxed text-muted-foreground">
                Try a shorter phrase, or a single word — the programme’s six{' '}
                <Link className="link-line" href="/workstreams">
                  workstreams
                </Link>
                , the{' '}
                <Link className="link-line" href="/people">
                  team
                </Link>{' '}
                and every{' '}
                <Link className="link-line" href="/posts">
                  news item
                </Link>{' '}
                are all searchable.
              </p>
            </div>
          )}

          {total > docs.length && (
            <p className="container mt-8 text-[0.9rem] text-muted-foreground">
              Showing the first {docs.length}. Narrow the search to see the rest.
            </p>
          )}
        </>
      ) : (
        <div className="container mt-10 max-w-[44rem]">
          <p className="text-[0.98rem] leading-relaxed text-muted-foreground">
            Start typing to search across the whole site.
          </p>
        </div>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Search | Mental Health Goals Programme`,
  }
}
