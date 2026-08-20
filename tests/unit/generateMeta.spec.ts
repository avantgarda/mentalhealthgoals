/**
 * generateMeta builds the <title> and OpenGraph tags for pages and posts.
 * The single-suffix rule was audit finding F06 (titles once doubled the
 * "| Mental Health Goals Programme" suffix); the brand-card fallback was F07.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/brand/getBrand', () => ({
  getBrandSettings: async () => ({ variant: 'summit', showTagline: true }),
  brandAssetPath: (variant: string, file: string) => `/brand/${variant}/${file}`,
}))

import { generateMeta } from '@/utilities/generateMeta'

const SITE = 'Mental Health Goals Programme'

/* eslint-disable @typescript-eslint/no-explicit-any */
const ogImages = (meta: any): any[] => meta.openGraph?.images ?? []

describe('generateMeta', () => {
  it('appends the site name to a page meta title exactly once (F06)', async () => {
    const meta = await generateMeta({ doc: { meta: { title: 'About' } } as any })
    expect(meta.title).toBe(`About | ${SITE}`)
  })

  it('uses the bare site name when there is no meta title', async () => {
    const meta = await generateMeta({ doc: { meta: {} } as any })
    expect(meta.title).toBe(SITE)
  })

  it('never doubles the suffix when the meta title equals the site name', async () => {
    const meta = await generateMeta({ doc: { meta: { title: SITE } } as any })
    expect(meta.title).toBe(SITE)
  })

  it('prefers the og-sized rendition of the meta image', async () => {
    const meta = await generateMeta({
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
    const meta = await generateMeta({ doc: { meta: { title: 'About' } } as any })
    expect(ogImages(meta)[0].url).toContain('/brand/summit/og.png')
  })
})
