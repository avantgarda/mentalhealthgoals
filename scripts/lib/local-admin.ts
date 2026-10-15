/**
 * The local admin account `pnpm local:admin` creates, read from the
 * environment. Kept apart from the script so the rules can be tested without a
 * database.
 */

import { isLocalHostname, parsePostgresConnection } from './postgres-connection'

/**
 * Why `local:admin` must not touch this database, or null when it may. It only
 * ever writes to a Postgres server on this machine: an exported DATABASE_URL
 * beats `.env.local`, so the target is checked rather than trusted.
 */
export function refuseTarget(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return 'DATABASE_URL is not set (check .env.local)'
  const { host } = parsePostgresConnection(databaseUrl)
  if (isLocalHostname(host)) return null
  return `DATABASE_URL points at ${JSON.stringify(host)}, not a database on this machine`
}

export type SeedAdmin = { email: string; password: string }

export type SeedAdminResult = { ok: true; admin: SeedAdmin } | { ok: false; reason: string }

/**
 * `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, or why there is no account to
 * create. Payload stores email addresses in lower case, so this does too — the
 * lookup for an existing account then matches whatever case `.env.local` uses.
 */
export function readSeedAdmin(env: Record<string, string | undefined>): SeedAdminResult {
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const password = env.SEED_ADMIN_PASSWORD ?? ''

  if (!email && !password) {
    return {
      ok: false,
      reason: 'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not set in .env.local',
    }
  }
  if (!email) return { ok: false, reason: 'SEED_ADMIN_EMAIL is not set in .env.local' }
  if (!password) return { ok: false, reason: 'SEED_ADMIN_PASSWORD is not set in .env.local' }
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'SEED_ADMIN_EMAIL is not an email address' }
  }

  return { ok: true, admin: { email, password } }
}
