/**
 * Seeds the database with the MHGP content. Run with:
 *
 *   pnpm seed
 *
 * Creates the admin user if it does not exist yet (email/password from
 * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env), then runs the full seed.
 * Note: executed via tsx rather than `payload run`, which swallows errors.
 */
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'

import { seed } from './index'

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@mentalhealthgoals.co.uk'
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'changeme'

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
        email: adminEmail,
        password: adminPassword,
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
