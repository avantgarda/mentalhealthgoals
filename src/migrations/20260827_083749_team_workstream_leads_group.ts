import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * People who lead the cohort, data and digital workstreams are workstream
 * leads, not external collaborators — the previous 'collaborators' section
 * wrongly demoted them (see the IEF agenda's seven workstream-lead slots).
 * The default for new people becomes 'delivery'.
 *
 * Values are remapped while the column is text; recasting straight to the new
 * enum would fail on rows still holding 'collaborators'. Raw SQL only — no
 * Local API (see the note in 20260821_084454_add_workstream_detail_fields).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE text;
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'delivery'::text;
  UPDATE "people" SET "group" = 'workstream-leads' WHERE "group" = 'collaborators';
  DROP TYPE "public"."enum_people_group";
  CREATE TYPE "public"."enum_people_group" AS ENUM('leadership', 'digit', 'workstream-leads', 'delivery');
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'delivery'::"public"."enum_people_group";
  ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE "public"."enum_people_group" USING "group"::"public"."enum_people_group";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE text;
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'collaborators'::text;
  UPDATE "people" SET "group" = 'collaborators' WHERE "group" = 'workstream-leads';
  DROP TYPE "public"."enum_people_group";
  CREATE TYPE "public"."enum_people_group" AS ENUM('leadership', 'digit', 'delivery', 'collaborators');
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'collaborators'::"public"."enum_people_group";
  ALTER TABLE "people" ALTER COLUMN "group" SET DATA TYPE "public"."enum_people_group" USING "group"::"public"."enum_people_group";`)
}
