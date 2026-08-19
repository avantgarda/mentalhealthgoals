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

# 4. Seed the database with the starter MHGP content
pnpm seed

# 5. Run the dev server
pnpm dev
```

The site runs at [http://localhost:3000](http://localhost:3000) and the admin panel at
[http://localhost:3000/admin](http://localhost:3000/admin).

### Seeding

`pnpm seed` **replaces all content** with the starter MHGP content: 8 pages, 6 workstreams,
the leadership team, two news posts, the contact form, and header/footer navigation. It also
creates the admin user (email/password from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`)
if it doesn't already exist. The same seed can be run from the admin dashboard's "Seed" button.

In development the database schema is kept in sync automatically (Drizzle push mode). Production
uses the committed migrations in `src/migrations`.

## Content model

| Type                | What it's for                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pages**           | Layout-builder pages (hero + blocks). Home, About, Workstreams, For industry, Patients & public, People, Industry Engagement Forum, Contact |
| **Posts**           | News & events, listed at `/posts`                                                                                                           |
| **Workstreams**     | The six national workstreams — edit these and the workstream grids update everywhere                                                        |
| **People**          | Leadership team cards, ordered by the `order` field                                                                                         |
| **Media**           | Uploads (local `public/media` in dev, Vercel Blob in production)                                                                            |
| **Header / Footer** | Navigation globals                                                                                                                          |
| **Brand & Logo**    | Global controlling which logo mark the whole site uses                                                                                      |

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
cannot drift apart.

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
   automatically switches media uploads to Vercel Blob.
4. **Set the remaining environment variables** (Project → Settings → Environment Variables):
   - `PAYLOAD_SECRET` — a long random string (generate with `openssl rand -hex 24`)
   - `NEXT_PUBLIC_SERVER_URL` — `https://mentalhealthgoals.co.uk`
   - `CRON_SECRET` / `PREVIEW_SECRET` — random strings (scheduled publishing & draft preview)
5. **Set the build command** to `pnpm build:deploy` (Project → Settings → Build & Development).
   This runs the database migrations before building.
6. **Deploy**, then run the seed once against production if you want the starter content there:
   set the production `DATABASE_URL` in your local `.env` temporarily and run `pnpm seed`.
7. **Point the domain**: Project → Settings → Domains → add `mentalhealthgoals.co.uk` and follow
   the DNS instructions from your registrar (A record to `76.76.21.21` or CNAME to
   `cname.vercel-dns.com` for `www`).

## Useful scripts

| Script                               | What it does                                           |
| ------------------------------------ | ------------------------------------------------------ |
| `pnpm dev`                           | Dev server with HMR                                    |
| `pnpm build` / `pnpm start`          | Production build / serve                               |
| `pnpm build:deploy`                  | Migrate then build (Vercel build command)              |
| `pnpm seed`                          | Reset content to the MHGP starter seed                 |
| `pnpm generate:types`                | Regenerate `src/payload-types.ts` after schema changes |
| `pnpm generate:brand`                | Regenerate all logo asset files in `public/brand`      |
| `pnpm payload migrate:create <name>` | Create a migration after changing collections/fields   |
| `pnpm lint`                          | ESLint                                                 |

## Notes

- The `docs/` folder (source materials) is deliberately untracked — it contains internal
  documents that should not be published.
- Site content was drafted from the MHGP brochure and programme documents. **Review all copy,
  names and contact details with the team before go-live.**
