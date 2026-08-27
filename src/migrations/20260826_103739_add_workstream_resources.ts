import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "workstreams_resources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  ALTER TABLE "workstreams_resources" ADD CONSTRAINT "workstreams_resources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "workstreams_resources_order_idx" ON "workstreams_resources" USING btree ("_order");
  CREATE INDEX "workstreams_resources_parent_id_idx" ON "workstreams_resources" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "workstreams_resources" CASCADE;`)
}
