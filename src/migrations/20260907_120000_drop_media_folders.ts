import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drops the folders feature from Media.
 *
 * It was enabled and never used — not one folder was ever created — and it
 * cannot work with this content model: the seed deletes `media` but not
 * `payload-folders`, so anything an editor filed would return after the next
 * seed as empty folders with every image loose again.
 *
 * `media.folder_id` goes first: it is the foreign key into the folder tables,
 * so nothing can be dropped while it is still pointing at them. The feature
 * also reaches beyond its own tables — a relation on `payload_locked_documents`
 * and its own enum type — and leaving either behind is drift the schema check
 * catches.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN IF EXISTS "folder_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_folders_id";
  DROP TABLE IF EXISTS "payload_folders_folder_type" CASCADE;
  DROP TABLE IF EXISTS "payload_folders" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_payload_folders_folder_type";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "payload_folders" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "folder_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "payload_folders_folder_type" (
    "order" integer NOT NULL,
    "parent_id" integer NOT NULL,
    "value" varchar,
    "id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "media" ADD COLUMN "folder_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_folders_id" integer;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payload_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_folders_id");
  CREATE TYPE "public"."enum_payload_folders_folder_type" AS ENUM('media');`)
}
