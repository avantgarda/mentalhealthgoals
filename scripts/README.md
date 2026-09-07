# Scripts

Command-line tools for this site. The rule that shapes all of them: **content lives in the
production CMS**, so data flows down to laptops, never up from them.

## What each one can touch

| Script                  | Reads                                | Writes                                  | Needs a credential?         |
| ----------------------- | ------------------------------------ | --------------------------------------- | --------------------------- |
| `pnpm bootstrap`        | `.env.example`, Vercel (if linked)   | `.env.local`, local database            | No                          |
| `pnpm sync:db`          | Production database (read-only role) | Local database — drops and recreates it | `SYNC_DATABASE_URL`         |
| `pnpm sync:media`       | Local database, public blob URLs     | `public/media`                          | No                          |
| `pnpm blobs:mirror`     | Production blob store                | Preview blob store                      | Two blob tokens, owner-only |
| `pnpm fixture`          | `tests/fixtures`                     | Local database — wipes every collection | No                          |
| `pnpm check:migrations` | Payload config, `src/migrations`     | Two scratch databases, dropped after    | No                          |
| `pnpm generate:brand`   | `src/brand/*`                        | `public/brand`                          | No                          |

Nothing here can write to the production database or the production blob store. That is
structural, not a convention:

- `sync:db` refuses any target that is not localhost, because it drops what it points at.
- `sync:media` only ever downloads.
- `fixture` refuses any target that is not localhost, for the same reason as
  `sync:db`.
- `blobs:mirror` refuses production as a destination, and refuses to run at all if it cannot
  positively identify which store each token belongs to.

## `pnpm bootstrap`

From a fresh clone to a running site. Checks Node and the PostgreSQL client, writes a
`.env.local`, creates the local database, and fills it either from production or from the test
fixture — the second being the path for somebody who does not have production access yet.

It installs nothing. Where a prerequisite is missing it names it and stops.

## `pnpm sync:db`

Copies the production database into the local one named by `DATABASE_URL`, dropping and recreating
it. The source is `SYNC_DATABASE_URL` — the read-only `sync_readonly` role, pulled from the Vercel
Development environment. See [ONBOARDING.md](../ONBOARDING.md).

```bash
pnpm sync:db              # use the cached dump if there is a recent one
pnpm sync:db --force      # re-download
pnpm sync:db --with-pii   # include users, sessions and form submissions
```

Personal data is left behind by default: no users, no sessions, no form submissions. Their tables
are still created, so the schema matches production — only the rows are skipped. An empty `users`
table means `/admin` offers to create the first user, which is the intended way to get a local
admin account.

Use the **unpooled** Neon connection string. `pg_dump` needs a session, and a pooler will give you
intermittent failures instead of an honest error.

Afterwards:

```bash
pnpm payload migrate   # if this branch has migrations production does not
pnpm sync:media        # the files the content refers to
```

and restart `pnpm dev`. Globals are cached per server process, so a running dev server will keep
serving the ones it read at startup.

Dumps are cached in `temp/neon-dumps/` (gitignored), one per source.

## `pnpm sync:media`

Downloads every file the CMS references into `public/media`, reading the list from the **local**
database — so run `sync:db` first.

```bash
pnpm sync:media
pnpm sync:media --clean                  # re-download, overwriting
pnpm sync:media --base-url https://...   # a different store, e.g. preview
```

It works out which files matter from `information_schema` rather than a hardcoded list, because
Payload puts every generated image size in its own `sizes_*_filename` column, and that set changes
whenever the Media collection does. Miss them and the originals arrive while every thumbnail 404s.

It downloads only what the CMS references. Orphaned blobs and anything uploaded outside Payload
are ignored — this is a development convenience, not a backup. It never deletes a local file.

## `pnpm blobs:mirror`

Copies the production blob store into the preview one. Owner-only.

Neon branches the database for every preview deployment; Vercel Blob does not branch at all. This
project therefore keeps two stores, `blob-mentalhealthgoals-prod` and
`blob-mentalhealthgoals-preview`, with each token scoped to one environment. That stops a preview
overwriting a live file, and it means previews show broken images until production's uploads are
copied across. **Run this after uploading anything real in production.**

```bash
PRODUCTION_BLOB_READ_WRITE_TOKEN=... \
PREVIEW_BLOB_READ_WRITE_TOKEN=... \
  pnpm blobs:mirror --dry-run
```

Both tokens come from Vercel → Storage → the store's own page. They cannot be pulled: the
production environment's variables are marked Sensitive, so `vercel env pull` returns
`[SENSITIVE]` rather than the value. That is the intended shape — a token is what grants the
write, so supplying one stays a deliberate act.

The store origins are not tokens and are recorded in `lib/production-identifiers.ts`, so there is
nothing to look up. They are checked rather than trusted: the run is refused unless the
destination token's own blobs all come back on the recorded preview origin. Override with
`PREVIEW_BLOB_BASE_URL` only if a store has been recreated.

Drop `--dry-run` to write. Add `--exact` to also delete preview files production does not have —
only after every production file has been copied and byte-verified.

This is the one script that deliberately does **not** read `.env.local`. That file is one every
collaborator has, and `vercel env pull` puts a blob token in it; reading it would let whichever
token happened to be sitting there decide which store gets written to. Tokens must be put into the
invoking process on purpose. They are never accepted as arguments, where they would land in shell
history and process listings.

Everything is verified because the failure being guarded against is silent: a truncated download
uploaded over a good file looks exactly like success. Bytes are counted against the listing,
hashed, re-read from the destination and hashed again, and nothing is deleted until every source
file is confirmed identical. If production changes mid-run, the prune is abandoned.

## `pnpm check:migrations`

Runs the committed migrations into one scratch database, push-syncs the live Payload config into
another, and diffs the two schemas. It fails if a collection changed without a migration — before
that mismatch can break a deploy.

This is the only thing that turns Payload's schema push on, via `PAYLOAD_DB_PUSH=1`. Everywhere
else, including local development, the schema comes from migrations. Change a collection, then:

```bash
pnpm payload migrate:create <name>   # needs a real terminal
pnpm payload migrate
pnpm generate:types
```

and commit all three.
