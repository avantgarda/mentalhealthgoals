#!/usr/bin/env tsx
/**
 * bootstrap.ts — from a fresh clone to a running site.
 *
 * Checks the tools, writes a `.env.local` if there is not one, creates the
 * local database, and fills it either from production or from the repository's
 * own content. Everything it does can be done by hand; this exists so nobody
 * has to work out the order from the README on their first morning.
 *
 * Named `bootstrap` rather than `setup` because `pnpm setup` is one of pnpm's
 * own commands and would shadow the script.
 *
 * It installs nothing and changes nothing outside this repository and the local
 * Postgres server. Where a prerequisite is missing it says which, and stops.
 */

import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

import { config as loadEnv } from 'dotenv'

import { isLocalHostname, parsePostgresConnection } from './lib/postgres-connection'

const ENV_FILE = '.env.local'
const REQUIRED_NODE_MAJOR = 24
const DEFAULT_DATABASE = 'mentalhealthgoals'

/**
 * Secrets bootstrap will invent rather than ask for. CRON_SECRET is not among
 * them: nothing here schedules a job, and its absence closes the jobs endpoint
 * rather than opening it.
 */
const GENERATED_SECRETS = ['PAYLOAD_SECRET', 'PREVIEW_SECRET'] as const

type Step = { ok: boolean; label: string; detail?: string }

function report(step: Step): boolean {
  console.log(`${step.ok ? '✅' : '❌'} ${step.label}`)
  if (step.detail) {
    for (const line of step.detail.split('\n')) console.log(`   ${line}`)
  }
  return step.ok
}

