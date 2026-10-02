# Programmatic content changes

For routine CMS updates, prepare a reviewed plan and give Eoin **one command** to
run with his production CMS login. The repository stores the mechanism; plans,
copy, source snapshots, assets and receipts stay in gitignored `temp/<change>/`.
Production is the source of truth. Never upload a local database or put content
in migrations.

## Default workflow: reviewed plan, user-run command

1. **Investigate without writing.** Read the request, current CMS content and
   authoritative sources. Record approved scope and exclusions. Check related
   content together: a name/role correction may also affect a bio and photo alt
   text; a new partner needs links, placements and an asset decision.

   Read public published content without asking for a CMS login:

   ```sh
   pnpm content:snapshot --deployment mentalhealthgoals.vercel.app --dir temp/<change> --public
   ```

   This includes partners, but omits private fields such as `usageNote` and
   unpublished drafts. The user-run patcher authenticates and checks latest
   drafts before any content write. An authenticated snapshot is available when
   needed; local seed accounts are not production accounts.

2. **Prepare the complete handoff.** Adapt `scripts/content-plan.template.ts` and
   use `scripts/lib/content-plan.ts`. It writes `plan.json`, a readable
   `review.md` and a completion checklist `qa.md`. `review.md` must cover copy,
   name changes, structural changes, partner relationships and any creations.
   Resolve existing partner IDs to names in the accompanying explanation.
   Write `RUN.md` with approved scope, sources, the single command, expected
   result, recovery guidance and any manual steps in their execution order.
   State missing artwork/permissions and any unsupported action now, before the
   user runs the command. Never present a partial script as the complete update.

3. **Validate before handoff.** These commands do not need a CMS login or write
   content. The second exercises the real Vercel metadata and public CMS
   transport, so an offline mock cannot hide a broken CLI invocation:

   ```sh
   pnpm content:run --plan temp/<change>/plan.json --validate
   pnpm content:run --plan temp/<change>/plan.json --preflight
   ```

   Complete the copy/action review before production apply. Routine CMS-only
   changes do not require a Git branch/push, preview deployment, database reset,
   canary or browser-based admin editing. If there is a concrete reason to use a
   preview, explain it and follow the separate workflow below.

4. **Give the user one command once the plan is approved:**

   ```sh
   pnpm content:run --plan temp/<change>/plan.json --apply --allow-production
   ```

   The runner defaults to the permanent `mentalhealthgoals.vercel.app` alias and
   validates that it resolves to this project's READY production deployment.
   It checks transport before prompting, asks for the CMS email and hidden
   password, checks every target, backs up original target documents, applies
   the plan, reads each write back, and runs API/page verification. Credentials
   are not arguments, shell-history entries or a persistent credential file.
   Private temporary request/config files are removed and the session is logged
   out at completion. Do not ask for passwords in chat, use a credentials helper
   that saves them, or try browser login after a CLI authentication failure.

   Without `--apply` it is a dry run. `--verify-only` checks an already-applied
   plan without content writes. `--deployment <exact-host>.vercel.app` selects
   another deployment; previews still require the isolation canary. `--reverse`
   reverses reviewed updates, with the same fences, and leaves created partners
   in place. Never delete a partner automatically during reversal.

5. **Review the live website after the user runs the command.** Follow the
   checklist below and record dated evidence in `qa.md`. Browser use is useful
   here for read-only inspection. The runner reports automated verification and
   leaves `liveWebsiteReview` pending in `run.json`; it cannot certify layout,
   optical logo size, factual completeness or manual steps.

Keep the change directory. Each apply/verify run has its own timestamped
`backups/` directory with the reviewed input, original documents/write receipt,
`resolved-plan.json`, `verification.json` and `run.json`. The resolved plan
replaces new-partner references with actual CMS IDs and can be used with the
low-level verifier/patcher. `review.md` describes the proposal; dated receipts
and `qa.md` record what actually happened.

## Tools and supported scope

