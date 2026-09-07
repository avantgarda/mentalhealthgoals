/**
 * Initializes Payload against DATABASE_URL with PAYLOAD_DB_PUSH=1 so the
 * Postgres adapter push-syncs the schema, then exits. Used only by
 * scripts/check-migrations.sh to build the "what the config produces" schema
 * that the committed migrations are diffed against.
 *
 * That flag is the only thing that turns push on anywhere — see the comment on
 * `db.push` in src/payload.config.ts. Running this by hand against a database
 * you care about will reshape it.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
await payload.db.destroy?.()
process.exit(0)
