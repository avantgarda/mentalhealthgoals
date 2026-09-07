/**
 * How the scripts recognise Production.
 *
 * Not a secret: the blob origin is a public-read host, and anyone with the URL
 * of any image on the site can read it. It lives here so the commands that need
 * to know where production's files are share one definition instead of each
 * carrying a copy.
 *
 * The accessor below still refuses to continue if this is ever emptied. A check
 * that cannot recognise Production is worse than no check: it reads as
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
 * This is `blob-mentalhealthgoals-prod` (store_Qv61VrYdLkYi0fiN). The preview
 * store is `blob-mentalhealthgoals-preview`, at
 * `https://paihjs63torh2qcg.public.blob.vercel-storage.com/` — that one is the
 * destination of `pnpm blobs:mirror`, and is passed in rather than hardcoded so
 * a wrong value cannot silently become the target of a write.
 *
 * It is not visible in this site's page source, because Payload proxies uploads
 * through `/api/media/file/…` rather than linking the store directly. To
 * re-derive it if a store is ever recreated:
 *
 *   vercel blob get-store <store-id>     # prints "Base URL"
 *   vercel blob list-stores              # if you need the id
 */
export const PRODUCTION_BLOB_BASE_URL: string | undefined =
  'https://qv61vrydlkyi0fin.public.blob.vercel-storage.com/'

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
