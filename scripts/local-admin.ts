/**
 * Make sure the local database has an admin account you can log in with.
 *
 * `pnpm sync:db` leaves production's users behind on purpose — a laptop has no
 * business holding editors' password hashes — so a fresh copy has no account at
 * all. This creates one from SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in
 * `.env.local`, through Payload so the password is hashed exactly as the admin
 * would hash it. `sync:db` runs it after every restore; run it by hand after
 * `pnpm payload migrate` if that step reported a problem.
 *
 * It only ever writes to a database on this machine, and an account that
 * already exists is left exactly as it is. The password is never printed.
 *
 *   pnpm local:admin
 */

import { getPayload } from 'payload'

import config from '@payload-config'

import { readSeedAdmin, refuseTarget } from './lib/local-admin'

/** `sync:db` passes this: a missing setting is a hint there, not a failure. */
const afterSync = process.argv.includes('--after-sync')

async function main(): Promise<number> {
  const refusal = refuseTarget(process.env.DATABASE_URL)
  if (refusal) {
    console.error(`❌ Refusing to create a local admin: ${refusal}.`)
    return 1
  }

  const seed = readSeedAdmin(process.env)
  if (!seed.ok) {
    console.log(`ℹ️  No local admin created: ${seed.reason}.`)
    console.log('   Set both to have one created automatically; until then /admin offers to')
    console.log('   create the first user. Use a password that is not a production login.')
    return afterSync ? 0 : 1
  }
  const { email, password } = seed.admin

  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    console.log(`✅ Local admin ${email} already exists — left unchanged.`)
    return 0
  }

  await payload.create({
    collection: 'users',
    data: { email, password, name: 'Local admin', role: 'admin' },
    overrideAccess: true,
  })
  console.log(`✅ Created local admin ${email} (password: SEED_ADMIN_PASSWORD in .env.local).`)
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(
      '❌ Could not create the local admin:',
      error instanceof Error ? error.message : error,
    )
    console.error(
      '   If this branch has migrations production does not, run `pnpm payload migrate`',
    )
    console.error('   first, then `pnpm local:admin`.')
    process.exit(1)
  })
