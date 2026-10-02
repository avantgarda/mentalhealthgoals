import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Payload 3.90 adds this nullable auth field to throttle password-reset requests.
// The repository's generator snapshot predates hand-written migrations, so
// keep this upgrade to the one schema change and verify with check:migrations.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN "reset_password_requested_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN "reset_password_requested_at";`)
}
