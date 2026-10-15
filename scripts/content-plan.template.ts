/**
 * Template for a private plan script. Copy it to `temp/<plan-name>/plan.ts`,
 * change the import below to `../../scripts/lib/content-plan`, describe the
 * edits, and run it with `pnpm exec node --import tsx temp/<plan-name>/plan.ts`.
 *
 * It reads the snapshot `content-snapshot` wrote into the same directory and
 * writes `plan.json`, `review.md` and `qa.md` beside it. Add RUN.md with the
 * command and any manual steps; see CONTENT-PATCH.md. The copy it contains is
 * placeholder text: this file exists to show the shapes, not to be run as-is.
 *
 * Rules a plan has to respect, all enforced by `validatePlan`:
 * - only the allowlisted fields of pages, posts, workstreams and people;
 * - `before` is the snapshot's value for exactly the fields in `after`, so the
 *   tool refuses if the target has drifted since the snapshot;
 * - every ID minted for a NEW row goes through the Minter, so Payload's own
 *   replacement ID is tolerated on read-back;
 * - when rewriting rich text or a layout, edit a clone and put back the whole
 *   field — existing node IDs, links and untouched paragraphs must survive;
 * - a PDF not yet in Media is declared with `declareUpload` (file in this
 *   directory, at most 4 MB) and linked only through `withUploads`, and every
 *   declared file must be linked.
 */
import {
  Minter,
  change,
  declareUpload,
  find,
  loadSources,
  paragraph,
  relink,
  relinkToMedia,
  text,
  withUploads,
  writePlan,
} from './lib/content-plan'

const dir = process.argv[2] ?? 'temp/example-plan'
const sources = loadSources(dir)
const minter = new Minter()
const changes = []

// A workstream: prose fields and a new bullet. Preserve existing URLs.
const ws = find(sources, 'workstreams', 'example-workstream')
changes.push(
  change(
    'workstreams',
    ws,
    {
      title: 'Example Workstream',
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

// A post: correct one outdated external link. Prose is left alone.
const post = find(sources, 'posts', 'example-post')
const content = structuredClone(post.content)
if (relink(content, 'https://old.example.org/', 'https://new.example.org/') === 0)
  throw new Error('Expected link not found')
changes.push(change('posts', post, { content }))

// A page: point typed links to PDFs at the files in Media. A file not in
// Media yet is declared here and uploaded by the same command, before any
// record changes. The site adds each file's type and size, so a size typed
// into the words is removed.
const lateSlides = declareUpload(dir, {
  reference: '__MEDIA_EXAMPLE_LATE_SLIDES__',
  file: 'files/Example late slides v2.pdf',
  filename: 'example-late-slides.pdf',
  alt: 'Example late slides',
})
const forum = find(sources, 'pages', 'example-forum')
const forumLayout = structuredClone(forum.layout)
const files = relinkToMedia(forumLayout, withUploads(sources, [lateSlides]))
if (files.join() !== 'example-slides.pdf,example-late-slides.pdf')
  throw new Error(`Unexpected file links: ${files}`)
changes.push(change('pages', forum, { layout: forumLayout }))

writePlan(dir, 'Example plan — replace with a name the team will recognise', changes, undefined, {
  uploadMedia: [lateSlides],
})
console.log(`Wrote ${dir}/plan.json, review.md and qa.md (${changes.length} changes)`)
