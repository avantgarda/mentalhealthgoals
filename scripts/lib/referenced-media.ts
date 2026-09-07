import type { Client } from 'pg'

/**
 * The single definition of "which files the CMS references".
 *
 * Payload stores the original upload in `filename` and every generated image
 * size in its own `sizes_*_filename` column, so a mirror can hold the original
 * while every card and thumbnail 404s. The columns are discovered from
 * `information_schema` rather than hardcoded, because the set changes whenever
 * an image size is added to the Media collection — and this one has been
 * changed more than once.
 *
 * `skipped` is returned rather than swallowed so a caller can report it: a file
 * this refuses to name is a file the caller will not fetch, and silence there
 * looks identical to success.
 */

export type ReferencedMedia = {
  /** Every distinct filename the CMS references, safe to use as a path segment. */
  filenames: Set<string>
  /** Names rejected by {@link isSafeFilename}. Reported, never silently dropped. */
  skipped: string[]
  /** Number of rows in the media table, for reporting. */
  rowCount: number
  /** The `filename` / `*_filename` columns discovered on the table. */
  filenameColumns: string[]
}

/**
 * These filenames are written into local paths and into store URLs. A name
 * containing a separator, a parent-directory hop or a leading dot is either a
 * traversal attempt or a file that cannot round trip through both callers, so
 * neither should act on it.
 */
export function isSafeFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('..') &&
    !filename.startsWith('.')
  )
}

export async function collectReferencedMedia(client: Client): Promise<ReferencedMedia> {
  const columnsResult = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'media'`,
  )

  if (columnsResult.rows.length === 0) {
    throw new Error(
      'No media table found in this database.\n' +
        'Run `pnpm sync:db` first — the file list comes from the synced database.',
    )
  }

  const filenameColumns = columnsResult.rows
    .map((row) => row.column_name)
    .filter((column) => column === 'filename' || column.endsWith('_filename'))

  if (filenameColumns.length === 0) {
    throw new Error(
      'The media table has no filename columns — cannot determine which files are referenced.',
    )
  }

  const quotedColumns = filenameColumns.map((column) => `"${column.replaceAll('"', '""')}"`)
  // Newest first: a mirror that has fallen behind is missing recent uploads, so
  // a truncated report leads with the likeliest culprits.
  const result = await client.query<Record<string, unknown>>(
    `SELECT ${quotedColumns.join(', ')} FROM media ORDER BY updated_at DESC NULLS LAST`,
  )

  const filenames = new Set<string>()
  const skipped: string[] = []

  for (const row of result.rows) {
    for (const column of filenameColumns) {
      const value = row[column]
      if (typeof value !== 'string' || value.trim() === '') continue
      if (isSafeFilename(value)) filenames.add(value)
      else skipped.push(value)
    }
  }

  return { filenameColumns, filenames, rowCount: result.rows.length, skipped }
}
