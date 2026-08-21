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

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
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

  // 4. Content backfill via the Local API — nested arrays are far safer to
  //    write through Payload than by hand-rolled SQL inserts.
  for (const [slug, content] of Object.entries(workstreamContent)) {
    const { docs } = await payload.find({
      collection: 'workstreams',
      where: { slug: { equals: slug } },
      limit: 1,
      req,
    })

    if (!docs.length) continue

    await payload.update({
      collection: 'workstreams',
      id: docs[0].id,
      req,
      context: { disableRevalidate: true },
      data: {
        // Pin the slug: without these two, Payload regenerates it from the
        // title on update ("…-amt") and the URL would differ from the seed's.
        slug,
        generateSlug: false,
        boundaryStatement: content.boundaryStatement,
        primaryFocus: content.primaryFocus.map((point) => ({ point })),
        keyQuestions: content.keyQuestions.map((point) => ({ point })),
        differentiators: content.differentiators.map((point) => ({ point })),
      },
    })
  }

  // 5. Two additional team members (no email field exists on People)
  for (const person of NEW_PEOPLE) {
    const { docs } = await payload.find({
      collection: 'people',
      where: { name: { equals: person.name } },
      limit: 1,
      req,
    })

    if (docs.length) continue

    await payload.create({
      collection: 'people',
      req,
      context: { disableRevalidate: true },
      data: { ...person, organisation: 'King’s College London' },
    })
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
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
