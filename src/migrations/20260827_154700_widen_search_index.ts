import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_search_type" AS ENUM('page', 'workstream', 'post', 'person');
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'delivery';
  ALTER TABLE "search" ADD COLUMN "type" "enum_search_type";
  ALTER TABLE "search" ADD COLUMN "path" varchar;
  ALTER TABLE "search" ADD COLUMN "body" varchar;
  ALTER TABLE "search_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "search_rels" ADD COLUMN "workstreams_id" integer;
  ALTER TABLE "search_rels" ADD COLUMN "people_id" integer;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_workstreams_fk" FOREIGN KEY ("workstreams_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "search_type_idx" ON "search" USING btree ("type");
  CREATE INDEX "search_rels_pages_id_idx" ON "search_rels" USING btree ("pages_id");
  CREATE INDEX "search_rels_workstreams_id_idx" ON "search_rels" USING btree ("workstreams_id");
  CREATE INDEX "search_rels_people_id_idx" ON "search_rels" USING btree ("people_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_pages_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_workstreams_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_people_fk";
  
  DROP INDEX "search_type_idx";
  DROP INDEX "search_rels_pages_id_idx";
  DROP INDEX "search_rels_workstreams_id_idx";
  DROP INDEX "search_rels_people_id_idx";
  ALTER TABLE "people" ALTER COLUMN "group" SET DEFAULT 'collaborators';
  ALTER TABLE "search" DROP COLUMN "type";
  ALTER TABLE "search" DROP COLUMN "path";
  ALTER TABLE "search" DROP COLUMN "body";
  ALTER TABLE "search_rels" DROP COLUMN "pages_id";
  ALTER TABLE "search_rels" DROP COLUMN "workstreams_id";
  ALTER TABLE "search_rels" DROP COLUMN "people_id";
  DROP TYPE "public"."enum_search_type";`)
}