function capture(command: string, args: string[], env?: NodeJS.ProcessEnv): string | undefined {
  try {
    return execFileSync(command, args, {
      encoding: 'utf-8',
      env: env ?? process.env,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return undefined
  }
}

function runVisibly(command: string, args: string[]): void {
  execFileSync(command, args, { stdio: 'inherit' })
}

function checkTooling(): boolean {
  console.log('Checking the tools this needs\n')
  let ok = true

  const nodeMajor = Number(process.versions.node.split('.')[0])
  ok =
    report({
      label: `Node ${process.versions.node}`,
      ok: nodeMajor === REQUIRED_NODE_MAJOR,
      detail:
        nodeMajor === REQUIRED_NODE_MAJOR
          ? undefined
          : `This project runs on Node ${REQUIRED_NODE_MAJOR} (.nvmrc, and what Vercel builds with).\n` +
            'With nvm: nvm install && nvm use',
    }) && ok

  const pgDumpVersion = capture('pg_dump', ['--version'])?.trim()
  const pgMajor = pgDumpVersion?.match(/\s(\d+)\./)?.[1]
  ok =
    report({
      label: pgDumpVersion ?? 'pg_dump not found',
      ok: pgMajor === '17',
      detail:
        pgMajor === '17'
          ? undefined
          : 'The database is PostgreSQL 17, and pg_dump cannot dump a server newer than\n' +
            'itself. Install the matching client: brew install postgresql@17',
    }) && ok

  return ok
}

/** Ask, unless nothing is listening — then take the answer that needs no secrets. */
async function ask(question: string, options: string[], fallback: number): Promise<number> {
  if (!process.stdin.isTTY) {
    console.log(`${question} → ${options[fallback]} (nothing attached to ask)`)
    return fallback
  }

  console.log('')
  console.log(question)
  options.forEach((option, index) => console.log(`  ${index + 1}. ${option}`))

  const readline = createInterface({ input: process.stdin, output: process.stdout })
  try {
    while (true) {
      const answer = (await readline.question(`Choose 1-${options.length}: `)).trim()
      const choice = Number(answer)
      if (Number.isInteger(choice) && choice >= 1 && choice <= options.length) return choice - 1
      console.log('Not one of the options.')
    }
  } finally {
    readline.close()
  }
}

async function ensureEnvFile(): Promise<void> {
  if (existsSync(ENV_FILE)) {
    console.log(`✅ ${ENV_FILE} already exists — leaving it alone`)
    return
  }

  // A linked project can fetch real values, which is the better outcome: the
  // developer gets SYNC_DATABASE_URL and the blob origin without asking anyone.
  if (existsSync('.vercel/project.json')) {
    console.log(`Pulling ${ENV_FILE} from the Vercel Development environment...`)
    try {
      runVisibly('pnpm', ['exec', 'vercel', 'env', 'pull', ENV_FILE])
      console.log(`✅ Wrote ${ENV_FILE} from Vercel`)
      return
    } catch {
      console.log('⚠️  Could not pull from Vercel (not logged in, or no access).')
      console.log('   Falling back to .env.example.')
    }
  }

  const template = readFileSync('.env.example', 'utf-8')
  const filled = GENERATED_SECRETS.reduce(
    (text, name) =>
      text.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${randomBytes(24).toString('hex')}`),
    template,
  )

  writeFileSync(ENV_FILE, filled)
  console.log(`✅ Wrote ${ENV_FILE} from .env.example, with fresh secrets`)
  console.log('   SYNC_DATABASE_URL is not set, so syncing from production is not available yet.')
  console.log('   See scripts/README.md for how to get one.')
}

function ensureDatabase(): { name: string; created: boolean } {
  loadEnv({ path: ENV_FILE, override: false, quiet: true })

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is not set in ${ENV_FILE}.`)
  }

  const local = parsePostgresConnection(databaseUrl)
  if (!isLocalHostname(local.host)) {
    throw new Error(
      `DATABASE_URL points at ${local.host}, not a local database.\n` +
        'Bootstrap only ever sets up a database on this machine.',
    )
  }

  const name = local.database || DEFAULT_DATABASE
  const env: NodeJS.ProcessEnv = { ...process.env, PGDATABASE: 'postgres' }
  if (local.port !== '5432') env.PGPORT = local.port
  if (local.user) env.PGUSER = local.user
  if (local.password) env.PGPASSWORD = local.password

  try {
    execFileSync('psql', ['-d', 'postgres', '-c', 'SELECT 1;'], { env, stdio: 'ignore' })
  } catch {
    throw new Error(
      'Cannot reach the local PostgreSQL server.\n' + '  brew services start postgresql@17',
    )
  }

  const exists =
    capture(
      'psql',
      [
        '-d',
        'postgres',
        '-tAc',
        `SELECT 1 FROM pg_database WHERE datname = '${name.replaceAll("'", "''")}';`,
      ],
      env,
    )?.trim() === '1'

  if (exists) {
    console.log(`✅ Database "${name}" already exists`)
    return { created: false, name }
  }

  execFileSync('createdb', [name], { env, stdio: 'inherit' })
  console.log(`✅ Created database "${name}"`)
  return { created: true, name }
}

async function main(): Promise<void> {
  console.log('Mental Health Goals Programme — local setup\n')

  if (!checkTooling()) {
    console.log('')
    console.log('Fix the above and run `pnpm bootstrap` again.')
    process.exit(1)
  }

  console.log('')
  await ensureEnvFile()
  console.log('')
  ensureDatabase()

  const canSync = Boolean(process.env.SYNC_DATABASE_URL)
  const choice = await ask(
    'Where should the content come from?',
    [
      canSync
        ? 'Production — a copy of the live site, minus users and form submissions'
        : 'Production — unavailable: SYNC_DATABASE_URL is not set',
      'The repository — the content committed to this branch',
    ],
    1,
  )

  console.log('')

  if (choice === 0 && !canSync) {
    console.log('SYNC_DATABASE_URL is not set, so there is nothing to sync from.')
    console.log('See scripts/README.md, then run `pnpm sync:db` when you have one.')
    process.exit(1)
  }

  if (choice === 0) {
    runVisibly('pnpm', ['sync:db'])
    runVisibly('pnpm', ['payload', 'migrate'])
    runVisibly('pnpm', ['sync:media'])
  } else {
    runVisibly('pnpm', ['payload', 'migrate'])
    runVisibly('pnpm', ['seed'])
  }

  console.log('')
  console.log('Done. Start the site with:')
  console.log('')
  console.log('  pnpm dev')
  console.log('')
  console.log('  http://localhost:3000        the site')
  console.log('  http://localhost:3000/admin  the CMS')

  if (choice === 0) {
    console.log('')
    console.log('The users table was left empty, so /admin will ask you to create the first')
    console.log('user. That account is local only.')
  }
}

main().catch((error: unknown) => {
  console.error('')
  console.error('❌', error instanceof Error ? error.message : error)
  process.exit(1)
})
