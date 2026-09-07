/** Hostnames that mean "the Postgres server on this machine". */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', ''])

export function isLocalHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname)
}

/**
 * Pin TLS verification on a Postgres connection string.
 *
 * Neon hands out connection strings ending `?sslmode=require`. node-postgres
 * currently treats `require` as an alias for `verify-full`, so today's
 * connections do verify the certificate chain — but pg v9 will adopt libpq
 * semantics, where `require` means "encrypt without verifying" and is open to
 * interception. Nothing in this repository would change on that upgrade; the
 * meaning of the string would, silently.
 *
 * Asking for `verify-full` explicitly pins the behaviour we already rely on.
 */
export function withVerifiedSSL(connectionString: string): string {
  const url = new URL(connectionString)

  // A local database is reached over a loopback socket with no TLS at all;
  // forcing verify-full there would break `pnpm sync:media`, which reads the
  // local database to find out which files it needs.
  if (isLocalHostname(url.hostname)) return connectionString

  url.searchParams.set('sslmode', 'verify-full')
  return url.href
}

export type PostgresConnectionParts = {
  user: string
  password: string
  host: string
  port: string
  database: string
  sslmode: string
}

/**
 * Decompose a connection string into the parts `pg_dump`, `psql` and `createdb`
 * need as PG* environment variables. Separate from {@link withVerifiedSSL}:
 * that hands a string to node-postgres, this hands components to command-line
 * tools.
 */
export function parsePostgresConnection(connectionString: string): PostgresConnectionParts {
  try {
    const url = new URL(connectionString)

    return {
      database: decodeURIComponent(url.pathname.slice(1)),
      host: url.hostname,
      password: decodeURIComponent(url.password),
      port: url.port || '5432',
      sslmode: url.searchParams.get('sslmode') || 'require',
      user: decodeURIComponent(url.username),
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Invalid connection string format: ${detail}`)
  }
}

/**
 * Refuse a target that is not the local Postgres server.
 *
 * `sync:db` drops and recreates whatever `DATABASE_URL` names. That value comes
 * from `.env.local`, but an exported shell variable takes precedence over the
 * file — so a stray `DATABASE_URL` in the environment could otherwise redirect
 * the drop at a remote database. This makes the localhost assumption explicit
 * rather than leaving it implied by the file the value usually comes from.
 */
export function assertLocalDatabase(connectionString: string, what: string): void {
  const { host } = parsePostgresConnection(connectionString)

  if (!isLocalHostname(host)) {
    throw new Error(
      `Refusing to ${what}: DATABASE_URL points at ${JSON.stringify(host)}, not a local database.\n` +
        'This command drops and recreates its target, so it only ever runs against localhost.\n' +
        'Check DATABASE_URL in .env.local, and check it is not overridden by an exported shell variable.',
    )
  }
}