| Tool                          | Purpose                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm content:run`            | Prompted user handoff; dry run by default, explicit production apply, automatic verification |
| `pnpm content:snapshot`       | Published public baseline with `--public`, or authenticated latest drafts                    |
| `scripts/lib/content-plan.ts` | Build a plan, readable review and completion checklist                                       |
| `pnpm content:patch`          | Low-level patch; credentials in environment, `--apply`, `--allow-production`, `--backup-dir` |
| `pnpm content:verify`         | Check rendered pages and exact authenticated fields/version history                          |
| `pnpm content:editor`         | Temporary editor used only for isolated preview testing                                      |

The maintained runner supports copy fields listed below, **existing-person name
corrections**, **workstream partner relationships**, page partner blocks through
`layout`, and **explicit new programme partner declarations**. It does not add
Team members, delete records, upload media, alter publishing status or edit
navigation globals. Describe any manual Media/Partners admin steps precisely in
`RUN.md`, with the file, target record/field and whether to do them before or
after the command. Do not call them impossible just because this tool lacks the
operation. Extend the mechanism only when the requested scope actually needs it.

### Declaring a new programme partner

Add optional `createPartners` to the same version-1 plan. Use a unique reference
as a whole entry in an `after.partners` array: a workstream's `partners` field or
a `partnerLogos` block's `partners` field. It cannot be used in prose, another
relationship or `before`. Example using invented content:

```json
{
  "reference": "__PARTNER_EXAMPLE__",
  "data": {
    "name": "Example programme partner",
    "url": "https://example.org/",
    "role": "partner",
    "showInFooter": false,
    "usageNote": "Text recognition only; artwork and permission pending.",
    "order": 40
  }
}
```

`name`, HTTPS `url`, `role: "partner"`, `showInFooter: false` and `usageNote` are
required; `strapline` and finite `order` are optional. Logos/funder/footer
changes are outside this creation allowlist. Each declaration must be referenced
by a reviewed update. Pass declarations as the fifth argument to `writePlan`
(after optional review status). Every supplied field is checked on an existing
record with the same name; a mismatch or duplicate stops before writes. A rerun
reuses an identical existing record. Creation is not transactional across
records: if another editor races creation, duplicate detection/readback stops
the run and the receipt needs inspection.

## Completion checklist

- Compare the exact approved fields with authenticated CMS data; check for
  drafts, correct relationships and version history. Keep the receipt path.
- Open every affected live URL and every other page that renders the changed
  person, partner or workstream. Inspect desktop and mobile views, text wrapping,
  spacing, loading, links and any interactive biography/details panel.
- Check names, academic titles, roles, **full biographies** and image alt text
  together against current authoritative sources. A role-only patch does not
  prove the rest of the profile is current.
- Check partner identity, placement, website target and actual logo artwork.
  If a logo is pending, report that clearly before handoff and at completion.
- For a small logo, inspect transparent padding and rendered width/height caps.
  Scaling the CMS value may have no effect at a width cap. Use deterministic
  crop/resize of supplied artwork, preserve the original, verify that a crop
  preserves artwork pixels, and give one clearly named output. Never use
  generative recreation, recolouring or redrawing unless explicitly requested.
- Finish or explicitly report every manual step. Distinguish automated checks,
  visual/editorial checks and anything not verified. Do not say everything is
  checked based solely on HTTP 200s or text-presence checks.

## Separate workflow: when a preview is needed

Use an isolated preview when the content depends on undeployed code/schema,
needs a rendered rehearsal unavailable through existing CMS draft preview, or
when the user requests one. A code change follows the normal repository review
and deployment process; a CMS-only update does not inherit that process just
because these scripts live in Git. Explain the concrete need first. Never
assume a Vercel `preview` label proves database isolation.

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

6. **Dry run, apply, verify** on the preview, using the same runner:

   ```sh
   pnpm content:run --deployment <preview-host> --plan temp/<plan>/plan.json
   pnpm content:run --deployment <preview-host> --plan temp/<plan>/plan.json --apply
   ```

   Every record must report `ready` (or `already applied`) before anything is
   written. The apply also verifies resolved partner IDs, updated fields and
   rendered text. Look at the pages as well — automated checks do not establish
   that the content is complete or the layout looks right.

7. **Remove the canary:** `pnpm content:editor delete --dir temp/<plan>`.

   The preview editor's generated credentials file is an exception for this
   disposable canary, not a template for storing production login details.

After preview validation, remove the canary and hand over the same approved plan
using the default user-run production command. Merge/deploy any code dependency
first. A Git merge never publishes CMS copy.

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

  | collection    | fields                                                                                                                                     |
  | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
  | `pages`       | `layout`, `hero`, `meta`                                                                                                                   |
  | `posts`       | `content`                                                                                                                                  |
  | `workstreams` | `slug`, `title`, `summary`, `description`, `boundaryStatement`, `primaryFocus`, `keyQuestions`, `differentiators`, `resources`, `partners` |
  | `people`      | `name`, `role`, `bio`                                                                                                                      |

- `generatedIds` — IDs the plan minted for rows that do not exist yet. Payload
  assigns its own on insert; the comparison tolerates exactly that substitution
  and nothing else.

Existing records are updated, with only explicitly declared programme partners
created as described above. No deletes, Media uploads, Team additions, publish
status changes or navigation globals. A page's URL is out of
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

Writes are sequential; timing depends on the deployment, and there is no cross-record
transaction: the price of never opening a database connection to production.
Records may briefly be in a mixed state; a slug change
is the exception, since its old path is dead from the moment that one record is
written — put the redirect or link fixes in the same plan.

## When it stops

`CMS login failed` on production means check that the user supplied a production
CMS account, not a local seed account. Keep the prepared plan; do not create a
credential file or switch to browser authentication. On preview, confirm the
canary login and database isolation before continuing.

| Message                                             | Meaning                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Preview runs must log in as the temporary editor…` | Load the canary's credentials from `preview-credentials.json`; create one if missing.                                                                                                                                                                                |
| `Content differs from reviewed baseline`            | The target has moved since the snapshot (someone edited it, or the snapshot was not taken from this environment's baseline). Re-snapshot the actual target and re-review the changed fields; do not reset a preview unless this change needs one.                    |
| `Content changed during this run`                   | An edit landed between the pre-check and the write. Rerun; already-applied records are skipped.                                                                                                                                                                      |
| `Read-back verification failed`                     | Usually new rows whose IDs were not declared in `generatedIds`. The write landed (the receipt says `written`); fix the plan and rerun — the record will report `already applied`.                                                                                    |
| `Expected exactly one …`                            | The match value finds zero or several records. For a renamed slug, both names are tried.                                                                                                                                                                             |
| `vercel curl failed (exit 22)`                      | HTTP error; response bodies are withheld. Check deployment/CMS access. Exit 2 can mean a CLI flag was forwarded to curl: never pass `--scope` to `vercel curl`. Scope is supplied only to metadata API calls. Run `--preflight` again before asking for credentials. |
| `Resource provisioning timed out` (build)           | Vercel-side; verify Neon is healthy and retry the deploy. Do not delete the Neon branch.                                                                                                                                                                             |

## Check that a fresh session follows the workflow

Start a fresh Codex session in this repository and use this read-only trial:

> Read the project instructions. A programme partner needs recognition on the
> site and an existing person's academic title has changed. Describe your CMS
> update workflow, deliverables, login handoff, missing-logo handling and
> completion checks. Do not change files, contact anyone, authenticate to the
> CMS, create infrastructure or write production content.

It should read this runbook, choose a reviewed plan plus one user-run command,
preserve the existing safety checks, identify missing/manual steps early and
include the full bio/alt text and live desktop/mobile review. It should reserve
branching/deployment/canary work for an actual preview need and preserve supplied
brand artwork. If it does something else, fix the relevant instruction and
repeat the read-only trial; do not compensate with an ever-growing transcript.

The development checks for the mechanism are:

```sh
pnpm exec vitest run --config vitest.config.mts tests/unit/contentPatch.spec.ts tests/unit/contentPlan.spec.ts tests/unit/contentRunner.spec.ts tests/unit/contentHandoff.spec.ts
pnpm typecheck
```

Fixtures contain invented data and an offline Vercel/Payload transport; these
tests cannot write to a live CMS. Run the separate real `--preflight` too before
a handoff. A fresh-session trial checks instruction following, not permission
to apply content.
