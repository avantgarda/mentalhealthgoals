import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Payload's cloud storage plugin uses _objectKey for new upload paths. Always
// insert its fields in local/CI config too, so migration parity covers Blob.
// A null key and empty prefix preserve existing files' original paths.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" ADD COLUMN "_objectkey" varchar;
    ALTER TABLE "media" ADD COLUMN "prefix" varchar DEFAULT '';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" DROP COLUMN "_objectkey";
    ALTER TABLE "media" DROP COLUMN "prefix";
  `)
}
