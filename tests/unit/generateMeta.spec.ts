/**
 * generateMeta builds the <title>, canonical and OpenGraph tags for pages and
 * posts. The single-suffix rule was audit finding F06 (titles once doubled the
 * "| Mental Health Goals Programme" suffix); the brand-card fallback was F07.
 * og:url once named the home page on every page and post, so a shared link
 * could show the home page's card.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('@/brand/getBrand', () => ({
  getBrandSettings: async () => ({ variant: 'summit', showTagline: true }),
  brandAssetPath: (variant: string, file: string) => `/brand/${variant}/${file}`,
}))

import { generateMeta } from '@/utilities/generateMeta'

const SITE = 'Mental Health Goals Programme'
const HOST = 'https://www.mentalhealthgoals.co.uk'

/* eslint-disable @typescript-eslint/no-explicit-any */
const ogImages = (meta: any): any[] => meta.openGraph?.images ?? []
const ogUrl = (meta: any): string | undefined => meta.openGraph?.url
const canonical = (meta: any): string | undefined => meta.alternates?.canonical

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', HOST)
})

describe('generateMeta', () => {
  it('appends the site name to a page meta title exactly once (F06)', async () => {
    const meta = await generateMeta({
      collection: 'pages',
      doc: { meta: { title: 'About' } } as any,
    })
    expect(meta.title).toBe(`About | ${SITE}`)
  })

  it('uses the bare site name when there is no meta title', async () => {
    const meta = await generateMeta({ collection: 'pages', doc: { meta: {} } as any })
    expect(meta.title).toBe(SITE)
  })

  it('never doubles the suffix when the meta title equals the site name', async () => {
    const meta = await generateMeta({ collection: 'pages', doc: { meta: { title: SITE } } as any })
    expect(meta.title).toBe(SITE)
  })

  it('prefers the og-sized rendition of the meta image', async () => {
    const meta = await generateMeta({
      collection: 'pages',
      doc: {
        meta: {
          title: 'About',
          image: {
            url: '/api/media/file/pic.webp',
            sizes: { og: { url: '/api/media/file/pic-1200x630.webp' } },
          },
        },
      } as any,
    })
    expect(ogImages(meta)[0].url).toContain('/api/media/file/pic-1200x630.webp')
  })

  it('falls back to the brand OG card when no meta image is set (F07)', async () => {
    const meta = await generateMeta({
      collection: 'pages',
      doc: { meta: { title: 'About' } } as any,
    })
    expect(ogImages(meta)[0].url).toContain('/brand/summit/og.png')
  })

  it('points og:url and the canonical at the site root for the home page', async () => {
    const meta = await generateMeta({ collection: 'pages', doc: { slug: 'home', meta: {} } as any })
    expect(ogUrl(meta)).toBe(`${HOST}/`)
    expect(canonical(meta)).toBe(`${HOST}/`)
  })

  it("points og:url and the canonical at a page's own address", async () => {
    const meta = await generateMeta({
      collection: 'pages',
      doc: {
        slug: 'industry-engagement-forum',
        meta: { title: 'Industry Engagement Forum' },
      } as any,
    })
    expect(ogUrl(meta)).toBe(`${HOST}/industry-engagement-forum`)
    expect(canonical(meta)).toBe(`${HOST}/industry-engagement-forum`)
  })

  it('points og:url and the canonical at /posts/<slug> for a post', async () => {
    const meta = await generateMeta({
      collection: 'posts',
      doc: { slug: 'forum-launch', meta: { title: 'Forum launch' } } as any,
    })
    expect(ogUrl(meta)).toBe(`${HOST}/posts/forum-launch`)
    expect(canonical(meta)).toBe(`${HOST}/posts/forum-launch`)
  })

  it('names no address when there is no document', async () => {
    const meta = await generateMeta({ collection: 'pages', doc: null })
    expect(ogUrl(meta)).toBeUndefined()
    expect(meta.alternates).toBeUndefined()
  })
})
