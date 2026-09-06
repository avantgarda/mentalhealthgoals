import type { Payload } from 'payload'

import type { Post } from '@/payload-types'

/** What a listing needs to render an event row. */
export type UpcomingEvent = Pick<
  Post,
  'slug' | 'categories' | 'meta' | 'publishedAt' | 'title' | 'eventDate' | 'eventLocation'
> & { id: number }

/**
 * Midnight this morning, so an event happening today still reads as coming up
 * rather than dropping into the archive part-way through its own day.
 */
export const startOfToday = (): string => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

/**
 * Events still to happen, soonest first.
 *
 * These are lifted out of the chronological listing and pinned above it, so
 * the same query has to drive both halves — hence the shared helper. When
 * nothing is coming up it returns an empty list and the listing looks exactly
 * as it did before.
 */
export const findUpcomingEvents = async (payload: Payload, limit = 4) => {
  const result = await payload.find({
    collection: 'posts',
    depth: 1,
    limit,
    overrideAccess: false,
    sort: 'eventDate',
    where: { eventDate: { greater_than_equal: startOfToday() } },
    select: {
      title: true,
      slug: true,
      categories: true,
      meta: true,
      publishedAt: true,
      eventDate: true,
      eventLocation: true,
    },
  })

  return result.docs as UpcomingEvent[]
}

/** Keeps the pinned events out of the chronological list below them. */
export const excludingIds = (ids: number[]) =>
  ids.length > 0 ? { id: { not_in: ids } } : undefined
