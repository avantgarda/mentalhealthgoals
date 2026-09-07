import { createHash, randomUUID } from 'node:crypto'

import type { ListBlobResultBlob } from '@vercel/blob'

import { retry } from './retry'

/**
 * Copying the production Blob store into the preview one.
 *
 * Neon branches the database per preview deployment; Vercel Blob does not
 * branch at all. This site therefore keeps two stores — production and preview
 * — so a preview can never overwrite a live file. The cost of that isolation is
 * that a preview starts with none of production's uploads, and every image
 * 404s until they are copied across. This is that copy.
 *
 * Every step is verified because the failure it guards against is silent: a
 * truncated download uploaded over a good file looks exactly like success. So
 * bytes are counted against the listing, hashed, re-read from the destination
 * and hashed again, and nothing is ever deleted until every source file has
 * been confirmed present and identical.
 *
 * `additive` (the default) leaves preview-only files alone. `exact` prunes
 * them, and only after the whole verification pass has succeeded.
 */

export type MirrorMode = 'additive' | 'exact'

export type BlobEntry = Pick<
  ListBlobResultBlob,
  'downloadUrl' | 'pathname' | 'size' | 'uploadedAt' | 'url'
>

type ListResult = {
  blobs: BlobEntry[]
  cursor?: string
  hasMore: boolean
}

type PutOptions = {
  access: 'public'
  allowOverwrite: boolean
  cacheControlMaxAge?: number
  contentType?: string
  token: string
}

/** The Blob SDK surface this uses, injected so the logic can be tested. */
export type BlobOperations = {
  del: (pathname: string | string[], options: { token: string }) => Promise<void>
  fetch: typeof fetch
  list: (options: { cursor?: string; limit: number; token: string }) => Promise<ListResult>
  put: (pathname: string, body: Buffer, options: PutOptions) => Promise<unknown>
  sleep?: (milliseconds: number) => Promise<void>
}

export type MirrorPlan = {
  added: string[]
  changed: string[]
  preserved: string[]
  removed: string[]
  sourceBytes: number
  unchanged: string[]
}

export type MirrorResult = MirrorPlan & {
  deleted: number
  dryRun: boolean
  uploaded: number
  verified: number
}

type Logger = Pick<Console, 'error' | 'log' | 'warn'>

export type MirrorOptions = {
  confirm?: (plan: MirrorPlan) => Promise<void>
  destinationBaseUrl: string
  destinationToken: string
  dryRun?: boolean
  logger?: Logger
  mode?: MirrorMode
  operations: BlobOperations
  productionBaseUrl: string
  sourceToken: string
}

type BlobPayload = {
  bytes: Buffer
  cacheControlMaxAge?: number
  contentType?: string
  sha256: string
}

const LIST_LIMIT = 1000
const FETCH_TIMEOUT_MS = 30_000

export function normaliseBlobBaseUrl(value: string): string {
  const url = new URL(value)

  if (url.protocol !== 'https:') {
    throw new Error(`Blob store URL must use HTTPS: ${value}`)
  }

  return `${url.origin}/`
}

function blobBaseUrl(blob: BlobEntry): string {
  const publicBase = normaliseBlobBaseUrl(blob.url)
  const downloadBase = normaliseBlobBaseUrl(blob.downloadUrl)
  if (downloadBase !== publicBase) {
    throw new Error(
      `Blob ${JSON.stringify(blob.pathname)} has mismatched public and download origins`,
    )
  }
  return publicBase
}

function validateUniquePathnames(blobs: BlobEntry[], label: string): void {
  const pathnames = new Set<string>()

  for (const blob of blobs) {
    if (pathnames.has(blob.pathname)) {
      throw new Error(`${label} returned duplicate pathname ${JSON.stringify(blob.pathname)}`)
    }
    pathnames.add(blob.pathname)
  }
}

/**
 * Prove a token belongs to the store we think it does.
 *
 * A token is opaque, so the only honest check is to list what it can see and
 * look at where those files live. An empty store cannot be identified this way,
 * and is refused rather than assumed — that refusal is the whole point.
 */
export function assertStoreIdentity(
  blobs: BlobEntry[],
  expectedBaseUrl: string,
  label: string,
): string {
  const expected = normaliseBlobBaseUrl(expectedBaseUrl)

  if (blobs.length === 0) {
    throw new Error(
      `${label} is empty, so its token cannot be checked against ${expected}. ` +
        'Upload one file through the Vercel dashboard, then run this again.',
    )
  }

  const actualBases = new Set(blobs.map(blobBaseUrl))
  if (actualBases.size !== 1) {
    throw new Error(`${label} returned blobs from multiple stores: ${[...actualBases].join(', ')}`)
  }

  const [actual] = actualBases
  if (actual !== expected) {
    throw new Error(`${label} token resolves to ${actual}, expected ${expected}`)
  }

  return actual
}

