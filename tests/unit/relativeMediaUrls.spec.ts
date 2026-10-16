import { describe, expect, it } from 'vitest'
import { relativeMediaUrls } from '@/hooks/relativeMediaUrls'

const normalize = (doc: Record<string, unknown>, origin = 'http://localhost:3217') =>
  relativeMediaUrls({
    doc,
    req: { payload: { config: { serverURL: origin, routes: { api: '/api' } } } },
  } as never)

describe('Media URLs with an explicit auth server origin', () => {
  it('keeps own files and image derivatives relative without changing the input', async () => {
    const doc = {
      url: 'http://localhost:3217/api/media/file/slides.pdf',
      thumbnailURL: 'http://localhost:3217/api/media/file/photo-small.webp',
      sizes: {
        thumbnail: { url: 'http://localhost:3217/api/media/file/photo-small.webp?v=2', width: 300 },
        og: null,
      },
    }
    const result = await normalize(doc)
    expect(result.url).toBe('/api/media/file/slides.pdf')
    expect(result.thumbnailURL).toBe('/api/media/file/photo-small.webp')
    expect(result.sizes?.thumbnail?.url).toBe('/api/media/file/photo-small.webp?v=2')
    expect(result.sizes?.thumbnail?.width).toBe(300)
    expect(doc.url).toMatch(/^http:/)
  })
  it('preserves CDN URLs, other origins and already-relative paths', async () => {
    for (const url of [
      'https://files.blob.vercel-storage.com/slides.pdf',
      'https://other.example/api/media/file/slides.pdf',
      '/api/media/file/slides.pdf',
      'http://localhost:3217/other/file.pdf',
    ]) {
      expect((await normalize({ url })).url).toBe(url)
    }
  })
  it('uses the configured preview origin and tolerates absent URLs and sizes', async () => {
    expect(
      (
        await normalize(
          { url: 'https://preview.vercel.app/api/media/file/slides.pdf' },
          'https://preview.vercel.app',
        )
      ).url,
    ).toBe('/api/media/file/slides.pdf')
    expect((await normalize({})).url).toBeUndefined()
  })
})
