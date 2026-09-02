import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "workstreams_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"partners_id" integer
  );
  
  ALTER TABLE "workstreams_rels" ADD CONSTRAINT "workstreams_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workstreams_rels" ADD CONSTRAINT "workstreams_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "workstreams_rels_order_idx" ON "workstreams_rels" USING btree ("order");
  CREATE INDEX "workstreams_rels_parent_idx" ON "workstreams_rels" USING btree ("parent_id");
  CREATE INDEX "workstreams_rels_path_idx" ON "workstreams_rels" USING btree ("path");
  CREATE INDEX "workstreams_rels_partners_id_idx" ON "workstreams_rels" USING btree ("partners_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "workstreams_rels" CASCADE;`)
}
