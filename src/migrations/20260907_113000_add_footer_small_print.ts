import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Which footer links sit in the small print row beside the copyright.
 *
 * A placement flag rather than a category, so an editor decides where a link
 * goes without the code having to guess from its URL — matching `/privacy`
 * and `/accessibility` by hand would break the moment either one moved.
 *
 * Defaults to false, so every existing row keeps its place in the Site list.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "footer_nav_items" ADD COLUMN "small_print" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "footer_nav_items" DROP COLUMN "small_print";`)
}
