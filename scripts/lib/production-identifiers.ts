/**
 * How the scripts recognise Production.
 *
 * Not a secret: the blob origin is a public-read host. It lives here so the
 * commands that need to know where production's files are share one definition
 * instead of each carrying a copy.
 *
 * It starts empty and the guard below refuses to run until it is filled in. A
 * check that cannot recognise Production is worse than no check: it reads as
 * protection while allowing exactly the operation it exists to prevent.
 *
 * There is deliberately no equivalent for the production *database*. Copying
 * from it is the intended operation, so recognising it would gate nothing; what
 * matters is where a command writes, and `assertLocalDatabase` in
 * ./postgres-connection settles that by refusing any target but localhost.
 */

/**
 * Public base URL of the production blob store, with a trailing slash.
 *
 * Find it in Vercel → Storage → `blob-mentalhealthgoals-prod` → any file's
 * public URL, keeping only the origin:
 * `https://<id>.public.blob.vercel-storage.com/`.
 *
 * It is not visible in this site's page source, because Payload proxies uploads
 * through `/api/media/file/…` rather than linking the store directly.
 */
export const PRODUCTION_BLOB_BASE_URL: string | undefined = undefined

/** The production blob origin, or a clear error explaining how to set it. */
export function requireProductionBlobBaseUrl(): string {
  if (!PRODUCTION_BLOB_BASE_URL) {
    throw new Error(
      'The production blob store origin is not configured.\n' +
        'Fill in PRODUCTION_BLOB_BASE_URL at scripts/lib/production-identifiers.ts — the file\n' +
        'says where to find the value.\n' +
        'Or pass one for this run with BLOB_PUBLIC_BASE_URL in .env.local (sync:media only).',
    )
  }
  return PRODUCTION_BLOB_BASE_URL
}
