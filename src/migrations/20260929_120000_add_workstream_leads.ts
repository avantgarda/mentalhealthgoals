import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Each workstream names its own leads. Until now a workstream page listed
 * everyone linked to the workstream under “Who leads this workstream”, so
 * delivery staff were presented as leads, and a person's Team-page section
 * could not say “lead here, not there”.
 *
 * The new `leads` relationship lives in the workstreams' existing rels tables.
 * It starts out as the closest thing the old data held: the people linked to
 * the workstream whose Team-page section is Programme leadership or Workstream
 * leads — so a page shows no one new, and drops only the delivery staff it
 * should never have called leads. Every row comes from the database's own
 * people, never from the repository; on a fresh database there is nothing to
 * copy. Editors adjust each workstream's list in the admin from then on.
 *
 * Hand-written (the generator is broken on this repo); `pnpm check:migrations`
 * is the proof that it matches the config.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "workstreams_rels" ADD COLUMN "people_id" integer;
   ALTER TABLE "_workstreams_v_rels" ADD COLUMN "people_id" integer;
   ALTER TABLE "workstreams_rels" ADD CONSTRAINT "workstreams_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "_workstreams_v_rels" ADD CONSTRAINT "_workstreams_v_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "workstreams_rels_people_id_idx" ON "workstreams_rels" USING btree ("people_id");
   CREATE INDEX "_workstreams_v_rels_people_id_idx" ON "_workstreams_v_rels" USING btree ("people_id");

   INSERT INTO "workstreams_rels" ("order", "parent_id", "path", "people_id")
   SELECT
     row_number() OVER (PARTITION BY r."workstreams_id" ORDER BY p."order", p."id"),
     r."workstreams_id",
     'leads',
     p."id"
   FROM "people_rels" r
   JOIN "people" p ON p."id" = r."parent_id"
   WHERE r."path" = 'workstreams'
     AND r."workstreams_id" IS NOT NULL
     AND p."group" IN ('leadership', 'workstream-leads');`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "workstreams_rels" WHERE "people_id" IS NOT NULL;
   DELETE FROM "_workstreams_v_rels" WHERE "people_id" IS NOT NULL;
   ALTER TABLE "workstreams_rels" DROP CONSTRAINT "workstreams_rels_people_fk";
   ALTER TABLE "_workstreams_v_rels" DROP CONSTRAINT "_workstreams_v_rels_people_fk";
   DROP INDEX "workstreams_rels_people_id_idx";
   DROP INDEX "_workstreams_v_rels_people_id_idx";
   ALTER TABLE "workstreams_rels" DROP COLUMN "people_id";
   ALTER TABLE "_workstreams_v_rels" DROP COLUMN "people_id";`)
}
