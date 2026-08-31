# Mental Health Goals Programme — mentalhealthgoals.co.uk

The public website for the **Mental Health Goals Programme (MHGP)** — a £50M UK Government-backed
national programme transforming mental health research. Built with [Next.js](https://nextjs.org)
and [Payload CMS](https://payloadcms.com) (based on the official Payload website template),
designed for deployment on Vercel.

## Stack

- **Next.js 16** (App Router) + **Payload 3** in a single app — the CMS admin lives at `/admin`
- **PostgreSQL** via `@payloadcms/db-postgres` (local Postgres in dev, Neon/Vercel Postgres in production)
- **Tailwind CSS 4** with a custom MHGP design system (Fraunces display + Inter body, petrol/amber palette)
- Payload plugins: SEO, redirects, form builder, search, nested docs; Vercel Blob storage for media in production

## Local development

Requirements: Node 20+, pnpm, and a local PostgreSQL server.

```bash
# 1. Install dependencies
pnpm install

# 2. Create the database (first time only)
createdb mentalhealthgoals

# 3. Configure environment — copy .env.example and fill in values
#    DATABASE_URL=postgresql://<user>@localhost:5432/mentalhealthgoals
#    PAYLOAD_SECRET=<any long random string>
#    NEXT_PUBLIC_SERVER_URL=http://localhost:3000
#    SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD=<your admin login — required by the seed>

# 4. Seed the database with the starter MHGP content
pnpm seed

# 5. Run the dev server
pnpm dev
```

The site runs at [http://localhost:3000](http://localhost:3000) and the admin panel at
[http://localhost:3000/admin](http://localhost:3000/admin).

### Seeding

`pnpm seed` **replaces all content** with the starter MHGP content: 10 pages, 6 workstreams,
the leadership team, two news posts, the contact form, and header/footer navigation. It also
creates the admin user (email/password from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env` —
required, there are no defaults) if it doesn't already exist. The same seed can be run from the
admin dashboard's "Seed" button (admins only).

The script refuses to run against a non-local database — seed a deployed site from the
dashboard's Seed button instead (see Deploying below).

In development the database schema is kept in sync automatically (Drizzle push mode). Production
uses the committed migrations in `src/migrations`.

### Users & roles

Users have a **role**: `admin` (manage users, run the seed) or `editor` (manage content only).
The first account ever created is automatically an admin; accounts created after that default to
editor unless an admin grants the admin role.

### Email

Payload sends email (password resets, contact-form notifications) through
[Resend](https://resend.com) when `RESEND_API_KEY` is set; without it, emails are written to the
server console — fine for dev, not for production. The `mentalhealthgoals.co.uk` domain must be
verified in Resend (DNS records) before mail will send from it. The seeded contact form notifies
`enquiries@mentalhealthgoals.co.uk` — **confirm the team inbox address before go-live**.

Scheduled publishing is disabled: on Vercel nothing runs Payload's jobs queue, so scheduled
publishes would silently never fire. To enable it, add a `vercel.json` cron hitting
`/api/payload-jobs/run` (Vercel Pro for minute-level schedules), set `schedulePublish: true` on
Pages/Posts, and create the migration it asks for.

## Content model

| Type                | What it's for                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pages**           | Layout-builder pages (hero + blocks). Home, About, Workstreams, For industry, Patients & public, People, Industry Engagement Forum, Contact, Accessibility statement, Privacy notice |
| **Posts**           | News & events, listed at `/posts`                                                                                                                                                    |
| **Workstreams**     | The six national workstreams — edit these and the workstream grids update everywhere                                                                                                 |
| **People**          | Leadership team cards, ordered by the `order` field                                                                                                                                  |
| **Media**           | Uploads (local `public/media` in dev, Vercel Blob in production)                                                                                                                     |
| **Header / Footer** | Navigation globals                                                                                                                                                                   |
| **Brand & Logo**    | Global controlling which logo mark the whole site uses                                                                                                                               |

Custom blocks available in the page layout builder: **Stats** (big-number tiles),
**Workstreams** (cards or detailed list), **People** (team grid), **Event Details**
(facts / agenda / outcomes — used on the Industry Engagement Forum page), plus the template's
Content, Call to Action, Media, Archive and Form blocks.

## Branding & the logo

The site ships with three logo marks and a Payload global that decides which one
is in use. Change it in the admin under **Globals → Brand & Logo**; the header,
footer, browser tab icon, app icons and social sharing card all follow the same
setting, and the field shows a live preview of each option.

| Variant              | Mark                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| `summit` _(default)_ | **Summit M** — rising peaks forming an M, amber goal above the summit              |
| `sunInCol`           | **Sun in the Col** — the same mountain with round shoulders, holding the amber sun |
| `rings`              | **Concentric Rings** — the original launch mark                                    |

Geometry lives in `src/brand/marks.ts` and colours in `src/brand/tokens.ts`.
That module is the single source of truth: the React components in
`src/components/Logo` and the exported files are both generated from it, so they
cannot drift apart. The ridge motif works the same way — `src/brand/ridge.ts`
feeds both `src/components/Ridge` on the page and the placeholder imagery
generator.

```bash
# Regenerate every static asset (favicons, app icons, avatars, OG cards, lockups)
pnpm generate:brand
```

This writes ~18 files per variant into `public/brand/<variant>/` — see
[`public/brand/README.md`](public/brand/README.md) for the full inventory, clear-space
and minimum-size rules, and a note on converting lockup type to outlines
before sending artwork to print.

## Deploying to Vercel

1. **Push this repo to GitHub** and import it into Vercel.
2. **Create a Postgres database** — in Vercel: Storage → Create → Postgres (Neon). This adds
   `DATABASE_URL` (or `POSTGRES_URL` — if so, copy its value into a `DATABASE_URL` env var).
3. **Create a Blob store** — Storage → Create → Blob. This adds `BLOB_READ_WRITE_TOKEN`, which
   automatically switches media uploads to Vercel Blob. **Give preview deployments their own
   store** (create a second Blob store and scope each store's token to one environment): unlike
   the database, Blob has no preview branching, so with a shared store a preview's media
   uploads, deletes and reseeds act on the same files production serves.
4. **Set the remaining environment variables** (Project → Settings → Environment Variables):
   - `PAYLOAD_SECRET` — a long random string (generate with `openssl rand -hex 24`)
   - `NEXT_PUBLIC_SERVER_URL` — `https://mentalhealthgoals.co.uk`
   - `CRON_SECRET` / `PREVIEW_SECRET` — random strings (jobs endpoint & draft preview)
   - `RESEND_API_KEY` — from Resend, once the domain is verified there (email sending)
5. **Set the build command** to `pnpm build:deploy` (Project → Settings → Build & Development).
   This runs the database migrations before building. Safe for previews too: the Neon
   integration's **preview branching** is enabled, so each preview deployment gets its own
   copy-on-write database branch — preview builds migrate (and their admin panels write to)
   that branch, never the production database. Keep preview branching enabled; without it,
   preview builds would run unmerged branch migrations against production.
6. **Deploy**, then create the first admin account at `https://mentalhealthgoals.co.uk/admin`
   (the first user is automatically an admin) and press the dashboard's **Seed** button to load
   the starter content. Don't point a local `.env` at the production database — the local seed
   script runs in dev mode and would sync schema outside migrations (it refuses by default).
7. **Point the domain**: Project → Settings → Domains → add `mentalhealthgoals.co.uk` and follow
   the DNS instructions from your registrar (A record to `76.76.21.21` or CNAME to
   `cname.vercel-dns.com` for `www`).

## Useful scripts

| Script                               | What it does                                                     |
| ------------------------------------ | ---------------------------------------------------------------- |
| `pnpm dev`                           | Dev server with HMR                                              |
| `pnpm build` / `pnpm start`          | Production build / serve                                         |
| `pnpm build:deploy`                  | Migrate then build (Vercel build command)                        |
| `pnpm seed`                          | Reset content to the MHGP starter seed                           |
| `pnpm generate:types`                | Regenerate `src/payload-types.ts` after schema changes           |
| `pnpm generate:brand`                | Regenerate all logo asset files in `public/brand`                |
| `pnpm generate:seed-imagery`         | Regenerate the seed's placeholder images from the ridge geometry |
| `pnpm payload migrate:create <name>` | Create a migration after changing collections/fields             |
| `pnpm lint` / `pnpm typecheck`       | ESLint / TypeScript                                              |
| `pnpm format` / `pnpm format:check`  | Prettier write / verify                                          |
| `pnpm test:int` / `pnpm test:e2e`    | Vitest integration tests / Playwright e2e (port 3210)            |
| `pnpm check:types-drift`             | Fail if `payload-types.ts` is stale                              |
| `pnpm check:migrations`              | Fail if the Payload config has schema changes with no migration  |

## Quality gates

Three layers keep the foundations sound:

1. **pre-commit** (husky + lint-staged): ESLint `--fix` and Prettier run on staged files.
2. **pre-push**: `pnpm typecheck` and `pnpm check:types-drift` — fast, no database needed.
3. **CI** (GitHub Actions, on every PR and push to main): lint + format check, typecheck,
   types drift, integration tests, **migration parity** (committed migrations must reproduce
   the exact schema the Payload config defines), a full production build mirroring Vercel's
   `build:deploy`, and the Playwright e2e suite — each against a fresh Postgres.

If you change collections or fields: run `pnpm payload migrate:create <name>` and
`pnpm generate:types`, and commit both — CI fails otherwise.

## Notes

- The `docs/` folder (source materials) is deliberately untracked — it contains internal
  documents that should not be published.
- Site content was drafted from the MHGP brochure and programme documents. **Review all copy,
  names and contact details with the team before go-live.**
- The images in the Media library are **generated placeholders, not photographs** — the ridge
  motif rendered from `src/brand/ridge.ts` by `pnpm generate:seed-imagery`. They exist so the
  layouts hold something on-brand until a shoot happens. **Commission real photography before
  launch** and replace them in the admin; no code change is needed to swap them.
- **How images are served:** pages hand the _original_ upload to Next's image optimizer, which
  resizes per viewport/DPR on demand and caches the result. Payload generates only two
  derivatives — `og` (the social-sharing card) and `thumbnail` (the admin preview). Don't judge
  image quality by opening a `/api/media/file/…` derivative directly; the original is what
  visitors see.
- A **Content-Security-Policy runs in report-only mode** (production builds only): nothing is
  blocked, violations are POSTed to `/csp-report` and appear in the Vercel function logs (search
  for `csp-report`). Once the logs stay quiet across real editing sessions, rename the header in
  `next.config.ts` to `Content-Security-Policy` to enforce it.
- The **Accessibility statement** and **Privacy notice** pages are drafts containing
  `[square-bracket placeholders]` (data controller, retention period, DPO contact, dates) that
  must be completed — and the wording confirmed with KCL information compliance — before launch.
