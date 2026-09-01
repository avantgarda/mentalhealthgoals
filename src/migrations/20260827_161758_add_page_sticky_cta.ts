import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" ADD COLUMN "sticky_cta_enabled" boolean;
  ALTER TABLE "pages" ADD COLUMN "sticky_cta_message" varchar;
  ALTER TABLE "pages" ADD COLUMN "sticky_cta_label" varchar;
  ALTER TABLE "pages" ADD COLUMN "sticky_cta_href" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_sticky_cta_enabled" boolean;
  ALTER TABLE "_pages_v" ADD COLUMN "version_sticky_cta_message" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_sticky_cta_label" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_sticky_cta_href" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" DROP COLUMN "sticky_cta_enabled";
  ALTER TABLE "pages" DROP COLUMN "sticky_cta_message";
  ALTER TABLE "pages" DROP COLUMN "sticky_cta_label";
  ALTER TABLE "pages" DROP COLUMN "sticky_cta_href";
  ALTER TABLE "_pages_v" DROP COLUMN "version_sticky_cta_enabled";
  ALTER TABLE "_pages_v" DROP COLUMN "version_sticky_cta_message";
  ALTER TABLE "_pages_v" DROP COLUMN "version_sticky_cta_label";
  ALTER TABLE "_pages_v" DROP COLUMN "version_sticky_cta_href";`)
}
