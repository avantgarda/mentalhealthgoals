import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "programme_details" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar DEFAULT 'Mental Health Goals Programme' NOT NULL,
  	"organisation" varchar DEFAULT 'King’s College London',
  	"email" varchar DEFAULT 'hello@mentalhealthgoals.co.uk',
  	"phone" varchar,
  	"address" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "programme_details" CASCADE;`)
}
