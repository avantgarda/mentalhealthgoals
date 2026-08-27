import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Team groupings corrected against the DIGIT grant application (APP97536) and
 * the programme contacts workbook: DIGIT is the funded project that delivers
 * the Alliance Management Team, Innovative Clinical Trials Hub and Lived
 * Experience Industry Partnership, so its lead and co-leads are their own
 * section rather than "workstream leads".
 *
 * The old values are remapped while the column is text — recasting straight to
 * the new enum would fail on any row still holding 'workstream-leads' or
 * 'alliance-team'.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE text;
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'collaborators'::text;
  UPDATE "people" SET "group" = 'digit' WHERE "group" = 'workstream-leads';
  UPDATE "people" SET "group" = 'delivery' WHERE "group" = 'alliance-team';
  DROP TYPE "public"."enum_people_group";
  CREATE TYPE "public"."enum_people_group" AS ENUM('leadership', 'digit', 'delivery', 'collaborators');
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'collaborators'::"public"."enum_people_group";
  ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE "public"."enum_people_group" USING "group"::"public"."enum_people_group";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE text;
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'collaborators'::text;
  UPDATE "people" SET "group" = 'workstream-leads' WHERE "group" = 'digit';
  UPDATE "people" SET "group" = 'alliance-team' WHERE "group" = 'delivery';
  DROP TYPE "public"."enum_people_group";
  CREATE TYPE "public"."enum_people_group" AS ENUM('leadership', 'workstream-leads', 'alliance-team', 'collaborators');
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'collaborators'::"public"."enum_people_group";
  ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE "public"."enum_people_group" USING "group"::"public"."enum_people_group";`)
}
