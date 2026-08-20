/**
 * The revalidation hooks decide which cached paths get rebuilt when content
 * changes. The slug-change cases were audit finding F09 (renaming a published
 * page left the old URL serving stale content) — these tests pin the fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { revalidatePath } from 'next/cache'
import { revalidatePage } from '@/collections/Pages/hooks/revalidatePage'
import { revalidatePost } from '@/collections/Posts/hooks/revalidatePost'

/* eslint-disable @typescript-eslint/no-explicit-any */
const makeArgs = (doc: any, previousDoc: any, context: any = {}): any => ({
  doc,
  previousDoc,
  req: { payload: { logger: { info: vi.fn() } }, context },
})

const calledPaths = () => (revalidatePath as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])

beforeEach(() => {
  vi.clearAllMocks()
})

describe('revalidatePage', () => {
  it('revalidates the page path on publish (home maps to /)', () => {
    revalidatePage(makeArgs({ _status: 'published', slug: 'home' }, undefined))
    expect(calledPaths()).toContain('/')

    vi.clearAllMocks()
    revalidatePage(makeArgs({ _status: 'published', slug: 'about' }, undefined))
    expect(calledPaths()).toContain('/about')
  })

  it('also clears the old path when a published page is renamed (F09)', () => {
    revalidatePage(
      makeArgs({ _status: 'published', slug: 'about-us' }, { _status: 'published', slug: 'about' }),
    )
    expect(calledPaths()).toEqual(expect.arrayContaining(['/about-us', '/about']))
  })

  it('clears the old path on unpublish', () => {
    revalidatePage(
      makeArgs({ _status: 'draft', slug: 'about' }, { _status: 'published', slug: 'about' }),
    )
    expect(calledPaths()).toContain('/about')
  })

  it('does nothing when revalidation is disabled (seeding)', () => {
    revalidatePage(
      makeArgs({ _status: 'published', slug: 'about' }, undefined, { disableRevalidate: true }),
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('revalidatePost', () => {
  it('revalidates the post path and the whole frontend on publish (F08)', () => {
    revalidatePost(makeArgs({ _status: 'published', slug: 'news-one' }, undefined))
    expect(calledPaths()).toContain('/posts/news-one')
    // Listings, archive blocks and related posts live on other routes
    expect((revalidatePath as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['/', 'layout'])
  })

  it('also clears the old path when a published post is renamed (F09)', () => {
    revalidatePost(
      makeArgs(
        { _status: 'published', slug: 'news-two' },
        { _status: 'published', slug: 'news-one' },
      ),
    )
    expect(calledPaths()).toEqual(expect.arrayContaining(['/posts/news-two', '/posts/news-one']))
  })

  it('does nothing when revalidation is disabled (seeding)', () => {
    revalidatePost(
      makeArgs({ _status: 'published', slug: 'news-one' }, undefined, { disableRevalidate: true }),
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
