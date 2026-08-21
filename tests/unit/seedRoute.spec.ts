// @vitest-environment node
/**
 * The admin Seed button must leave the site serving the NEW content: the seed
 * itself writes with revalidation disabled, so the route has to purge the
 * page cache and the seeded cache tags once it succeeds — and must not touch
 * anything when the caller is not an admin or the seed fails.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  seed: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/endpoints/seed', () => ({ seed: mocks.seed }))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ auth: mocks.auth, logger: { error: mocks.loggerError } })),
  createLocalReq: vi.fn(async () => ({})),
}))

import { revalidatePath, revalidateTag } from 'next/cache'
import { POST, SEED_CACHE_TAGS } from '@/app/(frontend)/next/seed/route'

const tagCalls = () => (revalidateTag as ReturnType<typeof vi.fn>).mock.calls
const pathCalls = () => (revalidatePath as ReturnType<typeof vi.fn>).mock.calls

describe('POST /next/seed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.seed.mockResolvedValue(undefined)
  })

  it('seeds and purges the whole site cache for an admin', async () => {
    mocks.auth.mockResolvedValue({ user: { role: 'admin' } })

    const res = await POST()

    expect(res.status).toBe(200)
    expect(mocks.seed).toHaveBeenCalledTimes(1)
    expect(pathCalls()).toContainEqual(['/', 'layout'])
    for (const tag of SEED_CACHE_TAGS) expect(tagCalls()).toContainEqual([tag, 'max'])
  })

  it('covers the nav globals and both sitemaps', () => {
    expect(SEED_CACHE_TAGS).toEqual(
      expect.arrayContaining(['global_header', 'global_footer', 'pages-sitemap', 'posts-sitemap']),
    )
  })

  it('refuses non-admins without seeding or revalidating', async () => {
    mocks.auth.mockResolvedValue({ user: { role: 'editor' } })

    const res = await POST()

    expect(res.status).toBe(403)
    expect(mocks.seed).not.toHaveBeenCalled()
    expect(pathCalls()).toHaveLength(0)
    expect(tagCalls()).toHaveLength(0)
  })

  it('does not purge the cache when the seed fails', async () => {
    mocks.auth.mockResolvedValue({ user: { role: 'admin' } })
    mocks.seed.mockRejectedValue(new Error('boom'))

    const res = await POST()

    expect(res.status).toBe(500)
    expect(mocks.loggerError).toHaveBeenCalled()
    expect(pathCalls()).toHaveLength(0)
    expect(tagCalls()).toHaveLength(0)
  })
})
