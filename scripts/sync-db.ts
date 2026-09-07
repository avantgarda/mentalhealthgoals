#!/usr/bin/env tsx
/**
 * sync-db.ts — copy the production database down to this machine.
 *
 * Content lives in the production CMS. This is how a laptop gets a copy of it:
 * `pg_dump` from a read-only Neon role into a cached dump file, then drop and
 * recreate the local database from that dump.
 *
 * It only ever writes to localhost. The source is read-only by construction —
 * `SYNC_DATABASE_URL` should hold the `sync_readonly` role's string, not an
 * owner's — and the target is checked before anything is dropped.
 *
 * Personal data is left behind by default: no users, no sessions, no form
 * submissions. See PII_TABLE_PATTERNS below.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { config as loadEnv } from 'dotenv'

import { assertLocalDatabase, parsePostgresConnection } from './lib/postgres-connection'

/**
 * `.env.local` first, then the ambient environment — the convention across
 * these scripts. Note the precedence: an exported DATABASE_URL beats the file,
 * which is why the target is asserted rather than trusted.
 */
function loadLocalEnv(): void {
  // quiet: dotenv's banner is noise in a script that reports its own progress.
  loadEnv({ path: '.env.local', override: false, quiet: true })
}

/**
 * Tables whose *data* is not copied down.
 *
 * A laptop has no business holding real enquiries, Forum registrations, or the
 * password hashes of the people who edit the site. Their table definitions are
 * still restored, so the schema matches production and `payload migrate` has
 * something to migrate — only the rows are left behind.
 *
 * An empty `users` table means `/admin` offers "create the first user" on the
 * first visit. That is the intended flow: make yourself a local admin.
 *
 * Patterns are pg_dump glob patterns, so the `*` forms catch the `_rels` and
 * `_submission_data` side tables without naming each one.
 */
const PII_TABLE_PATTERNS = [
  'users',
  'users_sessions',
  'payload_preferences*',
  'payload_locked_documents*',
  'form_submissions*',
] as const

/** Postgres identifiers this script is willing to interpolate into psql -c. */
const SAFE_DATABASE_NAME = /^[A-Za-z0-9_-]+$/

