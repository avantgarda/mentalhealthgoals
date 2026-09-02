import type { Partner } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

async function findPartners(): Promise<Partner[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'partners',
    depth: 1,
    limit: 100,
    pagination: false,
    sort: 'order',
  })
  return docs
}

/**
 * Every partner, ordered, with logos resolved.
 *
 * Invalidated by the collection's hooks on any admin edit, and by the seed
 * route's cache purge. The hourly window is the backstop: a write that reaches
 * the database without a Next request behind it — the CLI seed, a migration, a
 * direct query — leaves this entry stale, and without an expiry it would stay
 * stale until the next deploy.
 */
export const getCachedPartners = unstable_cache(findPartners, ['partners'], {
  revalidate: 3600,
  tags: ['partners'],
})
