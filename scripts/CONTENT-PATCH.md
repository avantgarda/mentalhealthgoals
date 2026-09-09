# Reviewed CMS content changes

`content-patch.ts` applies a private, reviewed content plan through Payload's REST API.
It uses the existing Vercel CLI login to reach protected deployments and a separate
Payload editor login to read drafts and edit content. It does not connect to Postgres,
run migrations, synchronise databases, or load `.env.local` automatically.

Keep plans, source snapshots and backups in the gitignored `temp/` directory.
The repository contains the mechanism, not a copy of production content.

Supply `MHG_CMS_EMAIL` and `MHG_CMS_PASSWORD` in the process environment. Do not pass
passwords or tokens as command arguments. Login requests and JWT headers use private
temporary files that are removed on exit. The script logs out its own session.

```sh
pnpm exec tsx scripts/content-patch.ts \
  --deployment example-preview.vercel.app \
  --plan temp/review/plan.json
```

The default is a dry run: authentication creates a temporary CMS session, but content
is not changed. Add `--apply --backup-dir temp/review/backups` to apply to the preview.
The Vercel deployment must be READY and belong to the linked project. Production writes
additionally require `--allow-production`; use this only after approval of the content.

Plans have `version: 1`, a `name`, and a `changes` array. Each change specifies:

- `collection`: `pages`, `workstreams` or `people`.
- `match`: a `field` (`slug`, or `name` for people) and exact `value`.
- `before` and `after`: the same set of permitted top-level content fields.
- `generatedIds`: optional IDs assigned in the plan to newly added rows. Payload
  generates its own IDs for these rows; verification permits that substitution
  while comparing every other value and preserving existing row IDs.

Read at depth zero. When changing a layout or array, preserve existing block/row IDs,
relationships, links and unaffected content; include the complete revised field.
Use a fresh production-derived preview so nested IDs match the reviewed source.
The script resolves document IDs within each target environment. URLs, publishing
status, media and person relationships cannot be changed by this tool.

Every record is checked before the first content write. An unpublished latest Page
draft stops the run. Matching revised content is skipped, while any deviation from
the original baseline stops the run. Each write rechecks the fetched document and
adds an updatedAt predicate to the API request, then reads back and verifies the result.
These requests are not a multi-document transaction: arrange an editing pause for
the affected content when publishing. A failure may leave earlier records applied;
the backup records completed writes, and rerunning safely skips already-applied edits.
If a request has an uncertain outcome, inspect current content before proceeding.

Backups contain the original documents and a completion receipt. To reverse a reviewed
plan, run with `--reverse`, first as a dry run. Reversal checks that content still
matches the expected revised values and refuses to overwrite later edits.

Check the actual preview pages on desktop and mobile after applying. Confirm text,
links, people, navigation, images and preserved forms. Merging a code branch does not
publish its CMS edits: replay the approved plan against the current production CMS.
Preview databases may be deleted when their associated PR closes; retain private
review plans and backups independently of the preview.
