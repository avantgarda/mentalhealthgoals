// @vitest-environment node
/**
 * An edit to an image already in the library is made from the file as it is in
 * Blob now, attached to the request, so that Payload saves the result under a
 * new name instead of fetching a cached copy and overwriting it in place.
 */
import sharp from 'sharp'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@vercel/blob', () => ({ head: vi.fn() }))

import { head } from '@vercel/blob'
import { attachStoredImageForEdits } from '@/hooks/attachStoredImageForEdits'

/* eslint-disable @typescript-eslint/no-explicit-any */
const edits = {
  crop: { x: 5, y: 5, width: 90, height: 90 },
  widthInPixels: 360,
  heightInPixels: 450,
}
const record = {
  id: 7,
  filename: 'portrait-1.jpg',
  mimeType: 'image/jpeg',
  width: 400,
  height: 500,
}

let stored: Buffer
const fetchMock = vi.fn()

const run = async (
  overrides: Record<string, unknown> = {},
  doc: Record<string, unknown> = record,
) => {
  const req: any = {
    context: {},
    query: { uploadEdits: edits },
    payload: { findByID: vi.fn().mockResolvedValue(doc) },
    ...overrides,
  }
  const args: any = { id: 7 }
  const returned = await attachStoredImageForEdits({ args, req, operation: 'update' } as any)
  return { req, args, returned }
}

beforeEach(async () => {
  stored = await sharp({
    create: { width: 400, height: 500, channels: 3, background: { r: 40, g: 90, b: 100 } },
  })
    .jpeg()
    .toBuffer()
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token')
  vi.mocked(head).mockResolvedValue({
    url: 'https://store.example/portrait-1.jpg',
    uploadedAt: new Date('2026-09-30T08:00:00.000Z'),
    contentType: 'image/jpeg',
  } as any)
  fetchMock.mockResolvedValue(new Response(new Uint8Array(stored), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('attachStoredImageForEdits', () => {
  it('attaches the file as it is in Blob, under its current name', async () => {
    const { req, args, returned } = await run()
    expect(head).toHaveBeenCalledWith('portrait-1.jpg', { token: 'test-token' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://store.example/portrait-1.jpg?2026-09-30T08:00:00.000Z',
      { cache: 'no-store' },
    )
    expect(req.file.name).toBe('portrait-1.jpg')
    expect(req.file.mimetype).toBe('image/jpeg')
    expect(req.file.size).toBe(stored.length)
    expect(Buffer.compare(req.file.data, stored)).toBe(0)
    expect(returned).toBe(args)
  })

  it('stops, attaching nothing, when the stored file is not the one the record describes', async () => {
    const req: any = {
      context: {},
      query: { uploadEdits: edits },
      payload: { findByID: vi.fn().mockResolvedValue({ ...record, width: 320, height: 400 }) },
    }
    await expect(
      attachStoredImageForEdits({ args: { id: 7 }, req, operation: 'update' } as any),
    ).rejects.toThrow(/400×500 but its record says 320×400/)
    expect(req.file).toBeUndefined()
  })

  it('stops when Blob cannot supply the file', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))
    await expect(run()).rejects.toThrow(/could not be read \(404\)/)
  })

  it.each([
    [
      'there is no Blob store (local development)',
      () => vi.stubEnv('BLOB_READ_WRITE_TOKEN', ''),
      {},
    ],
    ['the save carries no edits', () => {}, { query: {} }],
    [
      'it is the storage plugin’s own metadata update',
      () => {},
      { context: { skipCloudStorage: true } },
    ],
  ])('leaves the request alone when %s', async (_label, arrange, overrides) => {
    arrange()
    const { req } = await run(overrides)
    expect(req.file).toBeUndefined()
    expect(head).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leaves a save that already brings a new file alone', async () => {
    const uploaded = {
      name: 'replacement.jpg',
      data: Buffer.from('x'),
      mimetype: 'image/jpeg',
      size: 1,
    }
    const { req } = await run({ file: uploaded })
    expect(req.file).toBe(uploaded)
    expect(head).not.toHaveBeenCalled()
  })
})
