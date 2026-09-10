# Programmatic content changes

Bulk edits to existing CMS content, reviewed as a document, tested on a preview
whose database is proven to be its own, then replayed against production. Four
scripts and a library; every plan and its artefacts stay in the gitignored
`temp/` directory, because the repository holds the mechanism, never a copy of
the content.

|                               |                                                          |
| ----------------------------- | -------------------------------------------------------- |
| `pnpm content:editor`         | temporary editor on a preview DB branch — the canary     |
| `pnpm content:snapshot`       | baseline of every editable collection, from a deployment |
| `scripts/lib/content-plan.ts` | what a plan script uses to describe edits                |
| `pnpm content:patch`          | dry run by default; `--apply`; `--allow-production`      |
| `pnpm content:verify`         | proves a deployment shows what the plan says             |

Credentials always come from `MHG_CMS_EMAIL` / `MHG_CMS_PASSWORD` in the
process environment, never from arguments. Load a password with `read -s` so it
touches neither shell history nor a transcript.

## Runbook

Work in a directory per change, e.g. `temp/oct-forum-update/`.

1. **Reset the preview database to production.** The preview branch is a
   copy-on-write child of `main`; resetting it makes the baseline production's
   content as of now. The Vercel–Neon integration names it after the git branch:

   ```sh
   neonctl branches reset preview/<git-branch> --parent --project-id royal-feather-31470094
   ```

2. **Redeploy the preview** so `build:deploy` migrates the fresh branch, and note
   the new hostname:

   ```sh
   vercel redeploy <previous-preview-host>.vercel.app
   ```

3. **Create the canary editor** on that branch and load its credentials:

   ```sh
   pnpm content:editor create --dir temp/<plan>
   export MHG_CMS_EMAIL=$(node -e "console.log(require('./temp/<plan>/preview-credentials.json').email)")
   export MHG_CMS_PASSWORD=$(node -e "console.log(require('./temp/<plan>/preview-credentials.json').password)")
   ```

4. **Snapshot the baseline** from the preview, as the tool will read it:

   ```sh
   pnpm content:snapshot --deployment <preview-host> --dir temp/<plan>
   ```

5. **Write the plan script.** Copy `scripts/content-plan.template.ts` to
   `temp/<plan>/plan.ts`, point its import at `../../scripts/lib/content-plan`,
   describe the edits, and run it. It writes `plan.json` and a `review.md` that
   shows only what changed, passage by passage, for sign-off.

6. **Dry run, apply, verify** on the preview:

   ```sh
   pnpm content:patch --deployment <preview-host> --plan temp/<plan>/plan.json
   pnpm content:patch --deployment <preview-host> --plan temp/<plan>/plan.json --apply --backup-dir temp/<plan>/backups
   pnpm content:verify --deployment <preview-host> --plan temp/<plan>/plan.json
   ```

   Every record must report `ready` (or `already applied`) before anything is
   written. Look at the pages as well — the verifier proves presence of text,
   not that it reads well.

7. **Remove the canary:** `pnpm content:editor delete --dir temp/<plan>`.

8. **Production**, with your own CMS login in the environment, once the review
   is approved and any code the change depends on has been merged:

   ```sh
   pnpm content:patch --deployment <production-host> --plan temp/<plan>/plan.json
   pnpm content:patch --deployment <production-host> --plan temp/<plan>/plan.json --apply --allow-production --backup-dir temp/<plan>/backups
   pnpm content:verify --deployment <production-host> --plan temp/<plan>/plan.json
   ```

   Merging a code branch never publishes content; only this step does. Keep
   `temp/<plan>/` afterwards — it holds the only record of what was written.

## Why the canary

Vercel's `preview` label says which environment a deployment is, not which
database it reads. Preview isolation depends on a store setting — **Create
Database Branch For Deployment → Preview**, which itself needs **Require Active
Resource Before Deploy** on — that reset silently when the project changed
teams, after which preview builds migrated production and a "preview" apply
would have written production content.

The tool does not trust the label. On a preview it accepts only a login with an
`@….invalid` address, which `content:editor` creates directly on the preview
branch and nowhere else. That login succeeding is the proof the deployment
reads its own branch; failing, the run stops before it reads a record. On
production the reverse applies: a canary address there means something is
wrong. Neither check can be switched off.