export async function listAllBlobEntries(
  token: string,
  operations: BlobOperations,
): Promise<BlobEntry[]> {
  const blobs: BlobEntry[] = []
  let cursor: string | undefined

  do {
    const result = await operations.list({
      token,
      limit: LIST_LIMIT,
      ...(cursor ? { cursor } : {}),
    })
    blobs.push(...result.blobs)

    if (result.hasMore && !result.cursor) {
      throw new Error('Blob listing reported another page without returning a cursor')
    }
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)

  validateUniquePathnames(blobs, 'Blob listing')
  return blobs.sort((left, right) => left.pathname.localeCompare(right.pathname))
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function parseCacheControlMaxAge(value: string | null): number | undefined {
  if (!value) return undefined

  const candidates = [...value.matchAll(/(?:^|,)\s*(?:s-maxage|max-age)=(\d+)/gi)]
    .map((match) => Number(match[1]))
    .filter((seconds) => Number.isSafeInteger(seconds) && seconds >= 60)

  return candidates.length > 0 ? Math.max(...candidates) : undefined
}

/** A CDN edge holding a stale copy would defeat every hash check below. */
export function cacheBustedUrl(value: string, nonce: string): string {
  const url = new URL(value)
  url.searchParams.set('__blob_mirror', nonce)
  return url.href
}

/** Download a blob URL, check its length against the listing, and hash it. */
export async function fetchVerifiedBytes(
  url: string,
  expectedSize: number,
  label: string,
  options: { fetch: typeof fetch; logger?: Logger; sleep?: (ms: number) => Promise<void> },
): Promise<BlobPayload> {
  return retry(
    label,
    async () => {
      const response = await options.fetch(cacheBustedUrl(url, randomUUID()), {
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.byteLength !== expectedSize) {
        throw new Error(`received ${bytes.byteLength} bytes; listing reported ${expectedSize}`)
      }

      return {
        bytes,
        cacheControlMaxAge: parseCacheControlMaxAge(response.headers.get('cache-control')),
        contentType: response.headers.get('content-type') ?? undefined,
        sha256: sha256(bytes),
      }
    },
    { logger: options.logger, sleep: options.sleep },
  )
}

function fetchBlob(
  blob: BlobEntry,
  operations: BlobOperations,
  logger: Logger,
  label: string,
): Promise<BlobPayload> {
  return fetchVerifiedBytes(blob.downloadUrl, blob.size, `${label} ${blob.pathname}`, {
    fetch: operations.fetch,
    logger,
    sleep: operations.sleep,
  })
}

function snapshot(blobs: BlobEntry[]): Map<string, string> {
  return new Map(
    blobs.map((blob) => [blob.pathname, `${blob.size}:${new Date(blob.uploadedAt).toISOString()}`]),
  )
}

/**
 * Refuse to prune if production moved under us.
 *
 * The plan was built against a snapshot. If somebody uploaded to production
 * while this was running, "preview-only" no longer means what it meant when the
 * list was taken, and deleting on that basis could remove a file that is now
 * live.
 */
function assertSnapshotUnchanged(before: BlobEntry[], after: BlobEntry[]): void {
  const beforeSnapshot = snapshot(before)
  const afterSnapshot = snapshot(after)

  if (beforeSnapshot.size !== afterSnapshot.size) {
    throw new Error('The production store changed during the mirror; nothing was pruned')
  }

  for (const [pathname, fingerprint] of beforeSnapshot) {
    if (afterSnapshot.get(pathname) !== fingerprint) {
      throw new Error(
        `The production store changed during the mirror at ${JSON.stringify(pathname)}; ` +
          'nothing was pruned',
      )
    }
  }
}

async function buildMirrorPlan(
  source: BlobEntry[],
  destination: BlobEntry[],
  operations: BlobOperations,
  logger: Logger,
): Promise<{ hashes: Map<string, string>; plan: MirrorPlan }> {
  const destinationByPath = new Map(destination.map((blob) => [blob.pathname, blob]))
  const sourcePathnames = new Set(source.map((blob) => blob.pathname))
  const hashes = new Map<string, string>()
  const plan: MirrorPlan = {
    added: [],
    changed: [],
    preserved: destination
      .filter((blob) => !sourcePathnames.has(blob.pathname))
      .map((blob) => blob.pathname),
    removed: [],
    sourceBytes: source.reduce((total, blob) => total + blob.size, 0),
    unchanged: [],
  }

  logger.log(`Comparing ${source.length} production blobs with ${destination.length} preview blobs`)

  for (const sourceBlob of source) {
    const sourcePayload = await fetchBlob(sourceBlob, operations, logger, 'Read production')
    hashes.set(sourceBlob.pathname, sourcePayload.sha256)

    const destinationBlob = destinationByPath.get(sourceBlob.pathname)
    if (!destinationBlob) {
      plan.added.push(sourceBlob.pathname)
      continue
    }

    // A size difference is conclusive on its own, so skip the download.
    if (destinationBlob.size !== sourceBlob.size) {
      plan.changed.push(sourceBlob.pathname)
      continue
    }

    const destinationPayload = await fetchBlob(destinationBlob, operations, logger, 'Read preview')
    if (destinationPayload.sha256 === sourcePayload.sha256) {
      plan.unchanged.push(sourceBlob.pathname)
    } else {
      plan.changed.push(sourceBlob.pathname)
    }
  }

  return { hashes, plan }
}

function logPlan(plan: MirrorPlan, mode: MirrorMode, logger: Logger): void {
  logger.log('')
  logger.log('Blob mirror plan:')
  logger.log(`  Add to preview:      ${plan.added.length}`)
  logger.log(`  Replace in preview:  ${plan.changed.length}`)
  logger.log(`  Already identical:   ${plan.unchanged.length}`)
  logger.log(
    `  Preview-only:        ${plan.preserved.length} (${mode === 'exact' ? 'remove' : 'keep'})`,
  )
  logger.log(`  Production bytes:    ${plan.sourceBytes}`)
  logger.log('')
}

async function verifyDestination(
  source: BlobEntry[],
  expectedHashes: Map<string, string>,
  destinationToken: string,
  destinationBaseUrl: string,
  operations: BlobOperations,
  logger: Logger,
): Promise<BlobEntry[]> {
  return retry(
    'Verify the complete preview mirror',
    async () => {
      const destination = await listAllBlobEntries(destinationToken, operations)
      assertStoreIdentity(destination, destinationBaseUrl, 'Preview blob store')
      const destinationByPath = new Map(destination.map((blob) => [blob.pathname, blob]))

      for (const sourceBlob of source) {
        const destinationBlob = destinationByPath.get(sourceBlob.pathname)
        if (!destinationBlob) {
          throw new Error(`Preview verification failed: ${sourceBlob.pathname} is missing`)
        }
        if (destinationBlob.size !== sourceBlob.size) {
          throw new Error(
            `Preview verification failed: ${sourceBlob.pathname} is ${destinationBlob.size} bytes, ` +
              `expected ${sourceBlob.size}`,
          )
        }

        const payload = await fetchBlob(destinationBlob, operations, logger, 'Verify preview')
        if (payload.sha256 !== expectedHashes.get(sourceBlob.pathname)) {
          throw new Error(
            `Preview verification failed: ${sourceBlob.pathname} has different contents`,
          )
        }
      }

      return destination
    },
    { logger, sleep: operations.sleep },
  )
}

async function deleteInBatches(
  pathnames: string[],
  token: string,
  operations: BlobOperations,
  logger: Logger,
): Promise<void> {
  const batchSize = 100

  for (let index = 0; index < pathnames.length; index += batchSize) {
    const batch = pathnames.slice(index, index + batchSize)
    await retry(
      `Delete preview-only blobs ${index + 1}-${index + batch.length}`,
      () => operations.del(batch, { token }),
      { logger, sleep: operations.sleep },
    )
  }
}

export async function mirrorProductionToPreview(options: MirrorOptions): Promise<MirrorResult> {
  const {
    confirm,
    destinationToken,
    dryRun = false,
    operations,
    productionBaseUrl,
    sourceToken,
  } = options
  const logger = options.logger ?? console
  const mode = options.mode ?? 'additive'
  const productionBase = normaliseBlobBaseUrl(productionBaseUrl)
  const destinationBase = normaliseBlobBaseUrl(options.destinationBaseUrl)

  // Three ways to accidentally point this at production, all refused before a
  // single byte is read.
  if (destinationBase === productionBase) {
    throw new Error('Refusing to mirror: the destination is the production blob store')
  }
  if (sourceToken === destinationToken) {
    throw new Error('Refusing to mirror: the production and preview tokens are identical')
  }

  logger.log('Preflight: checking both tokens resolve to the stores they should')
  const sourceBefore = await listAllBlobEntries(sourceToken, operations)
  const destinationBefore = await listAllBlobEntries(destinationToken, operations)
  const sourceBase = assertStoreIdentity(sourceBefore, productionBase, 'Production blob store')
  const actualDestinationBase = assertStoreIdentity(
    destinationBefore,
    destinationBase,
    'Preview blob store',
  )

  if (sourceBase === actualDestinationBase) {
    throw new Error('Refusing to mirror a blob store onto itself')
  }

  const { hashes, plan } = await buildMirrorPlan(
    sourceBefore,
    destinationBefore,
    operations,
    logger,
  )
  if (mode === 'exact') plan.removed = [...plan.preserved]
  logPlan(plan, mode, logger)

  if (dryRun) {
    logger.log('Dry run complete; nothing was changed.')
    return { ...plan, deleted: 0, dryRun: true, uploaded: 0, verified: 0 }
  }

  if (!confirm) {
    throw new Error('A write confirmation callback is required for a non-dry-run mirror')
  }
  await confirm(plan)

  const sourceByPath = new Map(sourceBefore.map((blob) => [blob.pathname, blob]))
  const toUpload = [...plan.added, ...plan.changed]

  for (const pathname of toUpload) {
    const sourceBlob = sourceByPath.get(pathname)
    if (!sourceBlob) throw new Error(`Internal mirror error: source ${pathname} disappeared`)

    // Re-read rather than holding every file in memory, and check the hash
    // still matches what the plan was built from.
    const payload = await fetchBlob(sourceBlob, operations, logger, 'Re-read production')
    if (payload.sha256 !== hashes.get(pathname)) {
      throw new Error(
        `Production changed while copying ${JSON.stringify(pathname)}; nothing was pruned`,
      )
    }

    await retry(
      `Upload ${pathname}`,
      () =>
        operations.put(pathname, payload.bytes, {
          access: 'public',
          allowOverwrite: true,
          ...(payload.cacheControlMaxAge ? { cacheControlMaxAge: payload.cacheControlMaxAge } : {}),
          ...(payload.contentType ? { contentType: payload.contentType } : {}),
          token: destinationToken,
        }),
      { logger, sleep: operations.sleep },
    )
  }

  const sourceAfterCopy = await listAllBlobEntries(sourceToken, operations)
  assertStoreIdentity(sourceAfterCopy, productionBase, 'Production blob store')
  assertSnapshotUnchanged(sourceBefore, sourceAfterCopy)

  await verifyDestination(
    sourceBefore,
    hashes,
    destinationToken,
    destinationBase,
    operations,
    logger,
  )

  if (mode === 'exact') {
    if (plan.removed.length > 0) {
      logger.log(
        `Every production blob verified; pruning ${plan.removed.length} preview-only blobs`,
      )
      await deleteInBatches(plan.removed, destinationToken, operations, logger)
    }

    await retry(
      'Verify the preview pathname set after pruning',
      async () => {
        const destinationAfterDelete = await listAllBlobEntries(destinationToken, operations)
        assertStoreIdentity(destinationAfterDelete, destinationBase, 'Preview blob store')
        const expectedPathnames = new Set(sourceBefore.map((blob) => blob.pathname))
        const unexpected = destinationAfterDelete.filter(
          (blob) => !expectedPathnames.has(blob.pathname),
        )
        const destinationPathnames = new Set(destinationAfterDelete.map((blob) => blob.pathname))
        const missing = sourceBefore.filter((blob) => !destinationPathnames.has(blob.pathname))

        if (unexpected.length > 0 || missing.length > 0) {
          throw new Error(
            `Exact mirror verification failed after pruning: ${missing.length} missing, ` +
              `${unexpected.length} unexpected`,
          )
        }
      },
      { logger, sleep: operations.sleep },
    )
  } else if (plan.preserved.length > 0) {
    logger.log(`Kept ${plan.preserved.length} preview-only blobs (additive mode).`)
  }

  logger.log(
    `Mirror complete: uploaded ${toUpload.length}, verified ${sourceBefore.length}, ` +
      `deleted ${mode === 'exact' ? plan.removed.length : 0}.`,
  )

  return {
    ...plan,
    deleted: mode === 'exact' ? plan.removed.length : 0,
    dryRun: false,
    uploaded: toUpload.length,
    verified: sourceBefore.length,
  }
}
