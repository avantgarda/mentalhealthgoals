import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_partners_role" AS ENUM('funder', 'delivery', 'partner');
  CREATE TABLE "pages_blocks_partner_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_partner_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "partners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"strapline" varchar,
  	"url" varchar,
  	"role" "enum_partners_role" DEFAULT 'partner' NOT NULL,
  	"logo_id" integer,
  	"show_name_with_logo" boolean DEFAULT false,
  	"logo_scale" numeric DEFAULT 1,
  	"show_in_footer" boolean DEFAULT false,
  	"order" numeric DEFAULT 0,
  	"usage_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pages_rels" ADD COLUMN "partners_id" integer;
  ALTER TABLE "_pages_v_rels" ADD COLUMN "partners_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "partners_id" integer;
  ALTER TABLE "pages_blocks_partner_logos" ADD CONSTRAINT "pages_blocks_partner_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_partner_logos" ADD CONSTRAINT "_pages_v_blocks_partner_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_blocks_partner_logos_order_idx" ON "pages_blocks_partner_logos" USING btree ("_order");
  CREATE INDEX "pages_blocks_partner_logos_parent_id_idx" ON "pages_blocks_partner_logos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_partner_logos_path_idx" ON "pages_blocks_partner_logos" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_partner_logos_order_idx" ON "_pages_v_blocks_partner_logos" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_partner_logos_parent_id_idx" ON "_pages_v_blocks_partner_logos" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_partner_logos_path_idx" ON "_pages_v_blocks_partner_logos" USING btree ("_path");
  CREATE INDEX "partners_logo_idx" ON "partners" USING btree ("logo_id");
  CREATE INDEX "partners_updated_at_idx" ON "partners" USING btree ("updated_at");
  CREATE INDEX "partners_created_at_idx" ON "partners" USING btree ("created_at");
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_rels_partners_id_idx" ON "pages_rels" USING btree ("partners_id");
  CREATE INDEX "_pages_v_rels_partners_id_idx" ON "_pages_v_rels" USING btree ("partners_id");
  CREATE INDEX "payload_locked_documents_rels_partners_id_idx" ON "payload_locked_documents_rels" USING btree ("partners_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_partner_logos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_partner_logos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partners" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_partner_logos" CASCADE;
  DROP TABLE "_pages_v_blocks_partner_logos" CASCADE;
  DROP TABLE "partners" CASCADE;
  ALTER TABLE "pages_rels" DROP CONSTRAINT "pages_rels_partners_fk";
  
  ALTER TABLE "_pages_v_rels" DROP CONSTRAINT "_pages_v_rels_partners_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_partners_fk";
  
  DROP INDEX "pages_rels_partners_id_idx";
  DROP INDEX "_pages_v_rels_partners_id_idx";
  DROP INDEX "payload_locked_documents_rels_partners_id_idx";
  ALTER TABLE "pages_rels" DROP COLUMN "partners_id";
  ALTER TABLE "_pages_v_rels" DROP COLUMN "partners_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "partners_id";
  DROP TYPE "public"."enum_partners_role";`)
}
