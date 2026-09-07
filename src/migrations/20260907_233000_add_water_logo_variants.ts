import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two more logo options for the Brand global: the acronym mark
 * ("Written in Water") and the reflected-G mark ("Goal in the Water").
 *
 * Only the enum grows; the column, its default and every existing row are
 * untouched. `IF NOT EXISTS` keeps this idempotent on development databases
 * where Drizzle push has already added the values.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_brand_logo_variant" ADD VALUE IF NOT EXISTS 'writtenInWater';
   ALTER TYPE "public"."enum_brand_logo_variant" ADD VALUE IF NOT EXISTS 'goalInWater';`)
}

/**
 * Postgres cannot remove a value from an enum, so rolling back rebuilds the
 * type. Any row using one of the new marks falls back to the default first so
 * the cast cannot fail.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "brand" SET "logo_variant" = 'summit'
     WHERE "logo_variant" IN ('writtenInWater', 'goalInWater');
   ALTER TYPE "public"."enum_brand_logo_variant" RENAME TO "enum_brand_logo_variant_old";
   CREATE TYPE "public"."enum_brand_logo_variant" AS ENUM('summit', 'sunInCol', 'rings');
   ALTER TABLE "brand" ALTER COLUMN "logo_variant" DROP DEFAULT;
   ALTER TABLE "brand" ALTER COLUMN "logo_variant"
     TYPE "public"."enum_brand_logo_variant"
     USING "logo_variant"::text::"public"."enum_brand_logo_variant";
   ALTER TABLE "brand" ALTER COLUMN "logo_variant" SET DEFAULT 'summit';
   DROP TYPE "public"."enum_brand_logo_variant_old";`)
}
