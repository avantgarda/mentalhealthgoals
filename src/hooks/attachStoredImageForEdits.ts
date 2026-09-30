import type { CollectionBeforeOperationHook } from 'payload'

import { head } from '@vercel/blob'
import { APIError } from 'payload'
import sharp from 'sharp'

/**
 * Editing an image already in the library — a crop, or a moved focal point —
 * is handled as a fresh upload of the stored file, so the result is saved
 * under a new name instead of over the old one.
 *
 * Left alone, Payload fetches the stored file back through the site's own
 * `/api/media/file/<name>`, crops it, and writes the result to the same name.
 * That address is cached by the CDN for a year, region by region, and Vercel
 * Blob takes a while to show an overwrite — so the second edit of an image was
 * made from an older copy of it: a save that succeeded with the wrong picture.
 *
 * Here the current file is read straight from Blob and attached to the
 * request. Payload then crops what it was handed and, because the name is
 * taken, saves under the next one (photo-1.jpg → photo-2.jpg); the storage
 * plugin uploads the new files and removes the old. Nothing is overwritten in
 * place, so there is no stale copy for anything to pick up.
 *
 * The file has to be the one the record describes. If its dimensions differ
 * the save stops before anything is written, rather than crop the wrong image.
 *
 * Only where Blob is the store. Locally, files are on disk and Payload's own
 * path reads them there.
 */
export const attachStoredImageForEdits: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const edits = (req.query as Record<string, unknown> | undefined)?.uploadEdits
  // Present when one record is being updated; a bulk update has a `where` instead.
  const id = (args as { id?: number | string }).id
  if (
    operation !== 'update' ||
    !token ||
    !id ||
    req.file ||
    // The storage plugin's own metadata update: see dropUploadEditsOnStorageSync.
    req.context?.skipCloudStorage ||
    !edits ||
    typeof edits !== 'object'
  ) {
    return args
  }

  const doc = await req.payload.findByID({ collection: 'media', id, depth: 0, req })
  if (!doc.filename) return args

  const prefix = (doc as { prefix?: null | string }).prefix
  const stored = await head(prefix ? `${prefix}/${doc.filename}` : doc.filename, { token })
  // A pathname is written once and never again, so the upload time in the
  // query only keeps an intermediary from answering for a file it has not seen.
  const response = await fetch(`${stored.url}?${stored.uploadedAt.toISOString()}`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new APIError(`The stored image could not be read (${response.status}).`, 502)
  }
  const data = Buffer.from(await response.arrayBuffer())

  const { height, width } = await sharp(data).metadata()
  if (width !== doc.width || height !== doc.height) {
    throw new APIError(
      `The stored image is ${width}×${height} but its record says ${doc.width}×${doc.height}, so it was not edited. Upload the image again, then edit it.`,
      409,
    )
  }

  req.file = {
    data,
    mimetype: doc.mimeType ?? stored.contentType,
    name: doc.filename,
    size: data.length,
  }
  return args
}
