import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Event date and location on posts.
 *
 * A post is an event when it carries a date here — the News & events listing
 * needs to know when the thing happens, not only that it is filed under
 * Events, so that a finished event drops out of "Coming up" on its own.
 * Drafts get the same columns, so an unpublished event previews correctly.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" ADD COLUMN "event_date" timestamp(3) with time zone;
  ALTER TABLE "posts" ADD COLUMN "event_location" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_event_date" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_event_location" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP COLUMN "event_date";
  ALTER TABLE "posts" DROP COLUMN "event_location";
  ALTER TABLE "_posts_v" DROP COLUMN "version_event_date";
  ALTER TABLE "_posts_v" DROP COLUMN "version_event_location";`)
}
