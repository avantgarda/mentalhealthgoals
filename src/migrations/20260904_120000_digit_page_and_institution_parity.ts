import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two parity changes to the schema.
 *
 * 1. `programme_details.organisation` ("Lead organisation", defaulting to
 *    King's College London) is replaced by `description` — the footer's own
 *    sentence, now editable. The old column asserted a lead organisation in
 *    the admin and in the database while rendering nowhere; the programme is
 *    delivered by nine institutions. Existing rows are backfilled with the
 *    same default the config carries, so a deployed site's footer reads
 *    correctly the moment this runs, before any reseed.
 *
 * 2. `enum_people_group` loses 'digit'. The Team page's DIGIT section sat
 *    above "Workstream leads" and split the six workstreams into two classes;
 *    those people are workstream leads. Values are remapped while the column
 *    is text — recasting straight to the new enum would fail on rows still
 *    holding 'digit' (same shape as 20260827_083749_team_workstream_leads_group).
 *
 * Raw SQL only: the Local API queries the current config, which no longer has
 * these values (see the note in 20260821_084454_add_workstream_detail_fields).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programme_details" ADD COLUMN "description" varchar DEFAULT 'A UK Government-backed, UK-wide programme transforming mental health research, delivered by university, NHS, industry and lived experience partners across all four nations.';
  UPDATE "programme_details" SET "description" = 'A UK Government-backed, UK-wide programme transforming mental health research, delivered by university, NHS, industry and lived experience partners across all four nations.' WHERE "description" IS NULL;
  ALTER TABLE "programme_details" DROP COLUMN "organisation";
  ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE text;
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'delivery'::text;
  UPDATE "people" SET "group" = 'workstream-leads' WHERE "group" = 'digit';
  DROP TYPE "public"."enum_people_group";
  CREATE TYPE "public"."enum_people_group" AS ENUM('leadership', 'workstream-leads', 'delivery');
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'delivery'::"public"."enum_people_group";
  ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE "public"."enum_people_group" USING "group"::"public"."enum_people_group";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programme_details" ADD COLUMN "organisation" varchar DEFAULT 'King’s College London';
  ALTER TABLE "programme_details" DROP COLUMN "description";
  ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE text;
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'delivery'::text;
  DROP TYPE "public"."enum_people_group";
  CREATE TYPE "public"."enum_people_group" AS ENUM('leadership', 'digit', 'workstream-leads', 'delivery');
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'delivery'::"public"."enum_people_group";
  ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE "public"."enum_people_group" USING "group"::"public"."enum_people_group";`)
}
