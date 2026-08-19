/**
 * Initializes Payload against DATABASE_URL with NODE_ENV=development so the
 * Postgres adapter push-syncs the schema, then exits. Used only by
 * scripts/check-migrations.sh to build the "what dev push produces" schema.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
await payload.db.destroy?.()
process.exit(0)
