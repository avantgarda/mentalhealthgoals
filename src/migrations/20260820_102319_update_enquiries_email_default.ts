import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programme_details" ALTER COLUMN "email" SET DEFAULT 'enquiries@mentalhealthgoals.co.uk';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programme_details" ALTER COLUMN "email" SET DEFAULT 'hello@mentalhealthgoals.co.uk';`)
}
