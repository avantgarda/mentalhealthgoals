/**
 * Seeds the database with the MHGP content. Run with:
 *
 *   pnpm seed
 *
 * Creates the admin user if it does not exist yet (email/password from
 * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env), then runs the full seed.
 * Note: executed via tsx rather than `payload run`, which swallows errors.
 *
 * Guardrails: refuses to run without explicit seed credentials, and refuses
 * to run against a non-local database (this script runs in dev mode, which
 * would push schema changes outside migrations). Seed a deployed site from
 * the admin dashboard's Seed button instead.
 */
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'

import { seed } from './index'

const adminEmail = process.env.SEED_ADMIN_EMAIL
const adminPassword = process.env.SEED_ADMIN_PASSWORD

if (!adminEmail || !adminPassword) {
  console.error(
    'Refusing to seed: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env first.\n' +
      'There are no defaults — this prevents accidentally creating a weak admin account.',
  )
  process.exit(1)
}

const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL).hostname
  } catch {
    return ''
  }
})()

const isLocalDb = ['localhost', '127.0.0.1', '::1'].includes(dbHost)

if (!isLocalDb && !process.argv.includes('--allow-remote')) {
  console.error(
    `Refusing to seed: DATABASE_URL points at a non-local database (${dbHost || 'unparseable'}).\n` +
      'Seed a deployed site from the admin dashboard’s Seed button instead — this script\n' +
      'runs in development mode, which push-syncs the schema outside migrations.\n' +
      'If you really mean it, re-run with --allow-remote.',
  )
  process.exit(1)
}

async function run() {
  const payload = await getPayload({ config })

  let admin = (
    await payload.find({
      collection: 'users',
      where: { email: { equals: adminEmail } },
      limit: 1,
    })
  ).docs[0]

  if (!admin) {
    payload.logger.info(`— Creating admin user ${adminEmail}...`)
    admin = await payload.create({
      collection: 'users',
      data: {
        name: 'MHGP Admin',
        email: adminEmail!,
        password: adminPassword,
        role: 'admin',
      },
    })
  }

  const req = await createLocalReq({ user: admin }, payload)
  await seed({ payload, req })

  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
