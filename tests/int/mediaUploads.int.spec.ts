// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const ids: number[] = []
const context = { disableRevalidate: true }
const run = Date.now()

const svgFile = (markup: string) => {
  const data = Buffer.from(markup)
  return { data, mimetype: 'image/svg+xml', name: `upload-test-${run}.svg`, size: data.length }
}

describe('SVG logo uploads', () => {
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
})
