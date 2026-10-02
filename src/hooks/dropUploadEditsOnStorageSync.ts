import type { CollectionBeforeOperationHook } from 'payload'

/**
 * Re-cropping a stored image failed, and failed after the file had already
 * been replaced (payloadcms/payload#15267).
 *
 * After a save, the cloud-storage plugin uploads the file and then records the
 * adapter's metadata with a second update on the SAME request, flagged with
 * `context.skipCloudStorage`. The image editor's `uploadEdits` are still in that
 * request's query, so Payload crops a second time: it downloads the file it
 * has just overwritten — which Vercel Blob may serve empty or truncated for a
 * moment — and throws, rolling the database back while the new file stays.
 *
 * That second update only records metadata. Take the edits out of it; the
 * crop the editor asked for has already been made by then.
 */
export const dropUploadEditsOnStorageSync: CollectionBeforeOperationHook = ({ args, req }) => {
  const query = req.query as Record<string, unknown> | undefined
  if (req.context?.skipCloudStorage && query?.uploadEdits) delete query.uploadEdits
  return args
}
