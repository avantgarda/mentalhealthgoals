#!/usr/bin/env tsx
/**
 * sync-media.ts — download the files the CMS references into public/media.
 *
 * Reads the media table of the LOCAL database (so run `pnpm sync:db` first),
 * collects `filename` plus every `sizes_*_filename` variant, and fetches each
 * one from the blob store's public URLs. No credentials: the store is
 * public-read.
 *
 * It downloads only what the CMS references. Orphaned blobs left by deleted
 * media records, and anything uploaded to the store outside Payload, are not
 * included — this is a development convenience, not a backup and not a store
 * mirror. For mirroring between stores use `pnpm blobs:mirror`, which is
 * owner-only and takes a token.
 *
 * It never deletes a local file.
 */

import { existsSync, readdirSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { config as loadEnv } from 'dotenv'
import { Client } from 'pg'

import { withVerifiedSSL } from './lib/postgres-connection'
import { collectReferencedMedia } from './lib/referenced-media'
import { PRODUCTION_BLOB_BASE_URL } from './lib/production-identifiers'

function loadLocalEnv(): void {
  // quiet: dotenv's banner is noise in a script that reports its own progress.
  loadEnv({ path: '.env.local', override: false, quiet: true })
}

/**
 * Where Payload's local storage adapter reads uploads from — see `staticDir` in
 * src/collections/Media.ts. Files land here and are served through
 * /api/media/file/<filename>, which is why a synced database needs no URL
 * rewriting.
 */
const MEDIA_DIR = 'public/media'

function printUsage(): void {
  console.log('Usage: pnpm sync:media [flags]')
  console.log('')
  console.log('Downloads every file the CMS media table references into public/media.')
  console.log('No token or other credentials required.')
  console.log('')
  console.log('Flags:')
  console.log('  --clean            Re-download everything, overwriting local copies')
  console.log('                     (still never deletes anything)')
  console.log('  --base-url <url>   Store to download from (default: the production store,')
  console.log('                     or BLOB_PUBLIC_BASE_URL from .env.local)')
  console.log('  --help, -h         Show this help')
  console.log('')
  console.log('Run `pnpm sync:db` first: the file list comes from the local database.')
}

async function fetchReferencedFilenames(databaseUrl: string): Promise<Set<string>> {
  const client = new Client({ connectionString: withVerifiedSSL(databaseUrl) })
  await client.connect()

  try {
    const referenced = await collectReferencedMedia(client)

    for (const name of referenced.skipped) {
      console.warn(`⚠️  Skipping unsafe filename from the database: ${JSON.stringify(name)}`)
    }
    if (referenced.skipped.length > 0) {
      console.warn(`⚠️  ${referenced.skipped.length} unsafe filename(s) skipped\n`)
    }

    console.log(`   Media rows: ${referenced.rowCount}`)
    console.log(`   Filename columns: ${referenced.filenameColumns.length} (original + sizes)`)
    console.log(`   Unique referenced files: ${referenced.filenames.size}\n`)

    return referenced.filenames
  } finally {
    await client.end()
  }
}

async function syncMedia(baseUrl: string, clean: boolean): Promise<void> {
  console.log('📋 Reading DATABASE_URL from .env.local...')
  loadLocalEnv()

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not found in .env.local. Set it to your local database.')
  }

  console.log('🔍 Collecting referenced filenames from the media table...')
  const referenced = await fetchReferencedFilenames(process.env.DATABASE_URL)

  if (referenced.size === 0) {
    throw new Error(
      'The media table references no files. If that is unexpected, run `pnpm sync:db` first.',
    )
  }

  if (!existsSync(MEDIA_DIR)) {
    await mkdir(MEDIA_DIR, { recursive: true })
  }

  const existingLocal = new Set(readdirSync(MEDIA_DIR))
  const alreadyLocal = [...referenced].filter((filename) => existingLocal.has(filename))
  const localOnly = [...existingLocal].filter((filename) => !referenced.has(filename))
  const toDownload = clean
    ? [...referenced]
    : [...referenced].filter((filename) => !existingLocal.has(filename))

  console.log('📋 Comparing with public/media:')
  console.log(`   Referenced and already here: ${alreadyLocal.length}`)
  console.log(`   To download: ${toDownload.length}${clean ? ' (--clean: all, overwriting)' : ''}`)
  console.log(`   Here but not referenced (left alone): ${localOnly.length}\n`)

  if (toDownload.length === 0) {
    console.log('✅ Everything referenced is already here. Use --clean to re-download.')
    return
  }

  console.log(`Downloading ${toDownload.length} file(s) from ${baseUrl}\n`)

  let downloaded = 0
  const failed: string[] = []

  for (const filename of toDownload) {
    try {
      const response = await fetch(baseUrl + encodeURIComponent(filename))
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const buffer = await response.arrayBuffer()
      await writeFile(join(MEDIA_DIR, filename), Buffer.from(buffer))
      downloaded += 1
      if (downloaded % 25 === 0) {
        console.log(`   ${downloaded}/${toDownload.length}...`)
      }
    } catch (error) {
      failed.push(filename)
      console.error(
        `   ❌ ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  console.log('')
  console.log(`✅ Downloaded: ${downloaded}`)

  if (failed.length > 0) {
    console.error(`❌ Failed: ${failed.length}`)
    console.error('   These are referenced by the CMS but could not be fetched from the store —')
    console.error('   possibly broken media records, possibly a store that has not been')
    console.error('   mirrored. Investigate before trusting the local site:')
    for (const filename of failed.slice(0, 20)) {
      console.error(`   - ${filename}`)
    }
    if (failed.length > 20) {
      console.error(`   ...and ${failed.length - 20} more`)
    }
    process.exit(1)
  }
}

const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  printUsage()
  process.exit(0)
}

const baseUrlIndex = argv.indexOf('--base-url')
let baseUrlFlag: string | undefined

if (baseUrlIndex !== -1) {
  baseUrlFlag = argv[baseUrlIndex + 1]
  if (!baseUrlFlag || baseUrlFlag.startsWith('-')) {
    console.error('Error: --base-url needs a URL')
    process.exit(1)
  }
}

const known = new Set(['--clean', '--base-url'])
const unknown = argv.filter(
  (argument, index) =>
    argument.startsWith('-') &&
    !known.has(argument) &&
    !(baseUrlIndex !== -1 && index === baseUrlIndex + 1),
)

if (unknown.length > 0) {
  console.error(`Error: unknown flag(s): ${unknown.join(', ')}\n`)
  printUsage()
  process.exit(1)
}

loadLocalEnv()

let baseUrl = baseUrlFlag || process.env.BLOB_PUBLIC_BASE_URL || PRODUCTION_BLOB_BASE_URL

if (!baseUrl) {
  console.error('No blob store to download from.\n')
  console.error('Set BLOB_PUBLIC_BASE_URL in .env.local, pass --base-url, or fill in')
  console.error('PRODUCTION_BLOB_BASE_URL in scripts/lib/production-identifiers.ts.')
  console.error('')
  console.error("Find it in Vercel → Storage → the Blob store: take any file's public URL")
  console.error('and keep the origin, e.g. https://xxxx.public.blob.vercel-storage.com/')
  process.exit(1)
}

if (!baseUrl.endsWith('/')) baseUrl += '/'

syncMedia(baseUrl, argv.includes('--clean')).catch((error: unknown) => {
  console.error('\n❌ Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
