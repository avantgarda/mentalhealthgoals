import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The Programme details footer description says "national programme" rather
 * than "UK-wide programme" — the last of the 15 September 2026 wording changes,
 * and the one the content tool could not make because it is a field default,
 * not content. Only the column defaults move, on the global and on its
 * versions table: they matter to a brand-new database alone. Production's own
 * row was edited in the admin on 15 September and is not touched here.
 *
 * Hand-written (the generator is broken on this repo); `pnpm check:migrations`
 * is the proof that it matches the config.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programme_details" ALTER COLUMN "description" SET DEFAULT 'A UK Government-backed, national programme transforming mental health research, delivered by university, NHS, industry and lived experience partners across all four nations.';
   ALTER TABLE "_programme_details_v" ALTER COLUMN "version_description" SET DEFAULT 'A UK Government-backed, national programme transforming mental health research, delivered by university, NHS, industry and lived experience partners across all four nations.';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programme_details" ALTER COLUMN "description" SET DEFAULT 'A UK Government-backed, UK-wide programme transforming mental health research, delivered by university, NHS, industry and lived experience partners across all four nations.';
   ALTER TABLE "_programme_details_v" ALTER COLUMN "version_description" SET DEFAULT 'A UK Government-backed, UK-wide programme transforming mental health research, delivered by university, NHS, industry and lived experience partners across all four nations.';`)
}
