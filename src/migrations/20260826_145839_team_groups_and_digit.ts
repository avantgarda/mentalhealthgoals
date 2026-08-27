import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Team grouping and the DIGIT umbrella:
 *  - people.group  — which section of the Team page a person appears under
 *  - people.profile_url — institutional profile the name links to
 *  - people_rels   — people ↔ workstreams, so each workstream page can list
 *                    its own people and the Team page can label leads
 *  - workstreams.group — 'digit' brackets AMT/ITH/LEIP in the index
 *
 * Pure schema: existing rows take the 'collaborators' default and the seed
 * assigns real groups. No Local API calls here — those break on fresh
 * databases once later migrations add fields (see the hardening note in
 * 20260821_084454_add_workstream_detail_fields).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_workstreams_group" AS ENUM('digit');
  CREATE TYPE "public"."enum_people_group" AS ENUM('leadership', 'workstream-leads', 'alliance-team', 'collaborators');
  CREATE TABLE "people_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"workstreams_id" integer
  );
  
  ALTER TABLE "workstreams" ADD COLUMN "group" "enum_workstreams_group";
  ALTER TABLE "people" ADD COLUMN "profile_url" varchar;
  ALTER TABLE "people" ADD COLUMN "group" "enum_people_group" DEFAULT 'collaborators' NOT NULL;
  ALTER TABLE "people_rels" ADD CONSTRAINT "people_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "people_rels" ADD CONSTRAINT "people_rels_workstreams_fk" FOREIGN KEY ("workstreams_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "people_rels_order_idx" ON "people_rels" USING btree ("order");
  CREATE INDEX "people_rels_parent_idx" ON "people_rels" USING btree ("parent_id");
  CREATE INDEX "people_rels_path_idx" ON "people_rels" USING btree ("path");
  CREATE INDEX "people_rels_workstreams_id_idx" ON "people_rels" USING btree ("workstreams_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "people_rels" CASCADE;
  ALTER TABLE "workstreams" DROP COLUMN "group";
  ALTER TABLE "people" DROP COLUMN "profile_url";
  ALTER TABLE "people" DROP COLUMN "group";
  DROP TYPE "public"."enum_workstreams_group";
  DROP TYPE "public"."enum_people_group";`)
}
