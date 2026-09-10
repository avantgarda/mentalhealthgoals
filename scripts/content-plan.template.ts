/**
 * Template for a private plan script. Copy it to `temp/<plan-name>/plan.ts`,
 * change the import below to `../../scripts/lib/content-plan`, describe the
 * edits, and run it with `pnpm exec tsx temp/<plan-name>/plan.ts`.
 *
 * It reads the snapshot `content-snapshot` wrote into the same directory and
 * writes `plan.json` and `review.md` beside it. The copy it contains is
 * placeholder text: this file exists to show the shapes, not to be run as-is.
 *
 * Rules a plan has to respect, all enforced by `validatePlan`:
 * - only the allowlisted fields of pages, posts, workstreams and people;
 * - `before` is the snapshot's value for exactly the fields in `after`, so the
 *   tool refuses if the target has drifted since the snapshot;
 * - every ID minted for a NEW row goes through the Minter, so Payload's own
 *   replacement ID is tolerated on read-back;
 * - when rewriting rich text or a layout, edit a clone and put back the whole
 *   field — existing node IDs, links and untouched paragraphs must survive.
 */
import {
  Minter,
  change,
  find,
  loadSources,
  paragraph,
  relink,
  text,
  writePlan,
} from './lib/content-plan'

const dir = process.argv[2] ?? 'temp/example-plan'
const sources = loadSources(dir)
const minter = new Minter()
const changes = []

// A workstream: prose fields, a new bullet, and — pre-launch only — its slug.
const ws = find(sources, 'workstreams', 'example-workstream')
changes.push(
  change(
    'workstreams',
    ws,
    {
      slug: 'renamed-workstream',
      title: 'Renamed Workstream',
      summary: 'One line for the cards.',
      primaryFocus: [
        ...(ws.primaryFocus as { id: string; point: string }[]),
        { id: minter.mint(), point: 'A new bullet, with an ID the Minter recorded.' },
      ],
    },
    minter,
  ),
)

// A page: find the column by its heading, replace one paragraph, keep the rest.
const page = find(sources, 'pages', 'example-page')
const layout = structuredClone(page.layout) as {
  columns?: { richText: { root: { children: unknown[] } } }[]
}[]
const column = layout
  .flatMap((block) => block.columns ?? [])
  .find((col) => text(col.richText.root.children[0]) === 'Heading of the column to edit')
if (!column) throw new Error('Column not found — the page has changed since this plan was written')
column.richText.root.children[1] = paragraph('The replacement paragraph.')
changes.push(change('pages', page, { layout }))

// A post: re-point a link the rename above would break. Prose is left alone.
const post = find(sources, 'posts', 'example-post')
const content = structuredClone(post.content)
if (relink(content, '/workstreams/example-workstream', '/workstreams/renamed-workstream') === 0)
  throw new Error('Expected link not found')
changes.push(change('posts', post, { content }))

writePlan(dir, 'Example plan — replace with a name the team will recognise', changes)
console.log(`Wrote ${dir}/plan.json and review.md (${changes.length} changes)`)
