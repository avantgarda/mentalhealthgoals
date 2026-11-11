// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { uploadCaption } from '../../scripts/lib/content-patch-core'

let payload: Payload
const ids: number[] = []
const context = { disableRevalidate: true }
const run = Date.now()

const svgFile = (markup: string) => {
  const data = Buffer.from(markup)
  return { data, mimetype: 'image/svg+xml', name: `upload-test-${run}.svg`, size: data.length }
}

describe('reviewed media uploads', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    for (const id of ids) await payload.delete({ collection: 'media', id, context })
  })

  it('accepts safe vector artwork and preserves the supplied file', async () => {
    const file = svgFile(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#2457ad"/></svg>',
    )
    const doc = await payload.create({
      collection: 'media',
      context,
      data: { alt: 'A test vector logo' },
      file,
    })
    ids.push(doc.id)
    expect(doc.mimeType).toBe('image/svg+xml')
    expect([doc.width, doc.height]).toEqual([100, 40])
    const { readFile } = await import('node:fs/promises')
    expect(await readFile(`public/media/${doc.filename}`)).toEqual(file.data)
  })

  it('rejects SVG artwork containing executable script', async () => {
    await expect(
      payload.create({
        collection: 'media',
        context,
        data: { alt: 'A rejected test upload' },
        file: svgFile('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      }),
    ).rejects.toMatchObject({
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: 'file',
            message: expect.stringContaining('potentially harmful content'),
          }),
        ]),
      },
    })
  })

  it.each(['jpeg', 'png'] as const)(
    'preserves reviewed %s bytes and caption on readback',
    async (format) => {
      const data = await sharp({
        create: { width: 1600, height: 1000, channels: 3, background: '#2457ad' },
      })
        [format]()
        .toBuffer()
      const caption = uploadCaption('Forum launch — discussion & collaboration.')
      const doc = await payload.create({
        collection: 'media',
        context,
        data: { alt: 'Reviewed forum image', caption },
        file: {
          data,
          mimetype: `image/${format}`,
          name: `reviewed-${run}.${format}`,
          size: data.length,
        },
      })
      ids.push(doc.id)
      const saved = await payload.findByID({ collection: 'media', id: doc.id, depth: 0 })
      expect(saved.caption).toEqual(caption)
      expect(saved.alt).toBe('Reviewed forum image')
      expect(saved.mimeType).toBe(`image/${format}`)
      expect([saved.width, saved.height]).toEqual([1600, 1000])
      expect(await readFile(`public/media/${saved.filename}`)).toEqual(data)
      expect(saved.sizes?.thumbnail?.filename).toBeTruthy()
      expect(saved.sizes?.og?.filename).toBeTruthy()
    },
  )
})
