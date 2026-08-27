import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { workstreamContent } from '../endpoints/seed/workstream-content'

/**
 * Adds the workstream detail fields (slug + boundary statement + three bullet
 * lists) and backfills the six existing workstreams with the content compiled
 * in MHG_boundary_positions1.xlsx, plus two new team members.
 *
 * `slug` is added nullable, backfilled, and only then constrained — adding a
 * NOT NULL column outright fails on a table that already has rows.
 */

const SLUGS: Record<string, string> = {
  'Alliance Management Team (AMT)': 'alliance-management-team',
  'Innovative Trials Hub (ITH)': 'innovative-trials-hub',
  'Lived Experience Industry Partnership (LEIP)': 'lived-experience-industry-partnership',
  'Digital Innovation': 'digital-innovation',
  'Data Observatory': 'data-observatory',
  'Multi-omics': 'multi-omics',
}

const NEW_PEOPLE = [
  { order: 7, name: 'Eoin Gogarty', role: 'Database Lead, AMT' },
  { order: 8, name: 'Sidharth Sanjeev', role: 'Research Assistant, AMT' },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Schema — slug deliberately nullable at this point
  await db.execute(sql`
   CREATE TABLE "workstreams_primary_focus" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar NOT NULL
  );

  CREATE TABLE "workstreams_key_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar NOT NULL
  );

  CREATE TABLE "workstreams_differentiators" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar NOT NULL
  );

  ALTER TABLE "workstreams" ADD COLUMN "boundary_statement" varchar;
  ALTER TABLE "workstreams" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "workstreams" ADD COLUMN "slug" varchar;
  ALTER TABLE "workstreams_primary_focus" ADD CONSTRAINT "workstreams_primary_focus_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workstreams_key_questions" ADD CONSTRAINT "workstreams_key_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workstreams_differentiators" ADD CONSTRAINT "workstreams_differentiators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "workstreams_primary_focus_order_idx" ON "workstreams_primary_focus" USING btree ("_order");
  CREATE INDEX "workstreams_primary_focus_parent_id_idx" ON "workstreams_primary_focus" USING btree ("_parent_id");
  CREATE INDEX "workstreams_key_questions_order_idx" ON "workstreams_key_questions" USING btree ("_order");
  CREATE INDEX "workstreams_key_questions_parent_id_idx" ON "workstreams_key_questions" USING btree ("_parent_id");
  CREATE INDEX "workstreams_differentiators_order_idx" ON "workstreams_differentiators" USING btree ("_order");
  CREATE INDEX "workstreams_differentiators_parent_id_idx" ON "workstreams_differentiators" USING btree ("_parent_id");`)

  // 2. Backfill slugs for the known titles, then anything unexpected from its
  //    own title, so no row can be left null before the constraint goes on.
  for (const [title, slug] of Object.entries(SLUGS)) {
    await db.execute(
      sql`UPDATE "workstreams" SET "slug" = ${slug} WHERE "title" = ${title} AND "slug" IS NULL;`,
    )
  }
  await db.execute(sql`
    UPDATE "workstreams"
    SET "slug" = trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'))
    WHERE "slug" IS NULL;`)

  // 3. Now the column can be constrained
  await db.execute(sql`
    ALTER TABLE "workstreams" ALTER COLUMN "slug" SET NOT NULL;
    CREATE UNIQUE INDEX "workstreams_slug_idx" ON "workstreams" USING btree ("slug");`)

  // 4. Content backfill in raw SQL. This originally went through the Payload
  //    Local API, but the Local API queries against the *current* config — so
  //    any array field added by a LATER migration (e.g. `resources`) makes
  //    this step select a table that does not exist yet on a fresh database.
  //    Raw SQL keeps the migration valid forever. On a fresh (empty) database
  //    the SELECT finds nothing and every step is a no-op, which is correct:
  //    the seed provides the content there.
  const lists = [
    ['workstreams_primary_focus', 'primaryFocus'],
    ['workstreams_key_questions', 'keyQuestions'],
    ['workstreams_differentiators', 'differentiators'],
  ] as const

  for (const [slug, content] of Object.entries(workstreamContent)) {
    const found = (await db.execute(
      sql`SELECT "id" FROM "workstreams" WHERE "slug" = ${slug} LIMIT 1;`,
    )) as unknown as { rows: { id: number }[] }
    if (!found.rows.length) continue
    const parentId = found.rows[0].id

    await db.execute(
      sql`UPDATE "workstreams" SET "boundary_statement" = ${content.boundaryStatement}, "generate_slug" = false WHERE "id" = ${parentId};`,
    )

    for (const [table, key] of lists) {
      await db.execute(
        sql`DELETE FROM ${sql.raw(`"${table}"`)} WHERE "_parent_id" = ${parentId};`,
      )
      for (const [index, point] of content[key].entries()) {
        await db.execute(
          sql`INSERT INTO ${sql.raw(`"${table}"`)} ("_order", "_parent_id", "id", "point")
              VALUES (${index + 1}, ${parentId}, gen_random_uuid()::text, ${point});`,
        )
      }
    }
  }

  // 5. Two additional team members (no email field exists on People) — raw
  //    SQL for the same future-proofing reason as above.
  for (const person of NEW_PEOPLE) {
    const existing = (await db.execute(
      sql`SELECT "id" FROM "people" WHERE "name" = ${person.name} LIMIT 1;`,
    )) as unknown as { rows: { id: number }[] }
    if (existing.rows.length) continue

    await db.execute(
      sql`INSERT INTO "people" ("name", "role", "organisation", "order", "updated_at", "created_at")
          VALUES (${person.name}, ${person.role}, ${'King’s College London'}, ${person.order}, now(), now());`,
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "workstreams_primary_focus" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "workstreams_key_questions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "workstreams_differentiators" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "workstreams_primary_focus" CASCADE;
  DROP TABLE "workstreams_key_questions" CASCADE;
  DROP TABLE "workstreams_differentiators" CASCADE;
  DROP INDEX "workstreams_slug_idx";
  ALTER TABLE "workstreams" DROP COLUMN "boundary_statement";
  ALTER TABLE "workstreams" DROP COLUMN "generate_slug";
  ALTER TABLE "workstreams" DROP COLUMN "slug";`)
}
