<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CMS content updates

Read `scripts/CONTENT-PATCH.md` before preparing a CMS update. Production CMS content is the source of truth; use reviewed API edits, never upload a local database or put production copy in migrations.

The default handoff is: investigate and read the current content, prepare `plan.json`, `review.md`, `RUN.md` and `qa.md` in gitignored `temp/<change>/`, then give Eoin one `pnpm content:run` command. Eoin enters the production CMS login locally. Use `--validate` and the real read-only `--preflight` before handing over the command. Do not ask for passwords in chat, save a production credential file, try local seed credentials on production, or switch to browser login/editing when authentication fails.

Routine CMS-only updates do not need a Git branch, push, deployment, database reset or canary account. Use the separate preview workflow only for a concrete need described in the runbook; explain that need before adding infrastructure steps. Browser use is appropriate for read-only live website verification.

Reuse the maintained tools. They support reviewed copy, existing-person name corrections, partner relationships and explicitly declared new programme partners. Identify unsupported actions and missing assets during preparation, state the exact manual steps and their order in `RUN.md`, and include them in the review. An unsupported action is a limit of this tool, not proof the CMS cannot do it. Keep scope exclusions specific to the user's current request.

After the user runs the command, review the live result and related content using the runbook checklist. Automated success does not complete visual or editorial review. Check a person's name, role, full bio and photo alt text together, and check every affected partner placement and link on desktop and mobile. Report what was checked and anything still pending.

Preserve official logo artwork. For padding or size problems, inspect the source pixels and the renderer's size limits, then use deterministic cropping/resizing of the supplied file. Preserve the original and provide one clearly named output; do not generate, redraw, recolour or alter the mark unless the user explicitly requests that.
