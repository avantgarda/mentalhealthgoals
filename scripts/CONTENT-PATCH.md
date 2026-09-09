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

That production guard reads the deployment's target, not the database behind it. What
makes a preview safe is Neon's **preview branching**, which gives each preview
deployment its own copy-on-write branch. If that integration setting were ever turned
off, a preview deployment would point at the production database and this flag would
not fire. Confirm it is on before treating a preview run as harmless.

Plans have `version: 1`, a `name`, and a `changes` array. Each change specifies:

- `collection`: `pages`, `posts`, `workstreams` or `people`. A post exposes only its
  `content`: it is dated news, so its title and URL stay put, and the case for editing
  one is a link or a fact that has since gone wrong rather than a rewrite.
- `match`: a `field` (`slug`, or `name` for people) and exact `value`.
- `before` and `after`: the same set of permitted top-level content fields.
- `generatedIds`: optional IDs assigned in the plan to newly added rows. Payload
  generates its own IDs for these rows; verification permits that substitution
  while comparing every other value and preserving existing row IDs.

Read at depth zero. When changing a layout or array, preserve existing block/row IDs,
relationships, links and unaffected content; include the complete revised field.
Use a fresh production-derived preview so nested IDs match the reviewed source.
The script resolves document IDs within each target environment. Publishing status,
media and person relationships cannot be changed by this tool.

A page's URL cannot be changed either: pages carry the navigation and the bulk of
inbound links. A workstream's `slug` is editable, because its title and its URL are
expected to move together, and `match.value` stays the _baseline_ slug when it does.
Each record is then looked up under both its old and its new slug, so a repeated run
and a `--reverse` still find it. Payload only regenerates a slug from the title when
the record's `generateSlug` flag is set — it is off on this site's records, so a new
slug has to be written explicitly. Renaming a live URL needs a redirect alongside it.

Every record is checked before the first content write. Where a collection keeps
drafts, an unpublished latest draft stops the run — the check reads the document's
`_status` rather than naming a collection, so a collection added to the allowlist
later cannot skip it. Because autosave writes drafts continuously, this doubles as
the detector for an editor working in the admin at that moment. Collections without
versions return no `_status` and pass. Matching revised content is skipped, while any deviation from
the original baseline stops the run. Each write rechecks the fetched document and
adds an updatedAt predicate to the API request, then reads back and verifies the result.
These requests are not a multi-document transaction: arrange an editing pause for
the affected content when publishing. A failure may leave earlier records applied, and
rerunning safely skips already-applied edits.

Backups contain the original documents and a record of every write. Each write is
recorded _before_ its request goes out and updated as it progresses, because a write
can land while the response is lost, and because a read-back can fail on a record that
was in fact written. Each entry carries a `status`:

- `in flight` — the request was sent and its outcome is unknown. Inspect the live
  content for this record before rerunning or reversing.
- `written` — the API accepted the update, but the read-back had not yet confirmed it.
- `verified` — written and read back, matching the reviewed plan.

Anything other than `verified` on a finished run means look before acting.

To reverse a reviewed plan, run with `--reverse`, first as a dry run. Reversal works
from the plan rather than the receipt: it checks that content still matches the
expected revised values and refuses to overwrite later edits.

Check the actual preview pages on desktop and mobile after applying. Confirm text,
links, people, navigation, images and preserved forms. Merging a code branch does not
publish its CMS edits: replay the approved plan against the current production CMS.
Preview databases may be deleted when their associated PR closes; retain private
review plans and backups independently of the preview.