## What a plan is

`plan.json`: `version: 1`, a `name`, and `changes`, each with

- `collection` — `pages`, `posts`, `workstreams` or `people`;
- `match` — `{ field, value }`: `name` for people, `slug` otherwise, always the
  _baseline_ value;
- `before` and `after` — the same set of fields, from this allowlist:

  | collection    | fields                                                                                                                         |
  | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
  | `pages`       | `layout`, `hero`, `meta`                                                                                                       |
  | `posts`       | `content`                                                                                                                      |
  | `workstreams` | `slug`, `title`, `summary`, `description`, `boundaryStatement`, `primaryFocus`, `keyQuestions`, `differentiators`, `resources` |
  | `people`      | `role`, `bio`                                                                                                                  |

- `generatedIds` — IDs the plan minted for rows that do not exist yet. Payload
  assigns its own on insert; the comparison tolerates exactly that substitution
  and nothing else.

Records are only ever updated: no creates, no deletes, no media, no
relationships, no publish status, no navigation globals. A page's URL is out of
reach because pages carry the navigation and inbound links; a workstream's
`slug` may move with its title, pre-launch, and the tool then finds the record
under either name so a re-run or a reversal still works. Nothing redirects an
old path — check for links to it (posts, in practice) and re-point them in the
same plan.

Two values are known to change under the tool's feet and are ignored: the
server-minted row IDs declared in `generatedIds`, and a Lexical block node's
`fields.id`, which Payload regenerates on every read when the block was seeded
without one. Everything else in a record has to match exactly.

## What the tool guarantees

- **Nothing writes without `--apply`**, and production also needs
  `--allow-production`.
- **Every record is checked before the first write**, and again immediately
  before its own write. A record whose content differs from the plan's `before`
  stops the run: an editor's change is never overwritten. An unpublished draft
  stops it too — with autosave on, that is how an editor with the page open is
  detected.
- **A record already matching `after` is skipped**, so a re-run after a failure
  is inert for what landed and completes what did not.
- **Each write is fenced by `updatedAt`** at the API and read back and compared
  before the next begins.
- **The receipt in `--backup-dir` records every write before its request is
  sent**, stepping `in flight → written → verified`, with the original documents
  alongside. Anything other than `verified` on a finished run means look at that
  record before rerunning or reversing. (This exists because a read-back failure
  once produced a receipt claiming nothing had changed.)
- **Reversal:** `--reverse` swaps `before` and `after` and runs the same checks,
  refusing to overwrite later edits. Every editable collection also keeps
  version history, so a single record can be restored in the admin.

Writes are sequential, roughly ten seconds each, and there is no cross-record
transaction: the price of never opening a database connection to production.
For a plan of a few records the mixed state lasts under a minute; a slug change
is the exception, since its old path is dead from the moment that one record is
written — put the redirect or link fixes in the same plan.

## When it stops

| Message                                             | Meaning                                                                                                                                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Preview runs must log in as the temporary editor…` | Load the canary's credentials from `preview-credentials.json`; create one if missing.                                                                                                          |
| `CMS authentication failed` on preview              | The canary exists only on the preview branch, so this is the isolation check failing: the deployment is reading some other database. Check the store connection settings before anything else. |
| `Content differs from reviewed baseline`            | The target has moved since the snapshot (someone edited it, or the snapshot was not taken from this environment's baseline). Re-snapshot from a freshly reset preview and rebuild the plan.    |
| `Content changed during this run`                   | An edit landed between the pre-check and the write. Rerun; already-applied records are skipped.                                                                                                |
| `Read-back verification failed`                     | Usually new rows whose IDs were not declared in `generatedIds`. The write landed (the receipt says `written`); fix the plan and rerun — the record will report `already applied`.              |
| `Expected exactly one …`                            | The match value finds zero or several records. For a renamed slug, both names are tried.                                                                                                       |
| `vercel request failed (exit 22)`                   | An HTTP error from the deployment; the body is never printed because login responses carry tokens. Exit 1 is the CLI itself — retry once.                                                      |
| `Resource provisioning timed out` (build)           | Vercel-side; verify Neon is healthy and retry the deploy. Do not delete the Neon branch.                                                                                                       |
