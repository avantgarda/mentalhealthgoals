import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brand_logo_variant" AS ENUM('summit', 'sunInCol', 'rings');
  CREATE TABLE "brand" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"logo_variant" "enum_brand_logo_variant" DEFAULT 'summit' NOT NULL,
  	"show_tagline" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "brand" CASCADE;
  DROP TYPE "public"."enum_brand_logo_variant";`)
}
