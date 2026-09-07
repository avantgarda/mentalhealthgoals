#!/usr/bin/env tsx
/**
 * blob-mirror.ts — copy the production blob store into the preview one.
 *
 * Neon gives every preview deployment its own branch of the database. Vercel
 * Blob has no equivalent, so this project keeps two stores and scopes each
 * token to one environment. That stops a preview overwriting a live file, and
 * it means a preview shows broken images until production's uploads are copied
 * across. Run this after uploading anything real in production.
 *
 * This script deliberately does NOT read `.env.local`, unlike every other
 * script here. It reads `.env.blob-mirror`, and the difference is the point.
 *
 * `.env.local` is a file every collaborator has, and `vercel env pull` puts a
 * blob token in it. Reading it would let whichever token happened to be sitting
 * there decide which stores get written to — nobody chose it, it simply
 * arrived. `.env.blob-mirror` is a file that exists only because somebody made
 * it for this, holding tokens they went and fetched for this. Supplying a token
 * stays a deliberate act; it just stops being a nightly one.
 *
 * Either form works, and an exported variable beats the file:
 *
 *   PRODUCTION_BLOB_READ_WRITE_TOKEN=... \
 *   PREVIEW_BLOB_READ_WRITE_TOKEN=... \
 *     pnpm blobs:mirror --dry-run
 *
 * The two store origins are recorded in ./lib/production-identifiers.ts, so the
 * tokens are the only thing to supply. They stay explicit because a token is
 * what grants the write; the origins are only claims the script has to
 * disprove.
 *
 * Be aware what the file costs. A production blob read-write token can delete
 * every file the live site serves. This script will not do that — it refuses
 * production as a destination — but the token sitting on disk is not limited to
 * this script. Keep the file to yourself (chmod 600), and delete it when the
 * mirroring is done.
 *
 * If you are here because a token "isn't being picked up": that is this,
 * working as intended. Tokens are never accepted as command-line arguments,
 * where they would end up in shell history and process listings.
 */

import { existsSync, statSync } from 'node:fs'

import { del, list, put } from '@vercel/blob'
import { config as loadEnv } from 'dotenv'

import {
  mirrorProductionToPreview,
  type BlobOperations,
  type MirrorPlan,
} from './lib/blob-mirror-core'
import { confirmDestructive } from './lib/confirm'
import { previewBlobBaseUrl, requireProductionBlobBaseUrl } from './lib/production-identifiers'

const UNATTENDED_CONFIRMATION_ENV = 'BLOB_MIRROR_ALLOW_UNATTENDED'

/** Not `.env.local` — see the note at the top of this file. */
const TOKEN_FILE = '.env.blob-mirror'

/**
 * Load the tokens from their own file, if it is there.
 *
 * `override: false`, so anything already exported wins: a one-off run should
 * not be quietly overruled by a file somebody forgot they had.
 */
function loadTokenFile(): void {
  if (!existsSync(TOKEN_FILE)) return

  // A production read-write token is worth more than the file it sits in.
  const mode = statSync(TOKEN_FILE).mode & 0o077
  if (mode !== 0) {
    console.warn(`⚠️  ${TOKEN_FILE} is readable by other users on this machine.`)
    console.warn(`   chmod 600 ${TOKEN_FILE}`)
  }

  loadEnv({ path: TOKEN_FILE, override: false, quiet: true })
  console.log(`Read tokens from ${TOKEN_FILE}\n`)
}

const operations: BlobOperations = { del, fetch, list, put }

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Missing ${name}.\n` +
        "Both tokens come from Vercel → Storage → the store's own page. They cannot be pulled:\n" +
        'the production environment is marked Sensitive, so `vercel env pull` returns\n' +
        `[SENSITIVE]. Export them for one run, or keep them in ${TOKEN_FILE} (gitignored).`,
    )
  }
  return value
}

function printUsage(): void {
  console.log('Usage: pnpm blobs:mirror [--dry-run] [--exact] [--yes]')
  console.log('')
  console.log('Copies every file in the production blob store into the preview store, so')
  console.log('preview deployments stop showing broken images.')
  console.log('')
  console.log('Flags:')
  console.log('  --dry-run   Compare and report, change nothing')
  console.log('  --exact     Also delete preview files production does not have')
  console.log('              (only after every production file has been verified)')
  console.log(`  --yes       Skip the typed confirmation; needs ${UNATTENDED_CONFIRMATION_ENV}=1`)
  console.log('')
  console.log(`Required, either exported or in ${TOKEN_FILE} (never as arguments):`)
  console.log('  PRODUCTION_BLOB_READ_WRITE_TOKEN   read-write token for the production store')
  console.log('  PREVIEW_BLOB_READ_WRITE_TOKEN      read-write token for the preview store')
  console.log('')
  console.log('Both store origins are recorded in the repository. Override the destination')
  console.log('with PREVIEW_BLOB_BASE_URL only if the store has been recreated.')
  console.log('')
  console.log('Writing to the production store is refused outright.')
}

async function main(argv: string[]): Promise<void> {
  const supported = ['--dry-run', '--exact', '--yes']
  const unknown = argv.filter((argument) => !supported.includes(argument))

  if (unknown.length > 0) {
    throw new Error(
      `Unexpected argument${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}. ` +
        'Blob tokens must be supplied through environment variables.',
    )
  }

  loadTokenFile()

  const dryRun = argv.includes('--dry-run')
  const exact = argv.includes('--exact')
  const yes = argv.includes('--yes')

  const sourceToken = requireEnvironment('PRODUCTION_BLOB_READ_WRITE_TOKEN')
  const destinationToken = requireEnvironment('PREVIEW_BLOB_READ_WRITE_TOKEN')
  // Recorded in the repository rather than typed out each time. It is checked,
  // not trusted: the run is refused unless the destination token's own blobs
  // all come back on this origin.
  const destinationBaseUrl = previewBlobBaseUrl()

  await mirrorProductionToPreview({
    confirm: async (plan: MirrorPlan) => {
      console.log(
        `This will upload ${plan.added.length + plan.changed.length} production blobs to preview` +
          (exact ? ` and remove ${plan.removed.length} preview-only blobs.` : '.'),
      )
      await confirmDestructive({
        envGate: UNATTENDED_CONFIRMATION_ENV,
        phrase: exact ? 'MIRROR AND PRUNE PREVIEW' : 'MIRROR TO PREVIEW',
        yes,
      })
    },
    destinationBaseUrl,
    destinationToken,
    dryRun,
    mode: exact ? 'exact' : 'additive',
    operations,
    productionBaseUrl: requireProductionBlobBaseUrl(),
    sourceToken,
  })
}

const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  printUsage()
  process.exit(0)
}

main(argv).catch((error: unknown) => {
  console.error('')
  console.error('❌ Blob mirror failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