function commandExists(command: string): boolean {
  try {
    execFileSync('which', [command], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * A dump is only reusable for the same source, so the cache is keyed by the
 * connection string with the password stripped out.
 */
function hashConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    const safeString = `${url.protocol}//${url.username}@${url.hostname}:${url.port}${url.pathname}${url.search}`
    return createHash('sha256').update(safeString).digest('hex').slice(0, 12)
  } catch {
    return createHash('sha256').update(connectionString).digest('hex').slice(0, 12)
  }
}

type Dump = { path: string; timestamp: number }

function findExistingDumps(dumpDir: string, connectionHash: string): Dump[] {
  if (!existsSync(dumpDir)) return []

  const pattern = new RegExp(`^neon-dump-${connectionHash}-(\\d+)\\.sql$`)
  return readdirSync(dumpDir)
    .map((file) => {
      const match = file.match(pattern)
      return match ? { path: join(dumpDir, file), timestamp: Number(match[1]) } : undefined
    })
    .filter((dump): dump is Dump => dump !== undefined)
    .sort((a, b) => b.timestamp - a.timestamp)
}

function describeAge(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  const units: Array<[number, string]> = [
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ]

  for (const [size, name] of units) {
    const count = Math.floor(seconds / size)
    if (count > 0) return `${count} ${name}${count !== 1 ? 's' : ''}`
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`
}

/** Removes every dump but `keep`; pass undefined to remove all of them. */
function cleanupDumps(dumps: Dump[], keep?: string): number {
  let deleted = 0
  for (const dump of dumps) {
    if (dump.path === keep) continue
    try {
      unlinkSync(dump.path)
      deleted += 1
    } catch {
      // A dump we cannot delete is not worth failing the sync over.
    }
  }
  return deleted
}

/**
 * Prefer a PostgreSQL 17 client.
 *
 * pg_dump refuses to dump a server newer than itself, and Neon runs 17. macOS
 * and Homebrew both ship older clients happily, so an explicit look at the
 * keg-only install saves a confusing version error.
 */
function findClientTools(): { pgDump: string; psql: string; version: string } {
  const kegs = [
    '/opt/homebrew/opt/postgresql@17/bin',
    '/usr/local/opt/postgresql@17/bin',
    '/opt/homebrew/opt/libpq/bin',
  ]

  for (const dir of kegs) {
    const pgDump = join(dir, 'pg_dump')
    const psql = join(dir, 'psql')
    if (!existsSync(pgDump) || !existsSync(psql)) continue
    try {
      const version = execFileSync(pgDump, ['--version'], { encoding: 'utf-8' }).trim()
      return { pgDump, psql, version }
    } catch {
      // Present but not runnable — fall through to the system client.
    }
  }

  if (!commandExists('pg_dump') || !commandExists('psql')) {
    throw new Error(
      'pg_dump and psql not found. Install the PostgreSQL 17 client tools:\n' +
        '  brew install postgresql@17',
    )
  }

  const version = execFileSync('pg_dump', ['--version'], { encoding: 'utf-8' }).trim()
  return { pgDump: 'pg_dump', psql: 'psql', version }
}

function run(command: string, args: string[], env: Record<string, string> = {}): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string }
    if (shell.stdout) console.error(shell.stdout)
    if (shell.stderr) console.error(shell.stderr)
    throw error
  }
}

type Options = { force: boolean; withPii: boolean }

async function syncDatabase(sourceConnectionString: string, options: Options): Promise<void> {
  console.log('🔄 Syncing the production database down to this machine...\n')

  const { pgDump, psql, version } = findClientTools()
  console.log(`📦 Using: ${version}`)
  if (/\b17\./.test(version)) {
    console.log('   ✅ PostgreSQL 17 client (matches the Neon server)\n')
  } else {
    console.log('   ⚠️  Not a 17 client — pg_dump cannot dump a newer server.')
    console.log('      If the dump fails on a version mismatch: brew install postgresql@17\n')
  }

  console.log('📋 Reading .env.local...')
  loadLocalEnv()

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL not found. Set it in .env.local to the local database you want to replace.\n' +
        'Example: DATABASE_URL=postgresql://your-user@localhost:5432/mentalhealthgoals',
    )
  }

  const local = parsePostgresConnection(process.env.DATABASE_URL)
  assertLocalDatabase(process.env.DATABASE_URL, 'drop and recreate the local database')

  const targetDatabase = local.database
  if (!targetDatabase) {
    throw new Error('DATABASE_URL must include a database name')
  }
  if (!SAFE_DATABASE_NAME.test(targetDatabase)) {
    throw new Error(
      `Refusing to act on database name ${JSON.stringify(targetDatabase)}: ` +
        'only letters, digits, underscores and hyphens are handled here.',
    )
  }

  // The shared DATABASE_URL carries no username on purpose, so libpq falls back
  // to the operating-system user. Saying so beats printing "as " and nothing.
  const connectingAs = local.user || `${process.env.USER ?? 'your OS user'} (from the environment)`
  console.log(`   Target: ${targetDatabase} on ${local.host}:${local.port} as ${connectingAs}\n`)

  // PG* variables for the local client calls. Only set what differs from the
  // client's own defaults, so a developer using a socket connection is left
  // alone.
  const localEnv: Record<string, string> = { PGDATABASE: 'postgres' }
  if (local.host && local.host !== 'localhost') localEnv.PGHOST = local.host
  if (local.port !== '5432') localEnv.PGPORT = local.port
  if (local.user) localEnv.PGUSER = local.user
  if (local.password) localEnv.PGPASSWORD = local.password

  console.log('🔍 Checking the local PostgreSQL server is reachable...')
  try {
    run(psql, ['-d', 'postgres', '-c', 'SELECT 1;'], localEnv)
  } catch (error) {
    throw new Error(
      'Cannot connect to the local PostgreSQL server with the details in DATABASE_URL.\n' +
        `  ${local.user}@${local.host}:${local.port}\n` +
        `  ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        'Check that PostgreSQL is running (brew services start postgresql@17), that the\n' +
        'user exists, and that any password is included in DATABASE_URL.',
    )
  }
  console.log('✅ Local server reachable\n')

  const source = parsePostgresConnection(sourceConnectionString)
  if (source.host.includes('pooler')) {
    console.warn('⚠️  This looks like a POOLED connection string.')
    console.warn('   pg_dump needs a session, not a pooler. Use the unpooled string from Neon.\n')
  }
  console.log(`📋 Source: ${source.database} on ${source.host}\n`)

  const connectionHash = hashConnectionString(sourceConnectionString)
  const dumpDir = join(process.cwd(), 'temp', 'neon-dumps')
  mkdirSync(dumpDir, { recursive: true })

  const existing = findExistingDumps(dumpDir, connectionHash)
  // The cache holds one dump per source; anything else is left over from an
  // interrupted run.
  if (existing.length > 1 && !options.force) {
    const deleted = cleanupDumps(existing, existing[0].path)
    if (deleted > 0) console.log(`🧹 Removed ${deleted} stale dump file(s)\n`)
  }

  let dumpFile: string
  let reusedDump = false

  if (existing.length > 0 && !options.force) {
    const latest = existing[0]
    console.log('📦 Reusing the cached dump')
    console.log(`   ${latest.path.split('/').pop()}`)
    console.log(`   Taken ${describeAge(latest.timestamp)} ago — pass --force to re-download\n`)
    dumpFile = latest.path
    reusedDump = true
  } else {
    if (existing.length > 0) {
      const deleted = cleanupDumps(existing)
      if (deleted > 0) console.log(`🔄 --force: removed ${deleted} cached dump(s)\n`)
    }

    dumpFile = join(dumpDir, `neon-dump-${connectionHash}-${Date.now()}.sql`)

    console.log('📥 Downloading from Neon — this can take a minute...')
    if (options.withPii) {
      console.log('   ⚠️  --with-pii: users, sessions and form submissions ARE included\n')
    } else {
      console.log(`   Leaving behind: ${PII_TABLE_PATTERNS.join(', ')}\n`)
    }

    const excludeData = options.withPii
      ? []
      : PII_TABLE_PATTERNS.map((pattern) => `--exclude-table-data=${pattern}`)

    try {
      run(
        pgDump,
        [
          `--host=${source.host}`,
          `--port=${source.port}`,
          `--username=${source.user}`,
          `--dbname=${source.database}`,
          '--no-owner',
          '--no-acl',
          '--clean',
          '--if-exists',
          '--format=plain',
          // Payload lives entirely in `public`. Without this, pg_dump also tries
          // to dump Neon's managed schemas and fails with "permission denied"
          // under the read-only role, which has no grants outside `public`.
          '--schema=public',
          ...excludeData,
          `--file=${dumpFile}`,
        ],
        { PGPASSWORD: source.password, PGSSLMODE: source.sslmode },
      )
    } catch (error) {
      if (existsSync(dumpFile)) {
        try {
          unlinkSync(dumpFile)
        } catch {
          // Nothing useful to do about a failed cleanup of a failed dump.
        }
      }
      throw new Error(
        `Failed to download the database dump: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }

    console.log('✅ Dump complete\n')
  }

  try {
    console.log(`🗑️  Replacing the local database "${targetDatabase}"...`)

    // Anything still connected — a dev server, an open psql — would block the
    // drop. Terminating first turns a confusing failure into a working command.
    try {
      run(
        psql,
        [
          '-d',
          'postgres',
          '-c',
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
             WHERE datname = '${targetDatabase}' AND pid <> pg_backend_pid();`,
        ],
        localEnv,
      )
    } catch {
      // No connections to terminate, or no permission to. Either way the drop
      // below reports the real problem.
    }

    run(psql, ['-d', 'postgres', '-c', `DROP DATABASE IF EXISTS "${targetDatabase}";`], localEnv)
    run(psql, ['-d', 'postgres', '-c', `CREATE DATABASE "${targetDatabase}";`], localEnv)

    console.log('📤 Restoring...')
    run(psql, ['-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-f', dumpFile], {
      ...localEnv,
      PGDATABASE: targetDatabase,
    })
    console.log('✅ Restored\n')
  } catch (error) {
    // A dump we just took and could not restore is more likely truncated than
    // useful, so it does not stay in the cache to be reused tomorrow.
    if (!reusedDump && existsSync(dumpFile)) {
      try {
        unlinkSync(dumpFile)
      } catch {
        // As above.
      }
    }
    throw error
  }

  // Media URLs are left exactly as production wrote them. Payload serves
  // uploads through /api/media/file/<filename>, so the rows hold relative URLs
  // that resolve against whatever environment is running — no rewriting needed.
  console.log('🎉 Done.\n')
  console.log('Next:')
  console.log('  1. pnpm payload migrate    — apply any migrations this branch has that')
  console.log('                               production does not')
  console.log('  2. pnpm sync:media         — download the files the CMS references')
  console.log('  3. Restart `pnpm dev`      — globals are cached per server process, so a')
  console.log('                               running dev server keeps serving the old ones')
  if (!options.withPii) {
    console.log('')
    console.log('The users table is empty by design: open /admin and create your local admin.')
  }
}

