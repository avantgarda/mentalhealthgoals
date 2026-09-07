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
 * Public base URLs of the two blob stores, with trailing slashes.
 *
 * Neither is visible in this site's page source, because Payload proxies
 * uploads through `/api/media/file/…` rather than linking a store directly. To
 * re-derive either if a store is ever recreated:
 *
 *   vercel blob list-stores              # ids
 *   vercel blob get-store <store-id>     # prints "Base URL"
 */

/** `blob-mentalhealthgoals-prod` — store_Qv61VrYdLkYi0fiN. Only ever read. */
export const PRODUCTION_BLOB_BASE_URL: string | undefined =
  'https://qv61vrydlkyi0fin.public.blob.vercel-storage.com/'

/**
 * `blob-mentalhealthgoals-preview` — store_PaIhjs63tOrH2qcG. The destination of
 * `pnpm blobs:mirror`.
 *
 * This was deliberately not recorded at first, on the reasoning that a default
 * destination is one typo away from being the wrong destination. That was
 * wrong, and worth saying why: the destination is not taken on trust. The
 * mirror lists what the destination token can actually see and refuses unless
 * every blob comes back on this exact origin, and separately refuses to write
 * anywhere that resolves to production. A typo here therefore stops the run
 * rather than misdirecting it — the value is a claim the script has to
 * disprove, not an instruction it follows.
 *
 * What the omission did cost was real: an origin nobody could remember, looked
 * up by hand every time, on a command run rarely enough to have forgotten how.
 *
 * Override with PREVIEW_BLOB_BASE_URL in the invoking environment if a store is
 * recreated before this constant catches up.
 */
export const PREVIEW_BLOB_BASE_URL = 'https://paihjs63torh2qcg.public.blob.vercel-storage.com/'

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

/** The preview store's origin: the environment wins, else the recorded value. */
export function previewBlobBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.PREVIEW_BLOB_BASE_URL?.trim() || PREVIEW_BLOB_BASE_URL
}
