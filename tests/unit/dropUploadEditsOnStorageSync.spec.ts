/**
 * The storage plugin's metadata update runs on the same request as the save
 * that triggered it; if the image editor's edits stay in that request, Payload
 * crops a second time from a file it has just overwritten (payloadcms/payload#15267).
 */
import { describe, it, expect } from 'vitest'

import { dropUploadEditsOnStorageSync } from '@/hooks/dropUploadEditsOnStorageSync'

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = (context: Record<string, unknown>, query: Record<string, unknown>) => {
  const req: any = { context, query }
  const args: any = { id: 1 }
  const returned = dropUploadEditsOnStorageSync({ args, req, operation: 'update' } as any)
  return { returned, args, query: req.query }
}
const edits = {
  crop: { x: 5, y: 5, width: 90, height: 90 },
  widthInPixels: 900,
  heightInPixels: 1200,
}

describe('dropUploadEditsOnStorageSync', () => {
  it('drops the edits from the storage plugin’s own metadata update', () => {
    const { returned, args, query } = run(
      { skipCloudStorage: true },
      { uploadEdits: edits, depth: '0' },
    )
    expect(query.uploadEdits).toBeUndefined()
    expect(query.depth).toBe('0')
    expect(returned).toBe(args)
  })

  it('leaves an editor’s own save alone, so the crop it asked for is made', () => {
    const { query } = run({}, { uploadEdits: edits })
    expect(query.uploadEdits).toEqual(edits)
  })
})