function printUsage(): void {
  console.log(
    'Usage: pnpm sync:db [flags]                (source: SYNC_DATABASE_URL in .env.local)',
  )
  console.log('   or: pnpm sync:db <connection-string> [flags]')
  console.log('')
  console.log('Copies the production database into the local one named by DATABASE_URL,')
  console.log('dropping and recreating it. Refuses any target that is not localhost.')
  console.log('')
  console.log('Flags:')
  console.log('  --force, -f    Re-download even if a cached dump exists')
  console.log(
    '  --with-pii     Include users, sessions and form submissions (normally left behind)',
  )
  console.log('  --help, -h     Show this help')
  console.log('')
  console.log('Use the UNPOOLED Neon connection string, from a read-only role. See')
  console.log('scripts/README.md for how to get one.')
}

const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  printUsage()
  process.exit(0)
}

const positional = argv.find((argument) => !argument.startsWith('-'))
const flags = argv.filter((argument) => argument.startsWith('-'))
const known = new Set(['--force', '-f', '--with-pii'])
const unknown = flags.filter((flag) => !known.has(flag))

if (unknown.length > 0) {
  console.error(`Error: unknown flag${unknown.length !== 1 ? 's' : ''}: ${unknown.join(', ')}\n`)
  printUsage()
  process.exit(1)
}

loadLocalEnv()

const connectionString = positional ?? process.env.SYNC_DATABASE_URL
if (!connectionString) {
  console.error('No source connection string.\n')
  console.error('Set SYNC_DATABASE_URL in .env.local (pull it from the Vercel Development')
  console.error('environment — it is the read-only sync role), or pass one as an argument.\n')
  printUsage()
  process.exit(1)
}
if (!positional) {
  console.log('📋 Using SYNC_DATABASE_URL from .env.local as the source\n')
}

syncDatabase(connectionString, {
  force: flags.includes('--force') || flags.includes('-f'),
  withPii: flags.includes('--with-pii'),
}).catch((error: unknown) => {
  console.error('\n❌ Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
