# Onboarding

How a new developer gets a working copy of this site, and the rules about credentials that make
that self-serve rather than a favour someone has to do.

`docs/` is gitignored in this repository — it holds OFFICIAL-marked source material — so this
lives in the root instead.

## What you need access to

| What              | Why                                                                   | Who grants it     |
| ----------------- | --------------------------------------------------------------------- | ----------------- |
| GitHub repository | The code                                                              | Repository admin  |
| Vercel project    | Deployments, previews, and the environment variables you pull         | Vercel team admin |
| Neon (via Vercel) | Only if you administer the database; day-to-day work does not need it | Owner             |

You do **not** need a Neon login, a blob token, or anybody's password to run this site locally.

## Getting running

```bash
nvm use          # Node 24, per .nvmrc
pnpm install
vercel login     # your own Vercel account
vercel link      # once, to associate this checkout with the project
pnpm bootstrap
```

`pnpm bootstrap` checks your tools, writes a `.env.local`, creates the local database and fills
it. It will offer two sources of content: a copy of production, or the test fixture. Either gets
you a working site.

`vercel link` is what makes bootstrap able to fetch real configuration rather than falling back to
`.env.example` with invented secrets. Do it first if you can; bootstrap works either way.

## Credentials

The principle: **anything local development needs, you fetch yourself.** Nobody pastes a
credential into a chat.

Shared values are distributed through Vercel. You need the CLI and your own account:

```bash
npm i -g vercel   # once, if you do not have it
vercel login
vercel link       # asks which project; choose mentalhealthgoals
vercel env pull   # Development scope, straight into .env.local
```

Your own Vercel account is the authentication. A Developer role on the team is enough, and
nothing in this flow can reach Production.

`vercel env pull` **merges rather than overwrites**. It updates the values it downloads and prints
a line naming any it kept because they are defined locally but absent from the Development scope.
That is why it writes `.env.local` directly, with no staging file to copy across, and why running
it again later is safe.

Two things it will not give you, neither of which matters:

- `NEXT_PUBLIC_SERVER_URL` is not in the Development scope. The code falls back to
  `http://localhost:3000`, which is what you want locally.
- `CRON_SECRET` is not set anywhere. Nothing schedules a job, and its absence closes the jobs
  endpoint rather than opening it.

- Collaborators need exactly **one** real credential: `SYNC_DATABASE_URL`, the read-only sync
  role's connection string. It is in the Development environment, so pulling it is enough.
- `pnpm sync:media` needs no credential at all. The blob store is public-read; it just fetches
  URLs.
- Blob read-write tokens and any write-capable database credential are **owner-only**. The local
  flow never needs them. Do not circulate them.
- Set `EMAIL_OVERRIDE_RECIPIENT` to your own address before doing anything that sends mail. A
  database synced from production carries the real notification address on the contact form, so
  without it a test submission reaches whoever production would have reached. The override applies
  to every message, including password resets. Leaving `RESEND_API_KEY` unset works too, and puts
  mail in the console instead.
- `pnpm sync:db` caches an unencrypted dump under `temp/neon-dumps/`. By default it holds content
  only — no users, no sessions, no form submissions. `--with-pii` includes all of them, including
  password hashes, so use it only when you actually need them and delete the cache afterwards.

## One-time setup: the read-only sync role

Done once by the owner. Everything above depends on it existing.

Create a read-only role on the **production** Neon database and put its **unpooled** connection
string in the Vercel environment as `SYNC_DATABASE_URL`, scoped to **Development** — which is what
`vercel env pull` reads and where the other local-only values live.

Do not mark it **Sensitive**. A sensitive value cannot be read back out of Vercel, and a
credential nobody can retrieve would quietly break the self-serve flow this whole document rests
on. Vercel's default storage type is "Encrypted", which is fine — it is what almost every variable
on this project already uses, and `vercel env pull` decrypts it.

"Encrypted" in `vercel env ls` is not a judgement that a value is secret. It is simply the default
for anything added by hand, which is why `SITE_NOINDEX`, whose value is `1`, is listed the same way
as the Resend key. Scope this credential by what it can do instead: it is read-only, so a leak
exposes content without being able to change anything.

Create the role with SQL in the Neon console's **SQL Editor** — not its Roles UI. Roles created
through the UI are automatically granted `neon_superuser` membership, which is full read-write and
the exact opposite of the point. Run this as the database owner:

```sql
CREATE ROLE sync_readonly WITH LOGIN PASSWORD '<generate-a-strong-password>';
GRANT CONNECT ON DATABASE neondb TO sync_readonly;
GRANT USAGE ON SCHEMA public TO sync_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO sync_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO sync_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO sync_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO sync_readonly;
-- Belt and braces: force this role's sessions into read-only transactions, so even a stray
-- future write grant cannot be exercised. The absence of write grants is the real control.
ALTER ROLE sync_readonly SET default_transaction_read_only = on;
```

Take the database name from Vercel's `DATABASE_POSTGRES_DATABASE` if it is not `neondb`.

Notes:

- `ALTER DEFAULT PRIVILEGES` covers objects created _by the role running the statement_, so run
  the whole block as the role that runs migrations (`neondb_owner`). Tables added by future
  migrations then stay readable without re-granting.
- The grants stop at `public` on purpose. Neon manages its own schemas that this role cannot read
  and the site does not use, which is why `scripts/sync-db.ts` passes `--schema=public`. Without
  that flag `pg_dump` tries to dump every schema and fails with `permission denied`. Do not "fix"
  that by granting wider access.
- If `pnpm sync:db` ever fails with `permission denied for table <x>`, production is fine — re-run
  the `GRANT` and `ALTER DEFAULT PRIVILEGES` lines. Skip `CREATE ROLE`; it errors harmlessly with
  "role already exists".
- Rotation is a password reset: `ALTER ROLE sync_readonly WITH PASSWORD '<new>'`, then update the
  Vercel variable. Cheap enough to do on any suspicion.
- Break-glass while the role is unavailable: `pnpm sync:db "<connection-string>"` accepts any
  connection string, so the owner can hand over a temporary one. There is no separate "preview
  database" to fall back on — each preview deployment gets its own disposable Neon branch, so the
  only durable source is production.

## Offboarding

- Remove from the GitHub repository and the Vercel team.
- Rotate `sync_readonly`'s password.
- Rotate anything that was shared directly during the engagement.
