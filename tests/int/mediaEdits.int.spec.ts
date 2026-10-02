// @vitest-environment node
// (Payload checks an upload's type with `instanceof Uint8Array`, which a jsdom realm fails.)
/**
 * An image already in the library is cropped once per save, not twice
 * (payloadcms/payload#15267).
 *
 * The image editor sends its crop as `uploadEdits` in the request's query.
 * The cloud-storage plugin then records its upload metadata with a second
 * update on that same request, marked `context.skipCloudStorage` — and the
 * edits are still in the query. These tests drive Payload's real update
 * pipeline both ways: as the editor's save, where the crop must be made, and
 * as the plugin's metadata update, where it must not be made again.
 *
 * Runs against local storage, as CI does. Creates one image and removes it.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import sharp from 'sharp'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

let payload: Payload

const run = Date.now()
const context = { disableRevalidate: true }
let id: number

/** What the admin's image editor sends for a crop to 80% from 10% in. */
const crop = (widthInPixels: number, heightInPixels: number) => ({
  crop: { unit: '%', x: 10, y: 10, width: 80, height: 80 },
  focalPoint: { x: 50, y: 50 },
  widthInPixels,
  heightInPixels,
})

/** The stored record's own file fields, which the editor posts back with a save. */
const fileFields = async () => {
  const doc = await payload.findByID({ collection: 'media', id, depth: 0 })
  return {
    filename: doc.filename,
    url: doc.url,
    width: doc.width,
    height: doc.height,
    mimeType: doc.mimeType,
    filesize: doc.filesize,
    focalX: doc.focalX,
    focalY: doc.focalY,
  }
}

describe('editing a stored image', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const data = await sharp({
      create: { width: 400, height: 500, channels: 3, background: { r: 40, g: 90, b: 100 } },
    })
      .jpeg()
      .toBuffer()
    const doc = await payload.create({
      collection: 'media',
      context,
      data: { alt: 'Edit test' },
      file: { data, mimetype: 'image/jpeg', name: `edit-test-${run}-photo.jpg`, size: data.length },
    })
    id = doc.id
  })

  afterAll(async () => {
    if (id) await payload.delete({ collection: 'media', id, context })
  })

  it('makes the crop an editor asks for', async () => {
    const updated = await payload.update({
      collection: 'media',
      id,
      depth: 0,
      context,
      data: await fileFields(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req: { query: { uploadEdits: crop(320, 400) } } as any,
    })
    expect([updated.width, updated.height]).toEqual([320, 400])
  })

  it('does not crop again in the storage plugin’s own metadata update', async () => {
    // The same edits, arriving on the plugin's nested update: left in place
    // they would take the image from 320×400 down to 256×320.
    const query = { uploadEdits: crop(256, 320) }
    const updated = await payload.update({
      collection: 'media',
      id,
      depth: 0,
      context: { ...context, skipCloudStorage: true },
      data: await fileFields(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req: { query } as any,
    })
    expect([updated.width, updated.height]).toEqual([320, 400])
    expect(query.uploadEdits).toBeUndefined()
  })

  it('saves an edit that arrives with the stored file attached under the next name', async () => {
    // What attachStoredImageForEdits arranges where Blob is the store: the
    // current file rides along with the edit, and because its name is taken
    // Payload writes the result to the next one instead of over the old file.
    const before = await fileFields()
    const data = await readFile(path.resolve('public/media', String(before.filename)))
    const updated = await payload.update({
      collection: 'media',
      id,
      depth: 0,
      context,
      data: before,
      file: { data, mimetype: 'image/jpeg', name: String(before.filename), size: data.length },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req: { query: { uploadEdits: crop(256, 320) } } as any,
    })
    expect([updated.width, updated.height]).toEqual([256, 320])
    // Payload's own numbering: a taken name gains -1, then -2, and so on.
    expect(before.filename).toBe(`edit-test-${run}-photo.jpg`)
    expect(updated.filename).toBe(`edit-test-${run}-photo-1.jpg`)
  })
})
